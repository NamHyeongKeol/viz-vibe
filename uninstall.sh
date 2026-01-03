#!/bin/bash

# Viz Vibe Uninstaller
# Usage: curl -fsSL https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main/uninstall.sh | bash

set -e

echo "Uninstalling Viz Vibe..."
echo ""

files=(
  ".claude/settings.json"
  ".claude/hooks/update-trajectory.js"
  ".claude/hooks/state.json"
  ".claude/hooks/hook.log"
  ".claude/hooks/hook-started.log"
)

removed=0
skipped=0

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    rm "$file"
    echo "  [remove] $file"
    ((removed++))
  else
    echo "  [skip] $file (not found)"
    ((skipped++))
  fi
done

# Remove empty directories
rmdir .claude/hooks 2>/dev/null && echo "  [remove] .claude/hooks/" || true
rmdir .claude 2>/dev/null && echo "  [remove] .claude/" || true

echo ""
echo "Done! Removed $removed file(s), skipped $skipped file(s)."
echo ""
echo "Note: trajectory.mmd and VIZVIBE.md were kept (your work history)."
echo "To remove them too: rm trajectory.mmd VIZVIBE.md"
