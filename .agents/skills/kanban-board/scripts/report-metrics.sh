#!/usr/bin/env bash
# report-metrics.sh
# Report Kanban board metrics: WIP, cycle time, lead time, throughput, blockers.
# Usage: ./scripts/report-metrics.sh

set -euo pipefail

echo ""
echo ""
echo " Kanban Board Metrics Report (PBI-level)"
echo ""
echo ""

# 1. WIP Count 
echo "1. Work in Progress (WIP) "
echo ""

if [ ! -f .kanban/CONFIG.md ]; then
 echo " Board not initialized. Run init-board.sh first."
 exit 1
fi

TOTAL_WIP=0
while IFS= read -r line; do
 COLUMN=$(echo "$line" | sed 's/.*-\s*//' | sed 's/:.*//')
 LIMIT=$(echo "$line" | sed 's/.*://' | tr -d ' ')

 if [ "$COLUMN" = "Backlog" ] || [ "$COLUMN" = "Done" ]; then
  continue
 fi

 COUNT=0
 if [ -f .kanban/BOARD.md ]; then
  IN_SECTION=false
  while IFS= read -r board_line; do
   if echo "$board_line" | grep -q "^## $COLUMN"; then
    IN_SECTION=true
    continue
   fi
   if $IN_SECTION; then
    if echo "$board_line" | grep -q "^## "; then
     break
    fi
    if echo "$board_line" | grep -q "| \*\*"; then
     COUNT=$((COUNT + 1))
    fi
   fi
  done < .kanban/BOARD.md
 fi

 TOTAL_WIP=$((TOTAL_WIP + COUNT))

 if [ "$LIMIT" = "-1" ]; then
  printf " %-15s %3d cards (unlimited)\n" "$COLUMN" "$COUNT"
 else
  PCT=$(( COUNT * 100 / LIMIT ))
  BAR_LEN=$(( PCT / 10 ))
  BAR=""
  for ((i=0; i<BAR_LEN && i<10; i++)); do BAR="${BAR}"; done
  for ((i=BAR_LEN; i<10; i++)); do BAR="${BAR}"; done
  printf " %-15s %3d / %-3d %s %3d%%\n" "$COLUMN" "$COUNT" "$LIMIT" "$BAR" "$PCT"
 fi
done < <(grep "^\s*-\s*" .kanban/CONFIG.md)

echo ""
echo " Total WIP (active columns): $TOTAL_WIP"
echo ""

# 2. Cycle Time 
echo "2. Cycle Time (archived cards) "
echo ""

ARCHIVED_CARDS=$(find .kanban/ARCHIVED/ -name 'CARD-*.md' 2>/dev/null)
CYCLE_TIMES=()

if [ -z "$ARCHIVED_CARDS" ]; then
 echo " No archived cards yet."
else
 CARD_COUNT=0
 while IFS= read -r card_file; do
  STARTED=$(grep "^started:" "$card_file" | sed 's/.*: //')
  COMPLETED=$(grep "^completed:" "$card_file" | sed 's/.*: //')
  TITLE=$(grep "^title:" "$card_file" | sed 's/.*: "//' | sed 's/"$//')
  CARD_ID=$(basename "$card_file" | sed 's/--.*//')

  if [ "$STARTED" != "—" ] && [ "$COMPLETED" != "—" ] && command -v python3 &>/dev/null; then
   CT=$(python3 -c "
from datetime import datetime
try:
 s = datetime.fromisoformat('$STARTED')
 e = datetime.fromisoformat('$COMPLETED')
 days = (e - s).days
 hours = (e - s).seconds // 3600
 total_hours = days * 24 + hours
 print(f'{days}d {hours}h' if days > 0 else f'{hours}h')
 print(total_hours)
except:
 print('—')
 print('0')
   " 2>/dev/null)
   CT_DISPLAY=$(echo "$CT" | head -1)
   CT_HOURS=$(echo "$CT" | tail -1)
  else
   CT_DISPLAY="—"
   CT_HOURS=0
  fi

  CARD_COUNT=$((CARD_COUNT + 1))
  CYCLE_TIMES+=("$CT_HOURS")

  echo " $CARD_ID: $TITLE"
  echo "  Started:  ${STARTED:0:10}"
  echo "  Completed: ${COMPLETED:0:10}"
  echo "  Cycle time: $CT_DISPLAY"
  echo ""
 done <<< "$ARCHIVED_CARDS"

 # Average cycle time
 TOTAL_HOURS=0
 VALID_COUNT=0
 for ct in "${CYCLE_TIMES[@]}"; do
  if [ "$ct" != "0" ]; then
   TOTAL_HOURS=$((TOTAL_HOURS + ct))
   VALID_COUNT=$((VALID_COUNT + 1))
  fi
 done

 if [ "$VALID_COUNT" -gt 0 ]; then
  AVG_HOURS=$((TOTAL_HOURS / VALID_COUNT))
  AVG_DAYS=$((AVG_HOURS / 24))
  AVG_REM=$((AVG_HOURS % 24))
  echo " "
  echo " Completed cards:  $CARD_COUNT"
  echo " Avg cycle time:   ${AVG_DAYS}d ${AVG_REM}h (${AVG_HOURS}h total)"
 fi
fi
echo ""

# 3. Lead Time 
echo "3. Lead Time (backlog → done) "
echo ""

ALL_CARDS=$(find .kanban/ARCHIVED/ -name 'CARD-*.md' 2>/dev/null)
if [ -z "$ALL_CARDS" ]; then
 echo " No archived cards yet."
else
 while IFS= read -r card_file; do
  CREATED=$(grep "^created:" "$card_file" | sed 's/.*: //')
  COMPLETED=$(grep "^completed:" "$card_file" | sed 's/.*: //')
  TITLE=$(grep "^title:" "$card_file" | sed 's/.*: "//' | sed 's/"$//')
  CARD_ID=$(basename "$card_file" | sed 's/--.*//')

  if [ "$CREATED" != "—" ] && [ "$COMPLETED" != "—" ] && command -v python3 &>/dev/null; then
   LT=$(python3 -c "
from datetime import datetime
try:
 s = datetime.fromisoformat('$CREATED')
 e = datetime.fromisoformat('$COMPLETED')
 days = (e - s).days
 hours = (e - s).seconds // 3600
 print(f'{days}d {hours}h' if days > 0 else f'{hours}h')
except:
 print('—')
   " 2>/dev/null)
  else
   LT="—"
  fi

  echo " $CARD_ID: $TITLE"
  echo "  Created:  ${CREATED:0:10}"
  echo "  Completed: ${COMPLETED:0:10}"
  echo "  Lead time: $LT"
  echo ""
 done <<< "$ALL_CARDS"
fi

# 4. Throughput (last 7 days) 
echo "4. Throughput "
echo ""

if [ -z "$ALL_CARDS" ]; then
 echo " No archived cards yet."
else
 COUNT_7D=0
 COUNT_30D=0
 while IFS= read -r card_file; do
  COMPLETED=$(grep "^completed:" "$card_file" | sed 's/.*: //')
  if [ "$COMPLETED" != "—" ] && command -v python3 &>/dev/null; then
   DAYS_AGO=$(python3 -c "
from datetime import datetime, timezone
try:
 e = datetime.fromisoformat('$COMPLETED')
 now = datetime.now(timezone.utc).replace(microsecond=0)
 # Handle naive vs aware
 if e.tzinfo is None:
  e = e.replace(tzinfo=timezone.utc)
 diff = (now - e).days
 print(diff)
except:
 print('999')
   " 2>/dev/null)
   if [ "$DAYS_AGO" -le 7 ]; then
    COUNT_7D=$((COUNT_7D + 1))
   fi
   if [ "$DAYS_AGO" -le 30 ]; then
    COUNT_30D=$((COUNT_30D + 1))
   fi
  fi
 done <<< "$ALL_CARDS"

 echo " Last 7 days: $COUNT_7D cards completed"
 echo " Last 30 days: $COUNT_30D cards completed"
 if [ "$COUNT_7D" -gt 0 ]; then
  echo " Throughput:  ~${COUNT_7D} cards/week"
 fi
fi
echo ""

# 5. Stuck Work 
echo "5. Stuck Work (split or help-requested) "
echo ""

if [ ! -f .kanban/BLOCKED.md ]; then
 echo " No stuck work logged."
else
 SPLIT_COUNT=$(grep -c "Status: split" .kanban/BLOCKED.md 2>/dev/null || echo 0)
 HELP_COUNT=$(grep -c "Status: help-requested" .kanban/BLOCKED.md 2>/dev/null || echo 0)
 echo " Cards split:    $SPLIT_COUNT"
 echo " Help requests:   $HELP_COUNT"
 echo ""

 if [ "$HELP_COUNT" -gt 0 ]; then
  echo " Open help requests:"
  echo ""
  awk '/## CARD/{id=$2; gsub(/--.*/,"",id)} /Status: help-requested/{print "   " id}' .kanban/BLOCKED.md | sort -u | while IFS= read -r blocker; do
   echo "  $blocker"
  done
  echo ""
 fi
fi

echo ""
echo ""
