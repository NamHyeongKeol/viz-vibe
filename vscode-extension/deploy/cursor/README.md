# Cursor Deployment

Cursor is a VS Code fork that supports native hooks for AI agent integration.

## Extension Installation

### Option 1: Open VSX (Recommended)

Search for "Viz Vibe" in Cursor's Extensions panel.

### Option 2: Manual VSIX Install

```bash
cd vscode-extension
npm run package

# In Cursor:
# Cmd+Shift+P → "Extensions: Install from VSIX..."
# Select viz-vibe-*.vsix
```

## Hook Integration

Cursor supports hooks similar to Claude Code. The extension automatically sets up hooks when initialized in a Cursor environment.

Hooks location: `.cursor/hooks.json`

Available hooks:

- `beforeSubmitPrompt` - Injects trajectory context before each prompt
- `stop` - Prompts trajectory update after AI completes

## Manual Hook Setup

If auto-setup doesn't work, create `.cursor/hooks.json`:

```json
{
  "version": 1,
  "hooks": {
    "beforeSubmitPrompt": [{ "command": "node .cursor/hooks/read-vizvibe.js" }],
    "stop": [{ "command": "node .cursor/hooks/update-vizvibe.js" }]
  }
}
```
