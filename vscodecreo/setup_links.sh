#!/usr/bin/env bash
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

REPO_DIR="$(pwd)"

VSCODE_EXT_DIR="$HOME/.vscode/extensions/creo-local"
NVIM_LUA_DIR="$HOME/.config/nvim/lua"

# Backup existing vscode extension
if [ -e "$VSCODE_EXT_DIR" ]; then
    mv "$VSCODE_EXT_DIR" "${VSCODE_EXT_DIR}.bak.$TIMESTAMP"
fi

# Backup existing nvim config
if [ -e "$NVIM_LUA_DIR/creo.lua" ]; then
    mv "$NVIM_LUA_DIR/creo.lua" "$NVIM_LUA_DIR/creo.lua.bak.$TIMESTAMP"
fi

# Create symlink for vscode
ln -s "$REPO_DIR/creo-vscode" "$VSCODE_EXT_DIR"

# Create symlink for nvim
mkdir -p "$NVIM_LUA_DIR"
ln -s "$REPO_DIR/nvim/creo.lua" "$NVIM_LUA_DIR/creo.lua"

echo "Symlinks created."

