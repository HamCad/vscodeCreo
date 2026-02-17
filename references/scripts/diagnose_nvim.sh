#!/usr/bin/env bash
# diagnose_nvim.sh - Debug Neovim LSP setup

echo "=========================================="
echo "Neovim LSP Diagnostics"
echo "=========================================="
echo ""

# Check Neovim installation
echo "1. Neovim Installation"
echo "========================================"
if command -v nvim &> /dev/null; then
    NVIM_VERSION=$(nvim --version | head -1)
    echo "✓ Neovim installed: $NVIM_VERSION"
else
    echo "✗ Neovim NOT FOUND"
    exit 1
fi
echo ""

# Check LSP config file
echo "2. LSP Config File"
echo "========================================"
LSP_FILE="$HOME/.config/nvim/lua/creo_lsp.lua"
if [ -f "$LSP_FILE" ]; then
    echo "✓ Config file exists: $LSP_FILE"
    
    if [ -L "$LSP_FILE" ]; then
        TARGET=$(readlink -f "$LSP_FILE")
        echo "  → Symlink points to: $TARGET"
    fi
    
    # Check for correct language ID
    if grep -q "filetypes = { 'pro' }" "$LSP_FILE"; then
        echo "  ✓ Correct filetype 'pro' configured"
    else
        echo "  ✗ WARNING: Filetype might not be set to 'pro'"
    fi
else
    echo "✗ Config file NOT FOUND: $LSP_FILE"
fi
echo ""

# Check init.lua
echo "3. Neovim init.lua Check"
echo "========================================"
INIT_FILE="$HOME/.config/nvim/init.lua"
if [ -f "$INIT_FILE" ]; then
    echo "✓ init.lua exists"
    
    if grep -q "creo_lsp" "$INIT_FILE"; then
        echo "  ✓ creo_lsp is referenced in init.lua"
        echo ""
        echo "  Relevant lines:"
        grep -n "creo_lsp" "$INIT_FILE"
    else
        echo "  ⚠ WARNING: creo_lsp NOT found in init.lua"
        echo ""
        echo "  Add this line to init.lua:"
        echo "  require('creo_lsp').setup('/absolute/path/to/repo/server/server.js')"
    fi
else
    echo "⚠ init.lua not found (you might be using init.vim)"
fi
echo ""

# Check lspconfig
echo "4. LSP Config Plugin"
echo "========================================"
if [ -d "$HOME/.local/share/nvim/site/pack" ] || [ -d "$HOME/.local/share/nvim/lazy" ] || [ -d "$HOME/.config/nvim/pack" ]; then
    echo "Plugin directory found"
    
    # Try to detect lspconfig
    if find "$HOME/.local/share/nvim" -name "lspconfig" -type d 2>/dev/null | grep -q lspconfig; then
        echo "✓ nvim-lspconfig appears to be installed"
    else
        echo "⚠ nvim-lspconfig might not be installed"
        echo ""
        echo "  Install with your plugin manager:"
        echo "  - Packer: use 'neovim/nvim-lspconfig'"
        echo "  - Lazy: { 'neovim/nvim-lspconfig' }"
    fi
fi
echo ""

# Check Node.js
echo "5. Node.js Check"
echo "========================================"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✓ Node.js installed: $NODE_VERSION"
else
    echo "✗ Node.js NOT FOUND - required for LSP server"
fi
echo ""

# Find server.js
echo "6. Server Location"
echo "========================================"
echo "Searching for server.js in common locations..."
POSSIBLE_PATHS=(
    "$HOME/vscodeCreo/vscodecreo/server/server.js"
    "$HOME/projects/vscodecreo/server/server.js"
    "$HOME/.config/nvim/lua/../../server/server.js"
)

FOUND_SERVER=""
for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -f "$path" ]; then
        echo "✓ Found: $path"
        FOUND_SERVER="$path"
    fi
done

if [ -z "$FOUND_SERVER" ]; then
    echo "⚠ server.js not found in common locations"
    echo ""
    echo "Search for it:"
    echo "  find ~ -name server.js -path '*/server/server.js' 2>/dev/null"
fi
echo ""

# Test server syntax
if [ -n "$FOUND_SERVER" ]; then
    echo "7. Server Syntax Test"
    echo "========================================"
    if node --check "$FOUND_SERVER" 2>&1; then
        echo "✓ server.js syntax valid"
    else
        echo "✗ server.js has syntax errors"
    fi
    echo ""
fi

# Filetype detection
echo "8. Filetype Detection Test"
echo "========================================"
echo "Creating test file: /tmp/test.pro"
cat > /tmp/test.pro << 'EOF'
mapkey(test) Test Mapkey
~Command test;
EOF

echo ""
echo "To test filetype detection, run:"
echo "  nvim /tmp/test.pro"
echo ""
echo "Then in Neovim, type:"
echo "  :set filetype?"
echo ""
echo "Expected output: filetype=pro"
echo ""

echo "=========================================="
echo "Neovim Diagnostics Complete"
echo "=========================================="
echo ""
echo "Common issues:"
echo ""
echo "1. 'no parser for lang idlang' - IGNORE THIS"
echo "   This is a TreeSitter warning, unrelated to your LSP"
echo ""
echo "2. 'no manual entry for mapkey' - IGNORE THIS"
echo "   This is the man command trying to open a manual page"
echo ""
echo "3. To verify LSP is working:"
echo "   - Open a .pro file in Neovim"
echo "   - Type: :LspInfo"
echo "   - Should show 'creo_lsp' attached"
echo ""
echo "4. If LSP not attaching:"
echo "   - Check :messages for errors"
echo "   - Verify server path in init.lua"
echo "   - Test server: node /path/to/server/server.js"
