#!/usr/bin/env bash
# setup_nvim_complete.sh
# Complete Neovim setup for Creo .pro files

set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NVIM_CONFIG="$HOME/.config/nvim"

echo "=========================================="
echo "Complete Neovim Setup for Creo LSP"
echo "=========================================="
echo ""

# 1. Setup LSP config
echo "1. Setting up LSP configuration..."
mkdir -p "$NVIM_CONFIG/lua"

if [ -e "$NVIM_CONFIG/lua/creo_lsp.lua" ]; then
    echo "   Backing up existing creo_lsp.lua..."
    mv "$NVIM_CONFIG/lua/creo_lsp.lua" "$NVIM_CONFIG/lua/creo_lsp.lua.bak.$(date +%s)"
fi

ln -s "$REPO_DIR/nvim/lua/creo_lsp.lua" "$NVIM_CONFIG/lua/creo_lsp.lua"
echo "   ✓ LSP config linked"

# 2. Setup filetype detection
echo ""
echo "2. Setting up filetype detection..."
mkdir -p "$NVIM_CONFIG/ftdetect"

cat > "$NVIM_CONFIG/ftdetect/pro.lua" << 'EOF'
-- Filetype detection for .pro files
vim.filetype.add({
  extension = {
    pro = 'pro',
    sup = 'pro',
  },
  filename = {
    ['mapkeys.pro'] = 'pro',
    ['config.pro'] = 'pro',
  },
})
EOF

echo "   ✓ Filetype detection configured"

# 3. Setup syntax highlighting (fallback if no TreeSitter)
echo ""
echo "3. Setting up syntax highlighting..."
mkdir -p "$NVIM_CONFIG/syntax"

cat > "$NVIM_CONFIG/syntax/pro.vim" << 'EOF'
" Vim syntax file
" Language: Creo Pro
" Filetype: pro

if exists("b:current_syntax")
  finish
endif

" Comments
syn match proComment "#.*$"

" Keywords
syn keyword proKeyword mapkey

" Directives
syn match proDirective "@[A-Za-z0-9_\-():]\+"

" Strings
syn region proString start=+"+ skip=+\\\\\|\\"+ end=+"+ 
syn region proString start=+'+ skip=+\\\\\|\\'+ end=+'+ 

" Commands
syn match proTilde "\~"
syn match proSemicolon ";"

" Identifiers
syn match proIdentifier "[A-Za-z0-9_\-+]\+\(:[A-Za-z0-9_\-]\+\)\?"

" Highlight groups
hi def link proComment Comment
hi def link proKeyword Keyword
hi def link proDirective PreProc
hi def link proString String
hi def link proTilde Special
hi def link proSemicolon Delimiter
hi def link proIdentifier Function

let b:current_syntax = "pro"
EOF

echo "   ✓ Syntax highlighting configured"

# 4. Check init.lua
echo ""
echo "4. Checking init.lua configuration..."

if [ -f "$NVIM_CONFIG/init.lua" ]; then
    if grep -q "creo_lsp" "$NVIM_CONFIG/init.lua"; then
        echo "   ✓ creo_lsp already in init.lua"
    else
        echo "   ⚠ Adding creo_lsp to init.lua..."
        echo "" >> "$NVIM_CONFIG/init.lua"
        echo "-- Creo LSP" >> "$NVIM_CONFIG/init.lua"
        echo "require('creo_lsp').setup('$REPO_DIR/server/server.js')" >> "$NVIM_CONFIG/init.lua"
        echo "   ✓ Added to init.lua"
    fi
else
    echo "   ⚠ init.lua not found, creating..."
    cat > "$NVIM_CONFIG/init.lua" << EOF
-- Neovim configuration

-- Creo LSP
require('creo_lsp').setup('$REPO_DIR/server/server.js')
EOF
    echo "   ✓ Created init.lua"
fi

# 5. Optional: TreeSitter stub
echo ""
echo "5. Setting up TreeSitter queries (optional)..."
mkdir -p "$NVIM_CONFIG/queries/pro"

cat > "$NVIM_CONFIG/queries/pro/highlights.scm" << 'EOF'
; TreeSitter highlighting for .pro files
; This is a stub - actual TreeSitter parser would need to be built

; Comments
((comment) @comment)

; Keywords
((identifier) @keyword (#eq? @keyword "mapkey"))

; Directives
((directive) @keyword.directive)

; Strings
((string) @string)
EOF

echo "   ✓ TreeSitter queries created (stub)"

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "What was configured:"
echo "  ✓ LSP configuration → $NVIM_CONFIG/lua/creo_lsp.lua"
echo "  ✓ Filetype detection → $NVIM_CONFIG/ftdetect/pro.lua"
echo "  ✓ Syntax highlighting → $NVIM_CONFIG/syntax/pro.vim"
echo "  ✓ TreeSitter queries → $NVIM_CONFIG/queries/pro/"
echo "  ✓ init.lua updated"
echo ""
echo "Testing:"
echo "  1. Restart Neovim"
echo "  2. Open: nvim /tmp/test.pro"
echo "  3. Check filetype: :set filetype?"
echo "     Expected: filetype=pro"
echo "  4. Check LSP: :LspInfo"
echo "     Expected: creo_lsp attached"
echo ""
echo "Note about :InspectTree:"
echo "  - :InspectTree requires a full TreeSitter parser"
echo "  - This is a major undertaking (writing tree-sitter-pro parser)"
echo "  - For now, use syntax highlighting + LSP features"
echo "  - In VS Code, use 'Developer: Inspect Editor Tokens and Scopes'"
echo ""
