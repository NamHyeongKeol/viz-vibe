#!/bin/bash

# Viz Vibe Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main/install.sh | bash

set -e

REPO_BASE="https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main"

echo "Installing Viz Vibe..."
echo ""

# Create directories
mkdir -p .claude/hooks

# Download files
files=(
  "cli/templates/hooks.json:.claude/hooks.json"
  "cli/templates/update-trajectory.js:.claude/hooks/update-trajectory.js"
  "cli/templates/trajectory.mmd:trajectory.mmd"
  "cli/templates/VIZVIBE.md:VIZVIBE.md"
)

created=0
skipped=0

for file in "${files[@]}"; do
  src="${file%%:*}"
  dest="${file##*:}"

  if [ -f "$dest" ]; then
    echo "  [skip] $dest (already exists)"
    ((skipped++))
  else
    curl -fsSL "$REPO_BASE/$src" -o "$dest"
    echo "  [create] $dest"
    ((created++))
  fi
done

echo ""
echo "Done! Created $created file(s), skipped $skipped file(s)."
echo ""
echo "Next steps:"
echo "  1. Start Claude Code in this project"
echo "  2. Work normally - trajectory will auto-update on each response"
echo "  3. Open trajectory.mmd to see your work history"
echo ""
echo "For VS Code/Cursor users:"
echo "  Install the 'Viz Vibe' extension for graph visualization."
