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
curl -fsSL "$REPO_BASE/claude-code/templates/update-trajectory.js" -o ".claude/hooks/update-trajectory.js"
curl -fsSL "$REPO_BASE/claude-code/templates/read-trajectory.js" -o ".claude/hooks/read-trajectory.js"
curl -fsSL "$REPO_BASE/shared/templates/VIZVIBE.md" -o ".claude/hooks/VIZVIBE.md"
echo "  [create] .claude/hooks/*"

# Check if settings.json exists
if [ -f ".claude/settings.json" ]; then
    echo "  [skip] .claude/settings.json (already exists)"
    echo ""
    echo "  ⚠️  You already have .claude/settings.json"
    echo "     Please manually add our hooks to your settings:"
    echo ""
    echo '     "Stop": [{ "hooks": [{ "type": "command", "command": "node .claude/hooks/update-trajectory.js" }] }]'
    echo ""
    manual_merge=true
    ((skipped++))
else
    curl -fsSL "$REPO_BASE/claude-code/templates/settings.json" -o ".claude/settings.json"
    echo "  [create] .claude/settings.json"
    ((created++))
fi

# Download trajectory.mmd if not exists
if [ -f "trajectory.mmd" ]; then
    echo "  [skip] trajectory.mmd (already exists)"
    ((skipped++))
else
    curl -fsSL "$REPO_BASE/shared/templates/trajectory.mmd" -o "trajectory.mmd"
    echo "  [create] trajectory.mmd"
    ((created++))
fi

# Add to .gitignore (hook scripts + runtime files)
if [ -f ".gitignore" ]; then
    # Check if Viz Vibe section already exists
    if ! grep -q "# Viz Vibe" .gitignore 2>/dev/null; then
        echo "" >> .gitignore
        echo "# Viz Vibe (local install)" >> .gitignore
        echo ".claude/hooks/*-trajectory.js" >> .gitignore
        echo ".claude/hooks/VIZVIBE.md" >> .gitignore
        echo ".claude/hooks/state.json" >> .gitignore
        echo "  [update] .gitignore"
    else
        echo "  [skip] .gitignore (Viz Vibe already configured)"
    fi
else
    echo "# Viz Vibe (local install)" > .gitignore
    echo ".claude/hooks/*-trajectory.js" >> .gitignore
    echo ".claude/hooks/VIZVIBE.md" >> .gitignore
    echo ".claude/hooks/state.json" >> .gitignore
    echo "  [create] .gitignore"
fi

echo ""
echo "Done! Created $created file(s), skipped $skipped file(s)."
echo ""

if [ "$manual_merge" = true ]; then
    echo "⚠️  Manual action required: Merge hooks into your .claude/settings.json"
    echo ""
fi

echo "Next steps:"
echo "  1. Start Claude Code in this project"
echo "  2. Work normally - trajectory will auto-update on each response"
echo "  3. Open trajectory.mmd to see your work history"
echo ""
echo "For VS Code/Cursor/Antigravity users:"
echo "  Install the 'Viz Vibe' extension for graph visualization."
