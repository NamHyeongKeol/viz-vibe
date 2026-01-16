#!/bin/bash

# Viz Vibe Global Uninstaller
# Usage: curl -fsSL https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main/claude-code/global-uninstall.sh | bash

set -e

VIZVIBE_HOME="$HOME/.vizvibe"
CLAUDE_HOME="$HOME/.claude"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Viz Vibe - Global Uninstallation                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 1. Remove vizvibe home directory
if [ -d "$VIZVIBE_HOME" ]; then
    echo "🗑️  Removing $VIZVIBE_HOME..."
    rm -rf "$VIZVIBE_HOME"
    echo "   Done"
else
    echo "   $VIZVIBE_HOME not found (skipping)"
fi

# 2. Remove Claude hooks
echo "🗑️  Removing Claude hooks..."
rm -f "$CLAUDE_HOME/hooks/read-vizvibe.js"
rm -f "$CLAUDE_HOME/hooks/update-vizvibe.js"
rm -f "$CLAUDE_HOME/hooks/VIZVIBE.md"
echo "   Done"

# 3. Remove Claude skills
echo "🗑️  Removing Claude skills..."
rm -rf "$CLAUDE_HOME/skills/vizvibe"
echo "   Done"

# 4. Clean up shell rc
echo "🗑️  Cleaning up shell configuration..."

for rc_file in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
    if [ -f "$rc_file" ]; then
        # Create temp file without vizvibe lines
        if grep -q "VIZVIBE_HOME" "$rc_file" 2>/dev/null; then
            grep -v "VIZVIBE_HOME\|# Viz Vibe - Visual Context Map" "$rc_file" > "$rc_file.tmp" || true
            mv "$rc_file.tmp" "$rc_file"
            echo "   Cleaned $rc_file"
        fi
    fi
done

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ Uninstallation complete!                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Note:"
echo "  - vizvibe.mmd files in your projects are NOT deleted"
echo "  - To completely remove Claude hook settings, edit ~/.claude/settings.json"
echo ""
echo "To reinstall: curl -fsSL https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main/claude-code/global-install.sh | bash"
echo ""
