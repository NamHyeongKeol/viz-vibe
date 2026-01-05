#!/bin/bash

# Viz Vibe Uninstaller
# Usage: curl -fsSL https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main/claude-code/uninstall.sh | bash

set -e

echo "Uninstalling Viz Vibe..."
echo ""

# Files to remove completely
files=(
  ".claude/hooks/update-vizvibe.js"
  ".claude/hooks/read-vizvibe.js"
  ".claude/hooks/VIZVIBE.md"
  ".claude/hooks/state.json"
  "vizvibe.mmd"
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

# Remove vizvibe hooks from settings.json (keep other user settings)
if [ -f ".claude/settings.json" ]; then
  echo ""
  echo "Cleaning vizvibe hooks from settings.json..."

  node -e '
    const fs = require("fs");
    const settingsPath = ".claude/settings.json";

    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      let modified = false;

      if (settings.hooks) {
        // Remove SessionStart hooks that reference vizvibe scripts
        if (settings.hooks.SessionStart) {
          settings.hooks.SessionStart = settings.hooks.SessionStart.filter(entry => {
            const hasVizvibe = entry.hooks?.some(h =>
              h.command?.includes("read-vizvibe.js")
            );
            if (hasVizvibe) modified = true;
            return !hasVizvibe;
          });
          if (settings.hooks.SessionStart.length === 0) {
            delete settings.hooks.SessionStart;
          }
        }

        // Remove Stop hooks that reference vizvibe scripts
        if (settings.hooks.Stop) {
          settings.hooks.Stop = settings.hooks.Stop.filter(entry => {
            const hasVizvibe = entry.hooks?.some(h =>
              h.command?.includes("update-vizvibe.js")
            );
            if (hasVizvibe) modified = true;
            return !hasVizvibe;
          });
          if (settings.hooks.Stop.length === 0) {
            delete settings.hooks.Stop;
          }
        }

        // Remove hooks object if empty
        if (Object.keys(settings.hooks).length === 0) {
          delete settings.hooks;
        }
      }

      if (modified) {
        // Check if settings is now empty
        if (Object.keys(settings).length === 0) {
          fs.unlinkSync(settingsPath);
          console.log("  [remove] .claude/settings.json (was empty)");
        } else {
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
          console.log("  [clean] .claude/settings.json (removed vizvibe hooks)");
        }
      } else {
        console.log("  [skip] .claude/settings.json (no vizvibe hooks found)");
      }
    } catch (e) {
      console.log("  [skip] .claude/settings.json (parse error)");
    }
  '
fi

# Remove empty directories
rmdir .claude/hooks 2>/dev/null && echo "  [remove] .claude/hooks/" || true
rmdir .claude 2>/dev/null && echo "  [remove] .claude/" || true

echo ""
echo "Done! Removed $removed file(s), skipped $skipped file(s)."
echo ""
echo "Viz Vibe has been completely removed."
