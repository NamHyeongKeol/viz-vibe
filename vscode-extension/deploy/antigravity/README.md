# Antigravity (Windsurf) Deployment

Antigravity supports VS Code compatible extensions.

## Installation

### VSIX Manual Install

```bash
cd vscode-extension

# Package
npm run package

# In Antigravity:
# Cmd+Shift+P → "Extensions: Install from VSIX..."
# Select viz-vibe-*.vsix
```

## AI Agent Integration (No Hooks)

Antigravity doesn't have a hook system yet, so we use a shortcut-based approach:

### 1. Initialize Project

Run `Cmd+Shift+P` → "Viz Vibe: Initialize Project"

This creates:
- `vizvibe.mmd` with initial graph draft
- `VIZVIBE.md` guide for AI

### 2. Configure gemini.md

Add to `~/.gemini/gemini.md`:

```markdown
## Viz Vibe Context Management

After completing significant work, update vizvibe.mmd.
Refer to the project's VIZVIBE.md guide for format.

Update when:
- Major milestone completed
- New direction/approach decided
- Blocker discovered
- Future work planned

Skip updates for trivial fixes or routine tasks.
```

### 3. Use Keyboard Shortcut

When AI doesn't auto-update, use the shortcut to prompt:

- **Ctrl+Shift+Cmd+V** (Mac) / **Ctrl+Shift+Alt+V** (Windows/Linux): Record current turn / prompt AI to update vizvibe.mmd

This shortcut helps users manually trigger trajectory updates when the AI doesn't do it automatically.

## Limitations

- No hook system = no forced automation
- Relies on AI following gemini.md instructions
- Shortcut provides manual fallback
- Will adopt hook-based approach when Antigravity adds hook support
