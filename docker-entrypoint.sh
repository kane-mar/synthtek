#!/bin/sh
set -e

# Ensure the workspace directory exists with proper permissions
if [ -n "$SYNTHTEK_WORKSPACE" ]; then
  # Create the workspace and subdirectories the app needs to write to
  for subdir in "" ".npm" "config" "skills" ".agents/skills"; do
    mkdir -p "$SYNTHTEK_WORKSPACE/$subdir" 2>/dev/null || true
  done
  # Try chown first (works for Docker volumes), fall back to chmod (works for host bind mounts)
  chown -R synthtek:synthtek "$SYNTHTEK_WORKSPACE" 2>/dev/null && echo "Permissions set via chown" || { chmod -R a+w "$SYNTHTEK_WORKSPACE" 2>/dev/null && echo "Permissions set via chmod" || echo "⚠️  Could not set permissions on $SYNTHTEK_WORKSPACE (non-fatal)"; }
fi

# Set HOME to workspace so ~/.agents/skills/ and npm cache persist
if [ -n "$SYNTHTEK_WORKSPACE" ]; then
  HOME="$SYNTHTEK_WORKSPACE"
  export HOME
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
