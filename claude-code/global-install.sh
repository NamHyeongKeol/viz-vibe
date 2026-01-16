#!/bin/bash

# Viz Vibe Global Installer for Claude Code
# Usage: curl -fsSL https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main/claude-code/global-install.sh | bash

set -e

REPO_BASE="https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main"
VIZVIBE_HOME="$HOME/.vizvibe"
CLAUDE_HOME="$HOME/.claude"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Viz Vibe - Global Installation                    ║"
echo "║     Visual Context Map for AI Coding                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 1. Create directories
echo "📁 Setting up directories..."
mkdir -p "$VIZVIBE_HOME/bin"
mkdir -p "$VIZVIBE_HOME/scripts"
mkdir -p "$VIZVIBE_HOME/skills/vizvibe"
mkdir -p "$VIZVIBE_HOME/templates"
mkdir -p "$CLAUDE_HOME"

# 2. Download CLI script
echo "📥 Downloading CLI..."
curl -fsSL "$REPO_BASE/claude-code/bin/vizvibe" -o "$VIZVIBE_HOME/bin/vizvibe"
chmod +x "$VIZVIBE_HOME/bin/vizvibe"

# 3. Download hook scripts
echo "📥 Downloading hook scripts..."
curl -fsSL "$REPO_BASE/claude-code/plugin/scripts/read-vizvibe.js" -o "$VIZVIBE_HOME/scripts/read-vizvibe.js"
curl -fsSL "$REPO_BASE/claude-code/plugin/scripts/update-vizvibe.js" -o "$VIZVIBE_HOME/scripts/update-vizvibe.js"

# 4. Download SKILL.md
echo "📥 Downloading skill..."
curl -fsSL "$REPO_BASE/claude-code/plugin/skills/vizvibe/SKILL.md" -o "$VIZVIBE_HOME/skills/vizvibe/SKILL.md"

# 5. Download template
echo "📥 Downloading template..."
curl -fsSL "$REPO_BASE/claude-code/plugin/templates/vizvibe.mmd" -o "$VIZVIBE_HOME/templates/vizvibe.mmd"

# 6. Set up PATH
echo "🔧 Configuring PATH..."

# Detect shell rc file
if [ -n "$ZSH_VERSION" ] || [ "$SHELL" = "/bin/zsh" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ] || [ "$SHELL" = "/bin/bash" ]; then
    SHELL_RC="$HOME/.bashrc"
else
    SHELL_RC="$HOME/.profile"
fi

# Add to PATH if not already present
if ! grep -q "VIZVIBE_HOME" "$SHELL_RC" 2>/dev/null; then
    echo "" >> "$SHELL_RC"
    echo "# Viz Vibe - Visual Context Map for AI Coding" >> "$SHELL_RC"
    echo 'export VIZVIBE_HOME="$HOME/.vizvibe"' >> "$SHELL_RC"
    echo 'export PATH="$VIZVIBE_HOME/bin:$PATH"' >> "$SHELL_RC"
    echo "   Added to $SHELL_RC"
else
    echo "   Already configured in $SHELL_RC"
fi

# 7. Set up Claude Code global hooks
echo "🔧 Configuring Claude Code hooks..."

# Create hooks in Claude home
mkdir -p "$CLAUDE_HOME/hooks"
cp "$VIZVIBE_HOME/scripts/read-vizvibe.js" "$CLAUDE_HOME/hooks/"
cp "$VIZVIBE_HOME/scripts/update-vizvibe.js" "$CLAUDE_HOME/hooks/"
cp "$VIZVIBE_HOME/skills/vizvibe/SKILL.md" "$CLAUDE_HOME/hooks/VIZVIBE.md"

# Merge hooks into settings.json using Node.js
MERGED_SETTINGS=$(node -e "
const fs = require('fs');
const settingsPath = '$CLAUDE_HOME/settings.json';

const vizvibeHooks = {
  SessionStart: [
    { matcher: 'startup', hooks: [{ type: 'command', command: 'node ~/.claude/hooks/read-vizvibe.js' }] },
    { matcher: 'resume', hooks: [{ type: 'command', command: 'node ~/.claude/hooks/read-vizvibe.js' }] }
  ],
  Stop: [
    { hooks: [{ type: 'command', command: 'node ~/.claude/hooks/update-vizvibe.js' }] }
  ]
};

let settings = {};
if (fs.existsSync(settingsPath)) {
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
}

// Merge hooks
if (!settings.hooks) {
  settings.hooks = {};
}

// For each hook type, check if vizvibe hooks already exist
let alreadyInstalled = false;
for (const [hookType, vizvibeHookList] of Object.entries(vizvibeHooks)) {
  if (!settings.hooks[hookType]) {
    settings.hooks[hookType] = [];
  }
  
  const existingCommands = JSON.stringify(settings.hooks[hookType]);
  if (existingCommands.includes('vizvibe')) {
    alreadyInstalled = true;
  } else {
    for (const hook of vizvibeHookList) {
      settings.hooks[hookType].push(hook);
    }
  }
}

if (alreadyInstalled) {
  console.log('ALREADY_INSTALLED');
} else {
  console.log(JSON.stringify(settings, null, 2));
}
")

if [ "$MERGED_SETTINGS" = "ALREADY_INSTALLED" ]; then
    echo "   ✅ Vizvibe hooks already configured in settings.json"
else
    if [ -f "$CLAUDE_HOME/settings.json" ]; then
        echo ""
        echo "📄 Current settings.json will be updated with vizvibe hooks."
        echo ""
        echo "━━━ Merged settings.json (preview) ━━━"
        echo "$MERGED_SETTINGS"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        read -p "Apply this change? (y/N) " -n 1 -r
        echo ""
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Backup original
            cp "$CLAUDE_HOME/settings.json" "$CLAUDE_HOME/settings.json.backup"
            echo "   📦 Backed up to settings.json.backup"
            
            # Write merged settings
            echo "$MERGED_SETTINGS" > "$CLAUDE_HOME/settings.json"
            echo "   ✅ Updated settings.json with vizvibe hooks"
        else
            echo "   ⏭️  Skipped. You can manually add hooks later."
            echo ""
            echo "   Add these hooks to ~/.claude/settings.json:"
            echo '   "hooks": { "SessionStart": [...], "Stop": [...] }'
        fi
    else
        # No existing file, just create it
        echo "$MERGED_SETTINGS" > "$CLAUDE_HOME/settings.json"
        echo "   ✅ Created settings.json with vizvibe hooks"
    fi
fi

# 8. Set up Claude Code global skills
echo "🔧 Configuring Claude Code skills..."
mkdir -p "$CLAUDE_HOME/skills/vizvibe"
cp "$VIZVIBE_HOME/skills/vizvibe/SKILL.md" "$CLAUDE_HOME/skills/vizvibe/"
echo "   Installed skill to $CLAUDE_HOME/skills/vizvibe/"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ Installation complete!                                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 Installed to: $VIZVIBE_HOME"
echo ""
echo "🚀 Quick Start:"
echo ""
echo "   1. Open a new terminal (to load PATH changes)"
echo "   2. Navigate to any project directory"
echo "   3. Run: vizvibe init"
echo "   4. Start Claude Code - it will auto-detect vizvibe.mmd!"
echo ""
echo "📖 Commands:"
echo "   vizvibe init     Create vizvibe.mmd in current directory"
echo "   vizvibe help     Show help"
echo ""
echo "💡 Tip: Install the 'Viz Vibe' VS Code extension for graph visualization!"
echo ""
