#!/bin/sh
set -e

# Ensure the workspace directory exists with proper permissions
if [ -n "$SYNTHTEK_WORKSPACE" ]; then
  mkdir -p "$SYNTHTEK_WORKSPACE" 2>/dev/null || true
  chown -R synthtek:synthtek "$SYNTHTEK_WORKSPACE" 2>/dev/null || true
fi

# Set HOME to workspace so ~/.agents/skills/ and npm cache persist
if [ -n "$SYNTHTEK_WORKSPACE" ]; then
  HOME="$SYNTHTEK_WORKSPACE"
  export HOME
  mkdir -p "$HOME/.npm" 2>/dev/null || true
  chown -R synthtek:synthtek "$HOME/.npm" 2>/dev/null || true
fi

# Bridge skills from skills.sh install path (~/.agents/skills/) to
# the synthtek skill manager path ($SYNTHTEK_WORKSPACE/skills/).
AGENTS_SKILLS="$SYNTHTEK_WORKSPACE/.agents/skills"
SKILLS_DIR="$SYNTHTEK_WORKSPACE/skills"
if [ -d "$AGENTS_SKILLS" ]; then
  mkdir -p "$SKILLS_DIR" 2>/dev/null || true
  for skill_dir in "$AGENTS_SKILLS"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name="$(basename "$skill_dir")"
    target="$SKILLS_DIR/$skill_name"
    if [ ! -e "$target" ]; then
      ln -sf "$skill_dir" "$target" 2>/dev/null || true
    fi
  done
fi

# Drop to synthtek user if running as root
if [ "$(id -u)" = "0" ] && command -v su >/dev/null 2>&1; then
  exec su -s /bin/sh synthtek -c "$(printf '%s ' "$@")"
else
  exec "$@"
fi
