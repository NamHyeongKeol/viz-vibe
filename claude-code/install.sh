#!/bin/bash

# Viz Vibe Installer for Claude Code
# Usage: curl -fsSL https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main/claude-code/install.sh | bash

set -e

REPO_BASE="https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main"

echo "Installing Viz Vibe..."
echo ""

# Create directories
mkdir -p .claude/hooks

created=0
skipped=0
manual_merge=false

# Download hook scripts and guide (always download, overwrite is OK)
echo "Downloading hook scripts..."
curl -fsSL "$REPO_BASE/claude-code/templates/update-vizvibe.js" -o ".claude/hooks/update-vizvibe.js"
curl -fsSL "$REPO_BASE/claude-code/templates/read-vizvibe.js" -o ".claude/hooks/read-vizvibe.js"
curl -fsSL "$REPO_BASE/shared/templates/VIZVIBE.md" -o ".claude/hooks/VIZVIBE.md"
echo "  [create] .claude/hooks/*"

# Check if settings.json exists
if [ -f ".claude/settings.json" ]; then
    echo "  [skip] .claude/settings.json (already exists)"
    echo ""
    echo "  ⚠️  You already have .claude/settings.json"
    echo "     Please manually add our hooks to your settings:"
    echo ""
    echo '     "Stop": [{ "hooks": [{ "type": "command", "command": "node .claude/hooks/update-vizvibe.js" }] }]'
    echo ""
    manual_merge=true
    ((skipped++))
else
    curl -fsSL "$REPO_BASE/claude-code/templates/settings.json" -o ".claude/settings.json"
    echo "  [create] .claude/settings.json"
    ((created++))
fi

# Download vizvibe.mmd if not exists
if [ -f "vizvibe.mmd" ]; then
    echo "  [skip] vizvibe.mmd (already exists)"
    ((skipped++))
else
    curl -fsSL "$REPO_BASE/shared/templates/vizvibe.mmd" -o "vizvibe.mmd"
    echo "  [create] vizvibe.mmd"
    ((created++))
fi

# Add to .gitignore (hook scripts + runtime files)
gitignore_entries=(
    ".claude/hooks/*-vizvibe.js"
    ".claude/hooks/VIZVIBE.md"
    ".claude/hooks/state.json"
)

added_count=0
if [ -f ".gitignore" ]; then
    for entry in "${gitignore_entries[@]}"; do
        # Use grep -x for exact line match, escape special chars for regex
        escaped_entry=$(printf '%s' "$entry" | sed 's/[.[\*^$()+?{|]/\\&/g')
        if ! grep -q "^${escaped_entry}$" .gitignore 2>/dev/null; then
            # Add header comment before first entry
            if [ $added_count -eq 0 ]; then
                echo "" >> .gitignore
                echo "# Viz Vibe (local install)" >> .gitignore
            fi
            echo "$entry" >> .gitignore
            ((added_count++))
        fi
    done
    if [ $added_count -gt 0 ]; then
        echo "  [update] .gitignore (+$added_count entries)"
    else
        echo "  [skip] .gitignore (already configured)"
    fi
else
    echo "# Viz Vibe (local install)" > .gitignore
    for entry in "${gitignore_entries[@]}"; do
        echo "$entry" >> .gitignore
    done
    echo "  [create] .gitignore"
fi

echo ""
echo "Done! Created $created file(s), skipped $skipped file(s)."
echo ""

if [ "$manual_merge" = true ]; then
    echo "⚠️  Manual action required: Merge hooks into your .claude/settings.json"
    echo ""
fi

# Detect if running inside Claude Code
if [ -n "$CLAUDE_PROJECT_DIR" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "✨ Installation complete inside Claude Code!"
    echo ""
    echo "📝 Would you like Claude to create an initial trajectory?"
    echo ""
    echo "   Just ask Claude:"
    echo "   \"Please read .claude/hooks/VIZVIBE.md and create an initial"
    echo "    trajectory in vizvibe.mmd based on our conversation history"
    echo "    and the codebase.\""
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "✨ Installation complete!"
    echo ""
    echo "⚠️  You are not inside a Claude Code session."
    echo ""
    echo "Next steps:"
    echo "  1. Start Claude Code in this project"
    echo "  2. Claude will automatically prompt you to create a trajectory"
    echo "  3. Work normally - trajectory will auto-update on each response"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo ""
echo "For VS Code/Cursor/Antigravity users:"
echo "  Install the 'Viz Vibe' extension for graph visualization."
