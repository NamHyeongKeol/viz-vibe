#!/bin/bash

# Viz Vibe Updater
# Usage: curl -fsSL https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main/claude-code/update.sh | bash

set -e

REPO_BASE="https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main"

echo "Updating Viz Vibe..."
echo ""

# Run uninstall (keeps vizvibe.mmd by using --keep-trajectory flag internally)
# We'll do a minimal uninstall that only removes hook scripts

echo "Removing old hook scripts..."
rm -f .claude/hooks/update-vizvibe.js
rm -f .claude/hooks/read-vizvibe.js
rm -f .claude/hooks/state.json
echo "  [remove] old hook scripts"

# Download latest files
echo ""
echo "Installing latest version..."

files=(
  "claude-code/templates/settings.json:.claude/settings.json"
  "claude-code/templates/update-vizvibe.js:.claude/hooks/update-vizvibe.js"
  "claude-code/templates/read-vizvibe.js:.claude/hooks/read-vizvibe.js"
)

for file in "${files[@]}"; do
  src="${file%%:*}"
  dest="${file##*:}"
  curl -fsSL "$REPO_BASE/$src" -o "$dest"
  echo "  [update] $dest"
done

echo ""
echo "Done! Viz Vibe updated to latest version."
echo ""
echo "Note: vizvibe.mmd and VIZVIBE.md were preserved."
