# Token Inspection Guide

## VS Code: Inspecting Tokens (InspectTree Equivalent)

VS Code has built-in token inspection that shows TextMate grammar scopes:

### Method 1: Inspect Editor Tokens (Built-in)

1. **Open a .pro file** in VS Code
2. **Place cursor** where you want to inspect
3. **Press**: `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
4. **Type**: `Developer: Inspect Editor Tokens and Scopes`
5. **Press Enter**

This will show a popup with:
- **Textmate scopes** for the token under cursor
- **Foreground color** (from your theme)
- **Metadata** about the token

**Example output**:
```
Token: mapkey
Scope: keyword.control.pro
Foreground: #569cd6
```

### Method 2: Developer Tools Console

1. **Press**: `Ctrl+Shift+I` (or `Cmd+Option+I`)
2. **Go to Console tab**
3. **Type**:
```javascript
// Get current editor
const editor = require('vscode').window.activeTextEditor;

// Get token at cursor
const position = editor.selection.active;
const tokens = editor.document.lineAt(position.line).text;

console.log('Line:', tokens);
console.log('Position:', position.character);
```

### Method 3: Extension API (for deeper inspection)

Create a temporary command in your extension:

```javascript
// Add to vscode-extension/extension.js

context.subscriptions.push(
  vscode.commands.registerCommand('creo.inspectToken', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    
    const position = editor.selection.active;
    const document = editor.document;
    const line = document.lineAt(position.line);
    
    // Get text around cursor
    const text = line.text;
    const char = position.character;
    
    // Find word boundaries
    let start = char;
    let end = char;
    
    while (start > 0 && /\S/.test(text[start - 1])) start--;
    while (end < text.length && /\S/.test(text[end])) end++;
    
    const token = text.substring(start, end);
    
    // Parse using your tokenizer
    const path = require('path');
    const { tokenize } = require(path.join(__dirname, '..', 'src', 'shared', 'tokenizer'));
    
    const tokens = tokenize(text);
    const tokenAtPos = tokens.find(t => t.start <= char && t.end > char);
    
    vscode.window.showInformationMessage(
      `Token: "${token}"\nType: ${tokenAtPos?.type || 'unknown'}\nLine: ${position.line}\nChar: ${char}`
    );
  })
);
```

Then add to `package.json`:
```json
"contributes": {
  "commands": [
    {
      "command": "creo.inspectToken",
      "title": "Creo: Inspect Token"
    }
  ],
  "keybindings": [
    {
      "command": "creo.inspectToken",
      "key": "ctrl+shift+alt+i",
      "when": "editorLangId == pro"
    }
  ]
}
```

---

## Neovim: Understanding :InspectTree

### What :InspectTree Does

`:InspectTree` shows the **TreeSitter syntax tree** for the current buffer. It requires:

1. A **TreeSitter parser** for your language
2. The parser must be **compiled** and **installed**
3. **TreeSitter queries** for highlights, indents, etc.

### Why It Doesn't Work for .pro Files

You don't have a TreeSitter parser for `.pro` files yet. Creating one requires:

1. **Write a tree-sitter grammar** in JavaScript
2. **Generate the parser** using tree-sitter-cli
3. **Compile** the parser (C code)
4. **Install** to Neovim

This is a **major project** (days/weeks of work).

### Alternatives in Neovim

**Option 1: Use syntax highlighting (what you have now)**

Your `syntax/pro.vim` provides highlighting using regex patterns. This works fine for most use cases.

**Option 2: Inspect with built-in commands**

```vim
" Check what syntax group is under cursor
:echo synIDattr(synID(line('.'), col('.'), 1), 'name')

" See all syntax groups at cursor
:so $VIMRUNTIME/syntax/hitest.vim

" Show LSP token info
:lua vim.lsp.buf.hover()

" Show LSP semantic tokens (if implemented)
:lua vim.lsp.semantic_tokens.force_refresh()
```

**Option 3: Install a syntax inspector plugin**

```lua
-- Add to your init.lua
-- Using lazy.nvim:
{
  'nvim-treesitter/playground',
  dependencies = { 'nvim-treesitter/nvim-treesitter' },
  config = function()
    require('nvim-treesitter.configs').setup({
      playground = { enable = true }
    })
  end
}
```

This gives you `:TSPlaygroundToggle` for languages that *do* have TreeSitter parsers.

**Option 4: Use LSP Semantic Tokens**

Your LSP server can provide semantic tokens. Add to `server/server.js`:

```javascript
// In capabilities
semanticTokensProvider: {
  legend: {
    tokenTypes: ['keyword', 'string', 'comment', 'function', 'variable'],
    tokenModifiers: []
  },
  full: true
}

// Add handler
handlers['textDocument/semanticTokens/full'] = (params) => {
  const { uri } = params.textDocument;
  const doc = getDocument(uri);
  if (!doc) return null;
  
  const tokens = tokenize(doc.text);
  const data = [];
  
  // Encode tokens in LSP format
  let prevLine = 0;
  let prevChar = 0;
  
  tokens.forEach(tok => {
    if (tok.type === 'T_COMMENT') {
      const deltaLine = tok.line - 1 - prevLine;
      const deltaChar = deltaLine === 0 ? tok.col - 1 - prevChar : tok.col - 1;
      
      data.push(
        deltaLine,
        deltaChar,
        tok.value.length,
        2, // comment type index
        0  // no modifiers
      );
      
      prevLine = tok.line - 1;
      prevChar = tok.col - 1;
    }
  });
  
  return { data };
};
```

Then in Neovim:
```vim
:lua vim.lsp.buf.semantic_tokens_full()
```

---

## Quick Comparison

| Feature | VS Code | Neovim | What You Have |
|---------|---------|---------|---------------|
| Syntax Highlighting | ✅ TextMate | ✅ Regex | ✅ Both |
| Token Inspection | ✅ Built-in | ✅ `:echo synID()` | ✅ Available |
| TreeSitter | ❌ No | ✅ Yes (if parser exists) | ❌ No parser |
| LSP | ✅ Working | ✅ Working | ✅ Both working |
| Semantic Tokens | ✅ Via LSP | ✅ Via LSP | ⚠️ Not implemented |

---

## Recommendations

### For VS Code (What You Have Now)

**Current capabilities**:
- ✅ Syntax highlighting (TextMate grammar)
- ✅ LSP diagnostics
- ✅ Hover info
- ✅ Token inspection via built-in tools

**To improve**:
1. Add the `creo.inspectToken` command (see above)
2. Implement semantic tokens in LSP server
3. Add more diagnostics rules

### For Neovim (After Running setup_nvim_complete.sh)

**Current capabilities**:
- ✅ Syntax highlighting (Vim syntax)
- ✅ LSP diagnostics
- ✅ Hover info
- ✅ Filetype detection

**To improve**:
1. Add semantic tokens to LSP server
2. Create more syntax rules in `syntax/pro.vim`
3. Eventually: build a TreeSitter parser (big project)

---

## Building a TreeSitter Parser (Future)

If you want `:InspectTree` to work, you'll need to:

### Step 1: Install tree-sitter-cli
```bash
npm install -g tree-sitter-cli
```

### Step 2: Create grammar
```bash
mkdir tree-sitter-pro
cd tree-sitter-pro
tree-sitter init
```

### Step 3: Write grammar.js
```javascript
module.exports = grammar({
  name: 'pro',
  
  rules: {
    source_file: $ => repeat($._definition),
    
    _definition: $ => choice(
      $.mapkey_definition,
      $.comment
    ),
    
    mapkey_definition: $ => seq(
      'mapkey',
      '(',
      $.identifier,
      ')',
      optional($.label),
      repeat($.directive),
      repeat($.command)
    ),
    
    // ... more rules
  }
});
```

### Step 4: Generate parser
```bash
tree-sitter generate
tree-sitter test
```

### Step 5: Install to Neovim
```bash
mkdir -p ~/.local/share/nvim/site/pack/tree-sitter/start/tree-sitter-pro/parser
cp build/pro.so ~/.local/share/nvim/site/pack/tree-sitter/start/tree-sitter-pro/parser/
```

### Step 6: Configure Neovim
```lua
require('nvim-treesitter.configs').setup({
  ensure_installed = { 'pro' },
  highlight = { enable = true }
})
```

**This is a substantial project.** Most languages take weeks to get a good TreeSitter parser.

---

## Summary

**For now**:
- **VS Code**: Use `Developer: Inspect Editor Tokens and Scopes`
- **Neovim**: Use `:echo synIDattr(synID(line('.'), col('.'), 1), 'name')`
- Both have working **LSP** with diagnostics and hover

**To get :InspectTree**:
- Need to build a full TreeSitter parser
- This is optional - LSP + syntax highlighting work fine without it

Run the `setup_nvim_complete.sh` script and your Neovim setup will be complete!
