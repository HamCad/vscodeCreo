# Creo LSP Development Guide

## ✅ Your Setup is Perfect!

Your directory structure looks great. Everything is correctly organized for development.

---

## 🎯 What You Asked For: Enhanced Hover

### Current Hover (What You Have)
```
Creo LSP Server
Line: X, Character: Y
```

### Enhanced Hover (What You'll Get)
```
## Creo LSP Inspector

Position: Line 1, Col 5
Offset: 12

### Token
- Type: `T_MAPKEY`
- Value: `mapkey`
- Range: 0-7
- Line: 1, Col: 1

### AST Node
- Type: `MapkeyDefinition`
- Name: `test_key`
- Range: 0-45
- Commands: 1
- Directives: 0

### Context
This is a mapkey definition

---
💡 Tip: Use this to debug your parser and understand the AST structure!
```

### How to Install

Replace `server/server.js` with `server_with_enhanced_hover.js`:

```bash
cd ~/vscodeCreo/vscodecreo
cp server/server.js server/server.js.simple    # Backup
cp /path/to/server_with_enhanced_hover.js server/server.js

# Restart your editor
# In VS Code: Reload window
# In Neovim: Restart nvim
```

---

## 🛠️ LSP Development Workflow

### Your Current Setup is IDEAL for Development

**Why?**
1. ✅ Symlinked extensions → changes apply instantly
2. ✅ Zero dependencies → no npm install needed
3. ✅ Shared parser → change once, works everywhere
4. ✅ Full access to code → easy to debug

### Development Loop

```
┌─────────────────────────────────────┐
│ 1. Edit Code                        │
│    - server/server.js               │
│    - src/shared/parser.js           │
│    - src/shared/tokenizer.js        │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ 2. Test Changes                     │
│    Neovim:  :LspRestart             │
│    VS Code: Reload Window (Ctrl+R)  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ 3. Verify with Hover (Shift+K)     │
│    - See token type                 │
│    - See AST node                   │
│    - Understand parser output       │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ 4. Check Diagnostics                │
│    - Syntax errors                  │
│    - Validation warnings            │
└─────────────────────────────────────┘
```

---

## 📁 Where to Make Changes

### Adding New Token Types

**File:** `src/shared/tokenizer.js`

```javascript
const TOKEN_SPECS = [
  // Add your new token here
  { type: 'T_MY_TOKEN', pattern: 'mypattern' },
  
  // Existing tokens...
  { type: 'T_MAPKEY', pattern: 'mapkey' },
  // ...
];
```

### Improving the Parser

**File:** `src/shared/parser.js`

```javascript
class Parser {
  // Add new parsing methods
  parseMyNewConstruct() {
    // Your parsing logic
  }
  
  parseMapkey() {
    // Modify existing parsing
  }
}
```

### Adding New Diagnostics

**File:** `server/server.js` → `validateDocument()` function

```javascript
function validateDocument(uri, text) {
  // Add your custom diagnostics
  if (node.type === 'MapkeyDefinition') {
    if (node.name.length > 50) {
      diagnostics.push({
        severity: 2, // Warning
        range: { ... },
        message: 'Mapkey name too long'
      });
    }
  }
}
```

### Enhancing Hover Info

**File:** `server/server.js` → `'textDocument/hover'` handler

```javascript
'textDocument/hover': (params) => {
  // Add more information to hover
  if (nodeAtCursor.type === 'CommandNode') {
    content += `### Command Analysis\n`;
    content += `Detected command: ${analyzeCommand(nodeAtCursor)}\n`;
  }
}
```

---

## 🔧 Common Development Tasks

### Task 1: Add a New Token Type

Example: Add support for `!` comments

1. **Edit tokenizer.js**:
```javascript
const TOKEN_SPECS = [
  // Add before other patterns
  { type: 'T_COMMENT_EXCLAIM', pattern: '!.*$' },
  // ...existing tokens
];
```

2. **Test**: Open a `.pro` file with `!` comments
3. **Verify**: Hover over `!` comment, should show `T_COMMENT_EXCLAIM`

### Task 2: Add Custom Diagnostic

Example: Warn about duplicate mapkey names

1. **Edit server.js** in `validateDocument()`:
```javascript
const seenNames = new Set();

function traverse(node) {
  if (node.type === 'MapkeyDefinition' && node.name) {
    if (seenNames.has(node.name)) {
      diagnostics.push({
        severity: 2,
        range: { ... },
        message: `Duplicate mapkey name: ${node.name}`
      });
    }
    seenNames.add(node.name);
  }
  // ... rest of traverse
}
```

2. **Test**: Create file with duplicate mapkey names
3. **Verify**: Should see warning underlines

### Task 3: Improve Parser Accuracy

Example: Better handle line continuations

1. **Edit parser.js**:
```javascript
parseCommand() {
  // Improve continuation handling
  while (!this.match('T_SEMICOLON', 'T_EOF')) {
    if (this.match('T_BACKSLASH_EOL')) {
      // More sophisticated handling
      this.advance();
      // Skip whitespace on next line
      while (this.match('T_WHITESPACE')) this.advance();
    }
    // ...
  }
}
```

2. **Test**: Use hover to verify tokens are parsed correctly

---

## 🐛 Debugging Tips

### See What Parser Produces

**Method 1: Use Hover** (Easiest)
- Position cursor over any token
- Press `Shift+K` (Neovim) or hover (VS Code)
- See exact token type and AST node

**Method 2: Add Logging to Server**

```javascript
// In server/server.js
'textDocument/hover': (params) => {
  const ast = parse(doc.text);
  
  // Log to stderr (visible in Neovim lsp.log)
  console.error('Full AST:', JSON.stringify(ast, null, 2));
  
  // Continue with hover...
}
```

Then check: `~/.local/state/nvim/lsp.log`

**Method 3: Standalone Test**

Create `test.js`:
```javascript
const { parse } = require('./src/shared/parser');
const { tokenize } = require('./src/shared/tokenizer');

const code = `mapkey(test) Test Label
~Command test;`;

console.log('Tokens:', tokenize(code));
console.log('AST:', JSON.stringify(parse(code), null, 2));
```

Run: `node test.js`

### Check What Tokens Are Generated

Create `tokenize_test.js`:
```javascript
const { tokenize } = require('./src/shared/tokenizer');

const code = process.argv[2] || 'mapkey(test)';
const tokens = tokenize(code);

tokens.forEach(t => {
  console.log(`${t.type.padEnd(20)} "${t.value}" @ ${t.start}-${t.end}`);
});
```

Run: `node tokenize_test.js "mapkey(test) Label"`

---

## 📊 Understanding the Output

### Token Structure
```javascript
{
  type: 'T_MAPKEY',      // Token type
  value: 'mapkey',       // Actual text
  start: 0,              // Byte offset start
  end: 7,                // Byte offset end
  line: 1,               // Line number
  col: 1                 // Column number
}
```

### AST Node Structure
```javascript
{
  type: 'MapkeyDefinition',
  name: 'test_key',
  directives: [...],     // Array of DirectiveNode/TextNode
  commands: [...],       // Array of CommandNode
  start: 0,              // Byte offset
  end: 45                // Byte offset
}
```

### Hover Shows You Both!

When you press `Shift+K`, you'll see:
1. **Token** at cursor position (from tokenizer)
2. **AST Node** containing cursor (from parser)
3. **Context** about the node

This is PERFECT for development because you can:
- ✅ Verify tokenizer is splitting correctly
- ✅ Verify parser is building correct AST
- ✅ Understand what your code is doing

---

## 🚀 Quick Reference

### Restart LSP After Changes

**Neovim:**
```vim
:LspRestart
```

**VS Code:**
```
Ctrl+Shift+P → "Developer: Reload Window"
```

### Check LSP Status

**Neovim:**
```vim
:LspInfo
:messages
```

**VS Code:**
```
View → Output → Select "Creo LSP"
Help → Toggle Developer Tools → Console
```

### View Logs

**Neovim:**
```bash
tail -f ~/.local/state/nvim/lsp.log
```

**VS Code:**
```
Open Developer Tools (F12) → Console tab
```

---

## 🎯 Next Steps for Development

### Level 1: Improve Tokenizer
- Add more token types
- Handle edge cases
- Better string handling

### Level 2: Enhance Parser
- Parse more constructs
- Better error recovery
- More accurate ranges

### Level 3: Add Features
- Code completion
- Go to definition
- Rename symbol
- Document symbols

### Level 4: Advanced
- Incremental parsing
- Semantic tokens
- Code actions (quick fixes)
- Signature help

---

## 💡 Pro Tips

1. **Use Hover Constantly** - It's your main debugging tool
2. **Test Small Changes** - Don't change everything at once
3. **Keep Backups** - `.bak` files are your friend
4. **Log Liberally** - `console.error()` goes to lsp.log
5. **Start Simple** - Perfect one feature before adding more

---

## ✨ Summary

Your setup is **perfect** for LSP development:

✅ **Easy editing** - Change files directly  
✅ **Instant testing** - Restart and see changes  
✅ **Great debugging** - Enhanced hover shows everything  
✅ **No dependencies** - No build step needed  
✅ **Cross-editor** - Same code works in VS Code and Neovim  

The enhanced hover is your **secret weapon** - it shows you exactly what the tokenizer and parser are doing at any position in the file!
