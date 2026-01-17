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

# 1. Remove Claude hooks and settings
echo "🗑️  Removing Claude Code hooks and settings..."

# Use Node.js to cleanly remove vizvibe hooks from settings.json
CLAUDE_SETTINGS_PATH="$HOME/.claude/settings.json"
if [ -f "$CLAUDE_SETTINGS_PATH" ]; then
    CLEANED_SETTINGS=$(node -e "
    const fs = require('fs');
    const settingsPath = '$CLAUDE_SETTINGS_PATH';
    try {
        if (!fs.existsSync(settingsPath)) process.exit(0);
        let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        if (!settings.hooks) { console.log(JSON.stringify(settings, null, 2)); process.exit(0); }

        const cleanHooks = (hookList) => {
            if (!hookList) return hookList;
            return hookList.map(entry => {
                if (entry.hooks) {
                    entry.hooks = entry.hooks.filter(h => 
                        !(h.command && h.command.includes('vizvibe')) && 
                        !(h.command && h.command.includes('read-vizvibe.js')) &&
                        !(h.command && h.command.includes('update-vizvibe.js'))
                    );
                }
                return entry;
            }).filter(entry => entry.hooks && entry.hooks.length > 0);
        };

        if (settings.hooks.SessionStart) settings.hooks.SessionStart = cleanHooks(settings.hooks.SessionStart);
        if (settings.hooks.Stop) settings.hooks.Stop = cleanHooks(settings.hooks.Stop);
        
        console.log(JSON.stringify(settings, null, 2));
    } catch (e) {
        process.exit(1);
    }
    " 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$CLEANED_SETTINGS" ]; then
        echo "$CLEANED_SETTINGS" > "$CLAUDE_SETTINGS_PATH"
        echo "   ✅ Cleaned $CLAUDE_SETTINGS_PATH"
    fi
fi

rm -f "$HOME/.claude/hooks/read-vizvibe.js" "$HOME/.claude/hooks/update-vizvibe.js" "$HOME/.claude/hooks/VIZVIBE.md"
rm -rf "$HOME/.claude/skills/vizvibe"
echo "   ✅ Removed Claude hooks and skills"

# 2. Clean up shell rc
echo "🗑️  Cleaning up shell configuration..."
for rc_file in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
    if [ -f "$rc_file" ]; then
        if grep -q "VIZVIBE_HOME" "$rc_file" 2>/dev/null; then
            sed -i.bak '/VIZVIBE_HOME/d' "$rc_file"
            sed -i.bak '/# Viz Vibe/d' "$rc_file"
            rm -f "${rc_file}.bak"
            echo "   Cleaned $rc_file"
        fi
    fi
done

# 3. Remove vizvibe home directory
if [ -d "$VIZVIBE_HOME" ]; then
    echo "🗑️  Removing $VIZVIBE_HOME..."
    rm -rf "$VIZVIBE_HOME"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ Uninstallation complete!                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Note:"
echo "  - vizvibe.mmd files in your projects are NOT deleted"
echo ""
