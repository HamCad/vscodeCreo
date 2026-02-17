#!/usr/bin/env bash
# setup_links.sh
# Creates symlinks for development on Arch Linux with Neovim

set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VSCODE_EXT_DIR="$HOME/.config/Code - OSS/creo-lsp-local"
NVIM_LUA_DIR="$HOME/.config/nvim/lua"

echo "Repository directory: $REPO_DIR"
echo "VS Code extension target: $VSCODE_EXT_DIR"
echo "Neovim Lua target: $NVIM_LUA_DIR/creo_lsp.lua"

# Backup existing VS Code extension
if [ -e "$VSCODE_EXT_DIR" ]; then
    echo "Backing up existing VS Code extension..."
    mv "$VSCODE_EXT_DIR" "${VSCODE_EXT_DIR}.bak.$TIMESTAMP"
fi

# Backup existing Neovim config
if [ -e "$NVIM_LUA_DIR/creo_lsp.lua" ]; then
    echo "Backing up existing Neovim config..."
    mv "$NVIM_LUA_DIR/creo_lsp.lua" "$NVIM_LUA_DIR/creo_lsp.lua.bak.$TIMESTAMP"
fi

# Create symlink for VS Code extension
echo "Creating VS Code extension symlink..."
ln -s "$REPO_DIR/vscode-extension" "$VSCODE_EXT_DIR"

# Create symlink for Neovim
echo "Creating Neovim config symlink..."
mkdir -p "$NVIM_LUA_DIR"
ln -s "$REPO_DIR/nvim/lua/creo_lsp.lua" "$NVIM_LUA_DIR/creo_lsp.lua"

echo ""
echo "✓ Symlinks created successfully!"
echo ""
echo "Next steps:"
echo "1. Restart VS Code or reload window"
echo "2. Add to Neovim init.lua:"
echo "   require('creo_lsp').setup('$REPO_DIR/server/server.js')"
echo ""
echo "3. For Windows deployment, copy these directories:"
echo "   - $REPO_DIR/vscode-extension"
echo "   - $REPO_DIR/server"
echo "   - $REPO_DIR/src"
echo "   to %USERPROFILE%\\.vscode\\extensions\\creo-lsp-local\\"
