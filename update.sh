#!/bin/bash

# Viz Vibe Updater
# Usage: curl -fsSL https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main/update.sh | bash

set -e

REPO_BASE="https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main"

echo "Updating Viz Vibe..."
echo ""

# Only update the hook script
file=".claude/hooks/update-trajectory.js"

if [ ! -d ".claude/hooks" ]; then
  echo "  [error] .claude/hooks/ not found. Run install first."
  exit 1
fi

curl -fsSL "$REPO_BASE/cli/templates/update-trajectory.js" -o "$file"
echo "  [update] $file"

echo ""
echo "Done! Hook script updated to latest version."
