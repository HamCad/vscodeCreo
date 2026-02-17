#!/usr/bin/env bash
# setup_links.sh
# Creates symlinks for development on Arch Linux with Neovim
# Now detects VS Code vs VS Code OSS

set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "Creo LSP Development Setup"
echo "=========================================="
echo ""
echo "Repository: $REPO_DIR"
echo ""

# Detect VS Code variant
if [ -d "$HOME/.config/Code - OSS" ]; then
    VSCODE_DIR="$HOME/.vscode-oss/extensions"
    VSCODE_VARIANT="VS Code OSS"
elif [ -d "$HOME/.config/Code" ]; then
    VSCODE_DIR="$HOME/.config/Code/extensions"
    VSCODE_VARIANT="VS Code"
elif [ -d "$HOME/.vscode/extensions" ]; then
    VSCODE_DIR="$HOME/.vscode/extensions"
    VSCODE_VARIANT="VS Code (legacy location)"
else
    echo "⚠ WARNING: No VS Code installation detected"
    echo "Skipping VS Code setup..."
    VSCODE_DIR=""
fi

if [ -n "$VSCODE_DIR" ]; then
    echo "Detected: $VSCODE_VARIANT"
    echo "Extension directory: $VSCODE_DIR"
fi

NVIM_LUA_DIR="$HOME/.config/nvim/lua"
VSCODE_EXT_TARGET="$VSCODE_DIR/creo-lsp-local"

echo ""
echo "=========================================="
echo "VS Code Extension Setup"
echo "=========================================="

if [ -n "$VSCODE_DIR" ]; then
    # Create extensions directory if it doesn't exist
    mkdir -p "$VSCODE_DIR"
    
    # Backup existing extension
    if [ -e "$VSCODE_EXT_TARGET" ]; then
        echo "Backing up existing extension..."
        mv "$VSCODE_EXT_TARGET" "${VSCODE_EXT_TARGET}.bak.$TIMESTAMP"
    fi
    
    # Create symlink
    echo "Creating symlink..."
    ln -s "$REPO_DIR/vscode-extension" "$VSCODE_EXT_TARGET"
    
    # Verify symlink
    if [ -L "$VSCODE_EXT_TARGET" ]; then
        echo "✓ Symlink created: $VSCODE_EXT_TARGET"
        echo "  → Points to: $(readlink -f "$VSCODE_EXT_TARGET")"
    else
        echo "✗ ERROR: Failed to create symlink"
        exit 1
    fi
    
    # Verify required files
    echo ""
    echo "Verifying extension files..."
    MISSING_FILES=0
    for file in package.json extension.js language-configuration.json; do
        if [ -f "$VSCODE_EXT_TARGET/$file" ]; then
            echo "  ✓ $file"
        else
            echo "  ✗ MISSING: $file"
            MISSING_FILES=$((MISSING_FILES + 1))
        fi
    done
    
    if [ $MISSING_FILES -gt 0 ]; then
        echo ""
        echo "⚠ WARNING: Some files are missing!"
        echo "Check your vscode-extension directory structure."
    fi
else
    echo "Skipped (VS Code not found)"
fi

echo ""
echo "=========================================="
echo "Neovim LSP Setup"
echo "=========================================="

# Backup existing Neovim config
if [ -e "$NVIM_LUA_DIR/creo_lsp.lua" ]; then
    echo "Backing up existing Neovim config..."
    mv "$NVIM_LUA_DIR/creo_lsp.lua" "$NVIM_LUA_DIR/creo_lsp.lua.bak.$TIMESTAMP"
fi

# Create symlink for Neovim
echo "Creating Neovim config symlink..."
mkdir -p "$NVIM_LUA_DIR"
ln -s "$REPO_DIR/nvim/lua/creo_lsp.lua" "$NVIM_LUA_DIR/creo_lsp.lua"

# Verify symlink
if [ -L "$NVIM_LUA_DIR/creo_lsp.lua" ]; then
    echo "✓ Symlink created: $NVIM_LUA_DIR/creo_lsp.lua"
    echo "  → Points to: $(readlink -f "$NVIM_LUA_DIR/creo_lsp.lua")"
else
    echo "✗ ERROR: Failed to create Neovim symlink"
    exit 1
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo ""
echo "1. VS Code:"
if [ -n "$VSCODE_DIR" ]; then
    echo "   - Restart VS Code or run: Cmd+Shift+P → 'Reload Window'"
    echo "   - Open a .pro file to test"
    echo "   - Check: Help → Toggle Developer Tools → Console"
else
    echo "   - VS Code not detected, skipped"
fi
echo ""
echo "2. Neovim:"
echo "   - Add to ~/.config/nvim/init.lua:"
echo "     require('creo_lsp').setup('$REPO_DIR/server/server.js')"
echo ""
echo "   - Restart Neovim"
echo "   - Open a .pro file"
echo "   - Type :LspInfo to verify"
echo ""
echo "3. Troubleshooting:"
echo "   Run diagnostics:"
echo "   - VS Code: ./diagnose_vscode.sh"
echo "   - Neovim:  ./diagnose_nvim.sh"
echo ""
echo "4. Ignore these Neovim warnings (they're normal):"
echo "   - 'no parser for lang idlang' (TreeSitter, unrelated)"
echo "   - 'no manual entry for mapkey' (man page, unrelated)"
echo ""
