#!/usr/bin/env bash
# move-card.sh
# Move a card between columns, respecting WIP limits.
# Updates both the card file and BOARD.md so the TUI sees the change.
# Usage: ./scripts/move-card.sh CARD-003 "In Progress"

set -euo pipefail

CARD="${1:?Usage: $0 <card-id> <target-column>}"
TARGET_RAW="${2:?Usage: $0 <card-id> <target-column>}"
DATE=$(date -Iseconds)
BOARD=".kanban/BOARD.md"

if [ ! -f .kanban/CONFIG.md ]; then
 echo "Error: .kanban/CONFIG.md not found. Run init-board.sh first."
 exit 1
fi

# ── Parse column name and WIP limit from CONFIG.md ──
TARGET=""
WIP_LIMIT=""
while IFS= read -r line; do
 case "$line" in
  -*:*)
   rest="${line#*- }"
   col_name="${rest%:*}"
   col_name="${col_name%"${col_name##*[! ]}"}"
   col_lower=$(echo "$col_name" | tr '[:upper:]' '[:lower:]')
   target_lower=$(echo "$TARGET_RAW" | tr '[:upper:]' '[:lower:]')
   if [ "$col_lower" = "$target_lower" ]; then
    TARGET="$col_name"
    limit_val="${rest##*: }"
    WIP_LIMIT="${limit_val%"${limit_val##*[! ]}"}"
    break
   fi
   ;;
 esac
done < .kanban/CONFIG.md

if [ -z "$TARGET" ]; then
 echo "Error: Column '$TARGET_RAW' not found in .kanban/CONFIG.md"
 echo "Available columns:"
 while IFS= read -r line; do
  case "$line" in -*:*) echo "  ${line#*- }" | sed 's/:.*//' ;; esac
 done < .kanban/CONFIG.md
 exit 1
fi

# ── Determine current column from BOARD.md ──
CURRENT_COL=""
if [ -f "$BOARD" ]; then
 while IFS= read -r line; do
  if [[ "$line" == "## "* ]]; then
   CURRENT_COL="${line#*## }"
  fi
  if [[ "$line" == *"**${CARD}**"* ]] && [ -n "$CURRENT_COL" ]; then
   break
  fi
 done < "$BOARD"
fi

# ── WIP limit check ──
if [ "$WIP_LIMIT" != "-1" ] && [ "$TARGET" != "Done" ]; then
 IN_COLUMN=0
 if [ -f "$BOARD" ]; then
  IN_SECTION=false
  while IFS= read -r line; do
   if [[ "$line" == "## $TARGET" ]]; then
    IN_SECTION=true
    continue
   fi
   if $IN_SECTION; then
    if [[ "$line" == "## "* ]]; then
     break
    fi
    if [[ "$line" == *"**CARD-"* ]]; then
     IN_COLUMN=$((IN_COLUMN + 1))
    fi
   fi
  done < "$BOARD"
 fi

 if [ "$IN_COLUMN" -ge "$WIP_LIMIT" ]; then
  echo "Cannot move $CARD to $TARGET — WIP limit reached ($IN_COLUMN/$WIP_LIMIT)"
  echo " Finish or move work out of $TARGET first."
  exit 1
 fi
fi

# ── Update card file frontmatter ──
CARD_FILE=$(find .kanban/CARDS/ -name "${CARD}--*.md" 2>/dev/null | head -1)
if [ -n "$CARD_FILE" ]; then
 TARGET_STATUS=$(echo "$TARGET" | tr 'A-Z' 'a-z' | sed 's/ /-/g')
 if grep -q "^status:" "$CARD_FILE"; then
  sed -i '' "s/^status:.*/status: $TARGET_STATUS/" "$CARD_FILE"
 fi

 if [ "$TARGET" != "Backlog" ] && [ "$TARGET" != "Done" ]; then
  CURRENT_STARTED=$(grep "^started:" "$CARD_FILE" | sed 's/.*: //' | tr -d ' ')
  if [ "$CURRENT_STARTED" = "—" ]; then
   sed -i '' "s/^started:.*/started: $DATE/" "$CARD_FILE"
  fi
 fi

 if [ "$TARGET" = "Done" ]; then
  sed -i '' "s/^completed:.*/completed: $DATE/" "$CARD_FILE"

  TITLE=$(grep "^title:" "$CARD_FILE" | sed 's/.*: "//' | sed 's/"$//')
  CREATED=$(grep "^created:" "$CARD_FILE" | sed 's/.*: //' | tr -d ' ')
  STARTED=$(grep "^started:" "$CARD_FILE" | sed 's/.*: //' | tr -d ' ')

  compute_diff() {
   local START="$1"
   local END="$2"
   if [ "$START" = "—" ] || [ "$END" = "—" ] || ! command -v python3 &>/dev/null; then
    echo "—"
    return
   fi
   python3 -c "
from datetime import datetime, timezone
try:
 s = datetime.fromisoformat('$START')
 e = datetime.fromisoformat('$END')
 if s.tzinfo is None: s = s.replace(tzinfo=timezone.utc)
 if e.tzinfo is None: e = e.replace(tzinfo=timezone.utc)
 diff = e - s
 days = diff.days
 hours = diff.seconds // 3600
 mins = (diff.seconds % 3600) // 60
 if days > 0: print(f'{days}d {hours}h')
 elif hours > 0: print(f'{hours}h {mins}m')
 else: print(f'{mins}m')
except: print('—')
"
  }

  CYCLE_TIME=$(compute_diff "$STARTED" "$DATE")
  LEAD_TIME=$(compute_diff "$CREATED" "$DATE")

  mkdir -p .kanban
  if [ ! -f .kanban/METRICS.md ]; then
   echo "# Flow Metrics" > .kanban/METRICS.md
   echo "" >> .kanban/METRICS.md
   echo "## Cycle Time Log" >> .kanban/METRICS.md
   echo "| Card | Title | Started | Completed | Cycle Time |" >> .kanban/METRICS.md
   echo "|------|-------|---------|-----------|------------|" >> .kanban/METRICS.md
   echo "" >> .kanban/METRICS.md
   echo "## Lead Time Log" >> .kanban/METRICS.md
   echo "| Card | Title | Created | Completed | Lead Time |" >> .kanban/METRICS.md
   echo "|------|-------|---------|-----------|-----------|" >> .kanban/METRICS.md
  fi

  echo "| $CARD | $TITLE | ${STARTED:0:10} | ${DATE:0:10} | $CYCLE_TIME |" >> .kanban/METRICS.md
  echo "| $CARD | $TITLE | ${CREATED:0:10} | ${DATE:0:10} | $LEAD_TIME |" >> .kanban/METRICS.md
  echo "  PBI metrics logged: cycle=$CYCLE_TIME, lead=$LEAD_TIME"
 fi
fi

# ── Update BOARD.md ──
CARD_TITLE=""
if [ -n "$CARD_FILE" ]; then
 CARD_TITLE=$(grep "^title:" "$CARD_FILE" | sed 's/^title: "//;s/"$//')
fi
CARD_LINE="- **${CARD}** ${CARD_TITLE}"

if [ -f "$BOARD" ]; then
 awk -v card="$CARD" -v card_line="$CARD_LINE" -v target="$TARGET" '
 BEGIN { in_col = ""; printed = 0 }

 /^## / {
  if (in_col == target && !printed) {
   print card_line
   printed = 1
  }
  in_col = substr($0, 4)
  print
  next
 }

 in_col != "" && $0 ~ "- \\*\\*" card "\\*\\*" { next }

 { print }

 END {
  if (in_col == target && !printed) {
   print card_line
  }
 }
' "$BOARD" > "${BOARD}.tmp" && mv "${BOARD}.tmp" "$BOARD"

 # Remove duplicate blank lines
 sed -i '' '/^$/{ N; /^\n$/d; }' "$BOARD" 2>/dev/null || true
fi

echo "$CARD moved to $TARGET"
