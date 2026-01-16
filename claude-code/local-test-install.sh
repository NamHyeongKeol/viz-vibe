#!/bin/bash

# Viz Vibe Local Test Install (for development)
# This installs from local files instead of GitHub

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VIZVIBE_HOME="$HOME/.vizvibe"
CLAUDE_HOME="$HOME/.claude"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Viz Vibe - Local Test Installation                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 1. Create directories
echo "📁 Setting up directories..."
mkdir -p "$VIZVIBE_HOME/bin"
mkdir -p "$VIZVIBE_HOME/scripts"
mkdir -p "$VIZVIBE_HOME/skills/vizvibe"
mkdir -p "$VIZVIBE_HOME/templates"
mkdir -p "$CLAUDE_HOME"

# 2. Copy CLI script
echo "📦 Installing CLI..."
cp "$SCRIPT_DIR/bin/vizvibe" "$VIZVIBE_HOME/bin/"
chmod +x "$VIZVIBE_HOME/bin/vizvibe"

# 3. Copy hook scripts
echo "📦 Installing hook scripts..."
cp "$SCRIPT_DIR/plugin/scripts/read-vizvibe.js" "$VIZVIBE_HOME/scripts/"
cp "$SCRIPT_DIR/plugin/scripts/update-vizvibe.js" "$VIZVIBE_HOME/scripts/"

# 4. Copy SKILL.md
echo "📦 Installing skill..."
cp "$SCRIPT_DIR/plugin/skills/vizvibe/SKILL.md" "$VIZVIBE_HOME/skills/vizvibe/"

# 5. Copy template
echo "📦 Installing template..."
cp "$SCRIPT_DIR/plugin/templates/vizvibe.mmd" "$VIZVIBE_HOME/templates/"

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

# Check if settings.json exists
if [ -f "$CLAUDE_HOME/settings.json" ]; then
    echo ""
    echo "⚠️  $CLAUDE_HOME/settings.json already exists!"
    echo "   Skipping settings.json creation."
    echo "   Please ensure hooks are configured manually if needed."
    echo ""
else
    # Create settings.json with hooks
    cat > "$CLAUDE_HOME/settings.json" << 'EOF'
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/read-vizvibe.js" }]
      },
      {
        "matcher": "resume",
        "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/read-vizvibe.js" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/update-vizvibe.js" }]
      }
    ]
  }
}
EOF
    echo "   Created $CLAUDE_HOME/settings.json"
fi

# 8. Set up Claude Code global skills
echo "🔧 Configuring Claude Code skills..."
mkdir -p "$CLAUDE_HOME/skills/vizvibe"
cp "$VIZVIBE_HOME/skills/vizvibe/SKILL.md" "$CLAUDE_HOME/skills/vizvibe/"
echo "   Installed skill to $CLAUDE_HOME/skills/vizvibe/"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ Local test installation complete!                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 Installed to: $VIZVIBE_HOME"
echo ""
echo "🚀 Quick Start:"
echo ""
echo "   1. Open a new terminal (or run: source $SHELL_RC)"
echo "   2. Navigate to any project directory"
echo "   3. Run: vizvibe init"
echo "   4. Start Claude Code - it will auto-detect vizvibe.mmd!"
echo ""
