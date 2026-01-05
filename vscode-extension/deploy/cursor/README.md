# Cursor Deployment

Cursor supports VS Code compatible extensions via Open VSX or manual installation.

## Installation

### Option 1: Manual VSIX Install

```bash
cd vscode-extension

# Package
npm run package

# In Cursor:
# Cmd+Shift+P → "Extensions: Install from VSIX..."
# Select viz-vibe-*.vsix
```

### Option 2: Open VSX (if supported)

```bash
npm run publish:ovsx
```

## Cursor-specific Notes

- Uses the same extension code as VS Code
- Works alongside Cursor's AI features
- Recommended: Add vizvibe update instructions to Rules

## Rules Configuration (Optional)

Add to Cursor's Rules:

```
After completing work, update vizvibe.mmd.
Refer to VIZVIBE.md guide for format.
```
