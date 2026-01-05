# VS Code Marketplace Deployment

## How to Deploy

```bash
cd vscode-extension

# Package the extension
npm run package

# Publish to VS Code Marketplace
npm run publish:vscode
```

## Requirements

- VS Code Marketplace Publisher account
- Personal Access Token (PAT)

```bash
# Set up PAT
vsce login viz-vibe
```

## Marketplace Info

- Publisher: `viz-vibe`
- Extension ID: `viz-vibe.viz-vibe`
- Marketplace: https://marketplace.visualstudio.com/
