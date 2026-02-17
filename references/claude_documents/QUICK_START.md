# Creo LSP Quick Start Guide

## ✅ What Was Fixed

Your extension had **7 critical issues** that prevented it from working:

1. ❌ **server.js** used forbidden `vscode-languageserver` dependency → ✅ Rewritten with raw JSON-RPC
2. ❌ **package.json** declared external dependencies → ✅ Zero dependencies now
3. ❌ **extension.js** didn't spawn LSP server → ✅ Full LSP client implementation
4. ❌ **Language ID mismatch** ('creo' vs 'pro') → ✅ Unified to 'pro'
5. ❌ **Wrong main path** in package.json → ✅ Fixed to './extension.js'
6. ❌ **Neovim config** used wrong language ID → ✅ Fixed to 'pro'
7. ❌ **Parser missing** → ✅ Created parser.js

---

## 🚀 Linux Development Setup (Arch + Neovim)

### 1. Apply Fixed Files

Replace these files in your repo:

```bash
# From the fixed_files directory:
cp server/server.js          YOUR_REPO/server/
cp server/package.json       YOUR_REPO/server/
cp vscode-extension/extension.js     YOUR_REPO/vscode-extension/
cp vscode-extension/package.json     YOUR_REPO/vscode-extension/
cp nvim/lua/creo_lsp.lua    YOUR_REPO/nvim/lua/
cp src/shared/parser.js     YOUR_REPO/src/shared/
cp setup_links.sh           YOUR_REPO/
```

### 2. Run Setup Script

```bash
cd YOUR_REPO
chmod +x setup_links.sh
./setup_links.sh
```

This creates symlinks:
- `~/.vscode/extensions/creo-lsp-local` → your vscode-extension
- `~/.config/nvim/lua/creo_lsp.lua` → your nvim config

### 3. Configure Neovim

Add to `~/.config/nvim/init.lua`:

```lua
require('creo_lsp').setup('/absolute/path/to/YOUR_REPO/server/server.js')
```

### 4. Test

```bash
# Restart VS Code or run:
code --disable-extensions --enable-proposed-api

# In Neovim:
nvim test.pro
```

Create a test file:
```pro
mapkey(test_mapkey) Test Mapkey
~Command FT_DIALOG_POST `main_dlg_cur` `ProCmdModelSave`;
```

You should see:
- ✅ Syntax highlighting
- ✅ Diagnostics (if parser finds issues)
- ✅ Hover info (basic)

---

## 🪟 Windows Deployment

### Method 1: Batch Script (Easiest)

1. Copy your entire repo to Windows machine
2. Run `deploy_windows.bat`
3. Restart VS Code

### Method 2: Manual Copy

Copy these directories to Windows:

```
%USERPROFILE%\.vscode\extensions\creo-lsp-local\
├── extension.js
├── language-configuration.json
├── package.json
├── syntaxes\
│   └── pro.tmLanguage.json
├── server\
│   ├── server.js
│   └── package.json
└── src\
    └── shared\
        ├── ast.js
        ├── parser.js
        └── tokenizer.js
```

**CRITICAL**: Do NOT copy `node_modules` - there shouldn't be any!

### Verify Installation

1. Open VS Code
2. Press `Ctrl+Shift+P` → "Developer: Show Running Extensions"
3. Look for "vscodecreo"
4. Open a `.pro` file
5. Check Output panel → "Creo LSP"

---

## 🔍 Troubleshooting

### Server Not Starting

**Check:**
```bash
# Test server directly
cd YOUR_REPO/server
node server.js
# Should print: "Creo LSP Server starting..."
# Then wait for stdin (Ctrl+C to exit)
```

**If error "Cannot find module '../src/shared/parser'":**
- Verify `src/shared/parser.js` exists
- Check paths are correct

### No Diagnostics Appearing

**Check:**
1. File has `.pro` extension
2. VS Code recognizes it as language "pro" (bottom right corner)
3. Server process is running (Task Manager / `ps aux | grep node`)

### VS Code Developer Console Errors

Press `F12` or `Ctrl+Shift+I` in VS Code:
- Look for red errors
- Check "Console" tab
- Verify server communication

---

## 📁 File Structure Reference

```
YOUR_REPO/
├── nvim/
│   └── lua/
│       └── creo_lsp.lua          ← Fixed: uses 'pro' language
├── server/
│   ├── package.json              ← Fixed: zero dependencies
│   └── server.js                 ← Fixed: raw JSON-RPC
├── src/
│   └── shared/
│       ├── ast.js                ← Your original (unchanged)
│       ├── parser.js             ← NEW: Created this file
│       └── tokenizer.js          ← Your original (unchanged)
└── vscode-extension/
    ├── extension.js              ← Fixed: LSP client
    ├── language-configuration.json ← Your original (unchanged)
    ├── package.json              ← Fixed: main path
    └── syntaxes/
        └── pro.tmLanguage.json   ← Your original (unchanged)
```

---

## 🎯 Next Steps

### Enhance Parser Diagnostics

Edit `server/server.js` → `validateDocument()` function to add rules:

```javascript
// Example: Warn about missing semicolons
if (node.type === 'CommandNode' && !node.rawText.endsWith(';')) {
  diagnostics.push({
    severity: 2, // Warning
    range: { ... },
    message: 'Command should end with semicolon'
  });
}
```

### Add Completion Support

1. Add to `server.js` capabilities:
```javascript
completionProvider: {
  triggerCharacters: ['~', '@']
}
```

2. Implement handler:
```javascript
handlers['textDocument/completion'] = (params) => {
  return {
    isIncomplete: false,
    items: [
      { label: '~Command', kind: 3 },
      { label: '@MAPKEY_NAME', kind: 14 }
    ]
  };
};
```

### Improve Hover

Parse AST at cursor position and show:
- Mapkey name
- Command type
- Directive info

---

## ✨ What You Get Now

✅ **Zero external dependencies** - runs anywhere  
✅ **Shared parser** - same code for VS Code & Neovim  
✅ **Manual Windows deployment** - just copy files  
✅ **Real LSP features** - diagnostics, hover, extensible  
✅ **Full source control** - entire implementation visible  

---

## 📞 Support

If issues persist:

1. Check VS Code Output → "Creo LSP"
2. Check server stderr output
3. Verify file structure matches exactly
4. Test server independently with `node server.js`

**Common gotcha**: On Windows, ensure Node.js is in PATH
