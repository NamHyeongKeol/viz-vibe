#!/bin/bash

# Build and package extension for all platforms
# Usage: ./deploy/build-all.sh

set -e

cd "$(dirname "$0")/.."

echo "Building Viz Vibe extension..."
npm run compile

echo ""
echo "Packaging .vsix..."
npm run package

VSIX_FILE=$(ls -t *.vsix 2>/dev/null | head -1)

if [ -z "$VSIX_FILE" ]; then
    echo "Error: No .vsix file found"
    exit 1
fi

echo ""
echo "Created: $VSIX_FILE"
echo ""
echo "Install instructions:"
echo "  VS Code:     code --install-extension $VSIX_FILE"
echo "  Cursor:      cursor --install-extension $VSIX_FILE"
echo "  Antigravity: Open Antigravity → Cmd+Shift+P → 'Install from VSIX'"
echo ""
echo "Or copy to deploy folders:"

# Copy to deploy folders
cp "$VSIX_FILE" deploy/vscode/
cp "$VSIX_FILE" deploy/cursor/
cp "$VSIX_FILE" deploy/antigravity/

echo "  deploy/vscode/$VSIX_FILE"
echo "  deploy/cursor/$VSIX_FILE"
echo "  deploy/antigravity/$VSIX_FILE"
echo ""
echo "Done!"
