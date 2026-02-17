# Complete Audit and Fixes for Creo LSP Extension

## Executive Summary

Your architecture has **CRITICAL ISSUES** that will prevent it from working:

1. ❌ **server.js uses `vscode-languageserver`** (external dependency - BLOCKED)
2. ❌ **server/package.json declares dependency** on vscode-languageserver
3. ❌ **extension.js doesn't spawn LSP server** (missing client implementation)
4. ❌ **Language ID mismatch**: extension.js uses `'creo'`, package.json uses `'pro'`
5. ❌ **Wrong extension.js path** in vscode-extension/package.json
6. ❌ **Nvim config uses wrong language ID** (`'mylang'` instead of `'pro'`)
7. ❌ **setup_links.sh references wrong directories**
8. ⚠️  **Parser not implemented** - only tokenizer exists

---

## CRITICAL FIXES REQUIRED

### 1. server/server.js - COMPLETE REWRITE NEEDED

**Current Issues:**
- Lines 3, 67: Imports `vscode-languageserver` (FORBIDDEN)
- Lines 5-6, 70: Uses TextDocuments helper (unavailable)
- Lines 33, 103: Uses DiagnosticSeverity enum (unavailable)
- Must implement raw JSON-RPC over stdio

**REPLACEMENT FILE:**

```javascript
// server/server.js
// Zero-dependency LSP server using raw JSON-RPC over stdio
// Compatible with both VS Code (manual spawn) and Neovim (lspconfig)

const path = require('path');
const { parse } = require(path.join(__dirname, '..', 'src', 'shared', 'parser'));

// --- JSON-RPC Message Handling ---

let buffer = '';
const contentLengthRegex = /Content-Length: (\d+)\r\n\r\n/;

process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();
  
  while (true) {
    const match = contentLengthRegex.exec(buffer);
    if (!match) break;
    
    const contentLength = parseInt(match[1], 10);
    const messageStart = match.index + match[0].length;
    
    if (buffer.length < messageStart + contentLength) break;
    
    const messageContent = buffer.slice(messageStart, messageStart + contentLength);
    buffer = buffer.slice(messageStart + contentLength);
    
    try {
      const message = JSON.parse(messageContent);
      handleMessage(message);
    } catch (err) {
      console.error('JSON parse error:', err);
    }
  }
});

function sendMessage(message) {
  const content = JSON.stringify(message);
  const header = `Content-Length: ${Buffer.byteLength(content, 'utf8')}\r\n\r\n`;
  process.stdout.write(header + content, 'utf8');
}

function sendResponse(id, result) {
  sendMessage({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message) {
  sendMessage({ jsonrpc: '2.0', id, error: { code, message } });
}

function sendNotification(method, params) {
  sendMessage({ jsonrpc: '2.0', method, params });
}

// --- Document Management ---

const documents = new Map(); // uri -> { text, version }

function getDocument(uri) {
  return documents.get(uri);
}

function setDocument(uri, text, version) {
  documents.set(uri, { text, version });
}

// --- Message Handlers ---

const handlers = {
  initialize: (params) => {
    return {
      capabilities: {
        textDocumentSync: {
          openClose: true,
          change: 1, // Full sync
          save: { includeText: false }
        },
        hoverProvider: true,
        diagnosticProvider: {
          interFileDependencies: false,
          workspaceDiagnostics: false
        }
      },
      serverInfo: {
        name: 'creo-lsp-server',
        version: '0.1.0'
      }
    };
  },

  'textDocument/didOpen': (params) => {
    const { uri, text, version } = params.textDocument;
    setDocument(uri, text, version);
    validateDocument(uri, text);
  },

  'textDocument/didChange': (params) => {
    const { uri, version } = params.textDocument;
    const text = params.contentChanges[0].text; // Full sync
    setDocument(uri, text, version);
    validateDocument(uri, text);
  },

  'textDocument/didClose': (params) => {
    const { uri } = params.textDocument;
    documents.delete(uri);
    sendNotification('textDocument/publishDiagnostics', { uri, diagnostics: [] });
  },

  'textDocument/hover': (params) => {
    const { uri, position } = params.textDocument;
    const doc = getDocument(uri);
    
    if (!doc) {
      return null;
    }

    // Simple hover implementation
    return {
      contents: {
        kind: 'markdown',
        value: `**Creo LSP Server**\n\nLine: ${position.line}, Character: ${position.character}`
      }
    };
  },

  shutdown: () => {
    return null;
  },

  exit: () => {
    process.exit(0);
  }
};

function handleMessage(message) {
  const { id, method, params } = message;

  if (!method) {
    console.error('Message missing method:', message);
    return;
  }

  const handler = handlers[method];
  
  if (!handler) {
    // Unknown method - send error if request, ignore if notification
    if (id !== undefined && id !== null) {
      sendError(id, -32601, `Method not found: ${method}`);
    }
    return;
  }

  try {
    const result = handler(params);
    
    // Only send response for requests (have id), not notifications
    if (id !== undefined && id !== null) {
      sendResponse(id, result);
    }
  } catch (err) {
    console.error(`Error handling ${method}:`, err);
    if (id !== undefined && id !== null) {
      sendError(id, -32603, err.message);
    }
  }
}

// --- Validation Logic ---

function validateDocument(uri, text) {
  const diagnostics = [];
  
  try {
    const ast = parse(text);
    
    // Walk AST and collect diagnostics
    function traverse(node) {
      if (!node) return;
      
      if (node.type === 'MapkeyFile') {
        node.mapkeys.forEach(traverse);
      } else if (node.type === 'MapkeyDefinition') {
        // Example: warn if mapkey has no name
        if (!node.name) {
          diagnostics.push({
            severity: 2, // Warning
            range: {
              start: { line: 0, character: node.start },
              end: { line: 0, character: node.end }
            },
            message: 'Mapkey definition missing name',
            source: 'creo-lsp'
          });
        }
        node.directives.forEach(traverse);
        node.commands.forEach(traverse);
      } else if (node.type === 'CommandNode') {
        // Example: warn if command type is unknown
        if (node.commandType === 'unknown' && node.rawText.length > 0) {
          diagnostics.push({
            severity: 3, // Info
            range: {
              start: { line: 0, character: node.start },
              end: { line: 0, character: node.end }
            },
            message: `Unknown command type: ${node.rawText.substring(0, 30)}...`,
            source: 'creo-lsp'
          });
        }
      }
    }
    
    traverse(ast);
    
  } catch (parseError) {
    // Parser error - add diagnostic
    diagnostics.push({
      severity: 1, // Error
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 10 }
      },
      message: `Parse error: ${parseError.message}`,
      source: 'creo-lsp'
    });
  }
  
  sendNotification('textDocument/publishDiagnostics', { uri, diagnostics });
}

// --- Startup ---

console.error('Creo LSP Server starting...');
```

---

### 2. server/package.json - REMOVE DEPENDENCY

**Current Issues:**
- Lines 6-8: Declares `vscode-languageserver` dependency (FORBIDDEN)

**REPLACEMENT:**

```json
{
  "name": "creo-lsp-server",
  "version": "0.1.0",
  "main": "server.js",
  "license": "MIT",
  "scripts": {
    "start": "node server.js"
  }
}
```

---

### 3. vscode-extension/extension.js - IMPLEMENT LSP CLIENT

**Current Issues:**
- Lines 1-48: Only validates TODO comments (doesn't use parser or LSP)
- Line 10, 17: Uses wrong language ID `'creo'` (should be `'pro'`)
- Missing LSP client implementation

**REPLACEMENT:**

```javascript
// vscode-extension/extension.js
const vscode = require('vscode');
const path = require('path');
const { spawn } = require('child_process');

let serverProcess = null;
let messageId = 0;
let pendingRequests = new Map();
let diagnosticsCollection = null;

function activate(context) {
  console.log('Creo extension activating...');
  
  diagnosticsCollection = vscode.languages.createDiagnosticCollection('pro');
  context.subscriptions.push(diagnosticsCollection);

  // Start LSP server
  const serverPath = path.join(__dirname, '..', 'server', 'server.js');
  startServer(serverPath);

  // Register hover provider
  const hoverProvider = vscode.languages.registerHoverProvider('pro', {
    async provideHover(document, position) {
      const result = await sendRequest('textDocument/hover', {
        textDocument: { uri: document.uri.toString() },
        position: { line: position.line, character: position.character }
      });
      
      if (result && result.contents) {
        return new vscode.Hover(result.contents.value);
      }
      return null;
    }
  });
  context.subscriptions.push(hoverProvider);

  // Document lifecycle handlers
  vscode.workspace.onDidOpenTextDocument(handleDocumentOpen);
  vscode.workspace.onDidChangeTextDocument(handleDocumentChange);
  vscode.workspace.onDidCloseTextDocument(handleDocumentClose);

  // Open already-active documents
  vscode.workspace.textDocuments.forEach(handleDocumentOpen);

  context.subscriptions.push({
    dispose: () => {
      if (serverProcess) {
        sendNotification('shutdown', {});
        sendNotification('exit', {});
        serverProcess.kill();
      }
    }
  });
}

function startServer(serverPath) {
  serverProcess = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let buffer = '';
  const contentLengthRegex = /Content-Length: (\d+)\r\n\r\n/;

  serverProcess.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    
    while (true) {
      const match = contentLengthRegex.exec(buffer);
      if (!match) break;
      
      const contentLength = parseInt(match[1], 10);
      const messageStart = match.index + match[0].length;
      
      if (buffer.length < messageStart + contentLength) break;
      
      const messageContent = buffer.slice(messageStart, messageStart + contentLength);
      buffer = buffer.slice(messageStart + contentLength);
      
      try {
        const message = JSON.parse(messageContent);
        handleServerMessage(message);
      } catch (err) {
        console.error('JSON parse error:', err);
      }
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error('Server stderr:', data.toString());
  });

  serverProcess.on('exit', (code) => {
    console.error(`Server exited with code ${code}`);
    serverProcess = null;
  });

  // Send initialize request
  sendRequest('initialize', {
    processId: process.pid,
    rootUri: vscode.workspace.workspaceFolders?.[0]?.uri.toString() || null,
    capabilities: {}
  }).then(() => {
    sendNotification('initialized', {});
  });
}

function sendMessage(message) {
  if (!serverProcess) return;
  
  const content = JSON.stringify(message);
  const header = `Content-Length: ${Buffer.byteLength(content, 'utf8')}\r\n\r\n`;
  serverProcess.stdin.write(header + content, 'utf8');
}

function sendRequest(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pendingRequests.set(id, { resolve, reject });
    sendMessage({ jsonrpc: '2.0', id, method, params });
  });
}

function sendNotification(method, params) {
  sendMessage({ jsonrpc: '2.0', method, params });
}

function handleServerMessage(message) {
  if (message.id) {
    // Response
    const pending = pendingRequests.get(message.id);
    if (pending) {
      pendingRequests.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
    }
  } else if (message.method) {
    // Notification from server
    if (message.method === 'textDocument/publishDiagnostics') {
      handleDiagnostics(message.params);
    }
  }
}

function handleDiagnostics(params) {
  const { uri, diagnostics } = params;
  const vscodeDiagnostics = diagnostics.map(d => {
    const range = new vscode.Range(
      d.range.start.line,
      d.range.start.character,
      d.range.end.line,
      d.range.end.character
    );
    const severity = d.severity === 1 ? vscode.DiagnosticSeverity.Error :
                     d.severity === 2 ? vscode.DiagnosticSeverity.Warning :
                     d.severity === 3 ? vscode.DiagnosticSeverity.Information :
                     vscode.DiagnosticSeverity.Hint;
    return new vscode.Diagnostic(range, d.message, severity);
  });
  
  diagnosticsCollection.set(vscode.Uri.parse(uri), vscodeDiagnostics);
}

function handleDocumentOpen(document) {
  if (document.languageId !== 'pro') return;
  
  sendNotification('textDocument/didOpen', {
    textDocument: {
      uri: document.uri.toString(),
      languageId: document.languageId,
      version: document.version,
      text: document.getText()
    }
  });
}

function handleDocumentChange(event) {
  if (event.document.languageId !== 'pro') return;
  
  sendNotification('textDocument/didChange', {
    textDocument: {
      uri: event.document.uri.toString(),
      version: event.document.version
    },
    contentChanges: [{
      text: event.document.getText()
    }]
  });
}

function handleDocumentClose(document) {
  if (document.languageId !== 'pro') return;
  
  sendNotification('textDocument/didClose', {
    textDocument: {
      uri: document.uri.toString()
    }
  });
}

function deactivate() {
  if (serverProcess) {
    sendNotification('shutdown', {});
    sendNotification('exit', {});
    serverProcess.kill();
  }
}

module.exports = {
  activate,
  deactivate
};
```

---

### 4. vscode-extension/package.json - FIX MAIN PATH

**Current Issues:**
- Line 12: Points to `./src/extension.js` (wrong path - should be `./extension.js`)

**FIX:**
```json
Line 12: Change from:
  "main": "./src/extension.js",
To:
  "main": "./extension.js",
```

---

### 5. nvim/lua/creo_lsp.lua - FIX LANGUAGE ID

**Current Issues:**
- Line 11, 14, 19, 44: Uses `'mylang'` (should be `'pro'`)

**REPLACEMENT:**

```lua
-- nvim/lua/creo_lsp.lua
-- Neovim LSP configuration for Creo .pro files
-- Usage: require('creo_lsp').setup('/absolute/path/to/repo/server/server.js')

local M = {}

function M.setup(server_path)
  local lspconfig = require('lspconfig')
  
  if not server_path then
    server_path = vim.fn.expand('~') .. '/path/to/repo/server/server.js'
    vim.notify('Warning: using default server path: ' .. server_path, vim.log.levels.WARN)
  end
  
  -- Define custom LSP config for 'pro' language
  local configs = require('lspconfig.configs')
  
  if not configs.creo_lsp then
    configs.creo_lsp = {
      default_config = {
        cmd = { 'node', server_path },
        filetypes = { 'pro' },
        root_dir = lspconfig.util.root_pattern('.git', '.'),
        settings = {},
        name = 'creo_lsp'
      }
    }
  end
  
  lspconfig.creo_lsp.setup({
    on_attach = function(client, bufnr)
      vim.notify('Creo LSP attached to buffer ' .. bufnr, vim.log.levels.INFO)
    end
  })
  
  vim.notify('Creo LSP configured for filetype "pro"', vim.log.levels.INFO)
end

return M
```

---

### 6. setup_links.sh - FIX DIRECTORY REFERENCES

**Current Issues:**
- Line 22: References `"$REPO_DIR/creo-vscode"` (doesn't exist - should be `vscode-extension`)
- Line 25: References `"$REPO_DIR/nvim/creo.lua"` (file is `creo_lsp.lua`)

**REPLACEMENT:**

```bash
#!/usr/bin/env bash
# setup_links.sh
# Creates symlinks for development on Arch Linux with Neovim

set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VSCODE_EXT_DIR="$HOME/.vscode/extensions/creo-lsp-local"
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
```

---

### 7. src/shared/parser.js - IMPLEMENT PARSER

**Current Issue:**
- File doesn't exist! Only tokenizer exists.

**CREATE NEW FILE:**

```javascript
// src/shared/parser.js
// Parser for Creo mapkey .pro files
// Uses tokenizer.js and ast.js

const { tokenize } = require('./tokenizer');
const {
  MapkeyFile,
  MapkeyDefinition,
  DirectiveNode,
  TextNode,
  CommandNode
} = require('./ast');

/**
 * Parse Creo .pro file text into AST
 * @param {string} text - Source code
 * @returns {MapkeyFile} Root AST node
 */
function parse(text) {
  const tokens = tokenize(text);
  const parser = new Parser(tokens);
  return parser.parseFile();
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  current() {
    return this.tokens[this.pos];
  }

  peek(offset = 1) {
    return this.tokens[this.pos + offset];
  }

  advance() {
    if (this.pos < this.tokens.length - 1) {
      this.pos++;
    }
    return this.current();
  }

  consume(type) {
    const tok = this.current();
    if (tok.type !== type) {
      throw new Error(`Expected ${type} but got ${tok.type} at position ${tok.start}`);
    }
    this.advance();
    return tok;
  }

  match(...types) {
    return types.includes(this.current().type);
  }

  parseFile() {
    const file = new MapkeyFile();
    
    while (!this.match('T_EOF')) {
      // Skip comments and empty lines
      if (this.match('T_COMMENT', 'T_EOL')) {
        this.advance();
        continue;
      }
      
      // Parse mapkey definition
      if (this.match('T_MAPKEY')) {
        const mapkey = this.parseMapkey();
        file.addMapkey(mapkey);
      } else {
        // Skip unknown content
        this.advance();
      }
    }
    
    return file;
  }

  parseMapkey() {
    const startTok = this.consume('T_MAPKEY');
    const mapkey = new MapkeyDefinition(startTok.start);
    
    // Expect opening parenthesis
    if (!this.match('T_LPAREN')) {
      throw new Error(`Expected '(' after 'mapkey' at position ${this.current().start}`);
    }
    this.advance();
    
    // Parse mapkey name (optional - could be continued line)
    if (this.match('T_IDENTIFIER', 'T_STRING')) {
      const nameTok = this.current();
      mapkey.setName(nameTok.value, nameTok.start, nameTok.end);
      this.advance();
    }
    
    // Parse optional label/description
    while (this.match('T_IDENTIFIER', 'T_STRING', 'T_ARG')) {
      const tok = this.current();
      mapkey.addDirective(new TextNode(tok.value, tok.start, tok.end));
      this.advance();
    }
    
    // Expect closing parenthesis
    if (this.match('T_RPAREN')) {
      this.advance();
    }
    
    // Parse directives (@MAPKEY_NAME, @SYSTEM, etc.)
    while (this.match('T_DIRECTIVE')) {
      const tok = this.current();
      mapkey.addDirective(new DirectiveNode(tok.value, tok.start, tok.end));
      this.advance();
    }
    
    // Skip EOL
    if (this.match('T_EOL')) {
      this.advance();
    }
    
    // Parse commands (lines starting with ~)
    while (this.match('T_TILDE')) {
      const cmd = this.parseCommand();
      mapkey.addCommand(cmd);
    }
    
    return mapkey;
  }

  parseCommand() {
    const startTok = this.consume('T_TILDE');
    const cmd = new CommandNode(startTok.start);
    
    // Collect all parts until semicolon or EOF
    while (!this.match('T_SEMICOLON', 'T_EOF', 'T_MAPKEY')) {
      // Handle line continuations
      if (this.match('T_BACKSLASH_EOL')) {
        const tok = this.current();
        cmd.addPart(tok);
        this.advance();
        continue;
      }
      
      // Skip standalone EOL (end of command)
      if (this.match('T_EOL')) {
        break;
      }
      
      // Add token to command
      const tok = this.current();
      cmd.addPart(tok);
      this.advance();
    }
    
    // Consume semicolon if present
    if (this.match('T_SEMICOLON')) {
      const tok = this.current();
      cmd.addPart(tok);
      this.advance();
    }
    
    // Skip trailing EOL
    if (this.match('T_EOL')) {
      this.advance();
    }
    
    cmd.finalize();
    return cmd;
  }
}

module.exports = { parse };
```

---

## VERIFICATION CHECKLIST

After applying all fixes:

### File Structure
```
repo/
├── nvim/
│   └── lua/
│       └── creo_lsp.lua          ✓ Fixed language ID
├── server/
│   ├── package.json              ✓ Zero dependencies
│   └── server.js                 ✓ Raw JSON-RPC implementation
├── src/
│   └── shared/
│       ├── ast.js                ✓ Exists (provided)
│       ├── parser.js             ✓ NEW - Must create
│       └── tokenizer.js          ✓ Exists (provided)
├── vscode-extension/
│   ├── extension.js              ✓ LSP client implementation
│   ├── language-configuration.json ✓ Correct
│   ├── package.json              ✓ Fixed main path
│   └── syntaxes/
│       └── pro.tmLanguage.json   ✓ Correct
├── setup_links.sh                ✓ Fixed paths
└── README.md
```

### Language ID Consistency
- ✓ All files use `'pro'` as language ID
- ✓ File extension is `.pro`
- ✓ Scope name is `source.pro`

### Dependency Verification
- ✓ server/server.js: Only built-in Node modules
- ✓ server/package.json: Zero dependencies
- ✓ vscode-extension/extension.js: Only VS Code API + built-in modules
- ✓ No `node_modules` required

### Path Resolution
- ✓ server.js → `require('../src/shared/parser')` ✓ Resolves
- ✓ extension.js → `path.join(__dirname, '..', 'server', 'server.js')` ✓ Resolves
- ✓ parser.js → `require('./tokenizer')` ✓ Resolves
- ✓ parser.js → `require('./ast')` ✓ Resolves

### Windows Deployment Ready
Copy these directories to Windows machine:
```
%USERPROFILE%\.vscode\extensions\creo-lsp-local\
├── vscode-extension\ (all files)
├── server\ (all files)
└── src\shared\ (all files)
```

### Neovim Configuration
Add to `~/.config/nvim/init.lua`:
```lua
require('creo_lsp').setup('/absolute/path/to/repo/server/server.js')
```

---

## SUMMARY OF CHANGES

| File | Changes | Status |
|------|---------|--------|
| server/server.js | Complete rewrite - raw JSON-RPC | ✓ CRITICAL |
| server/package.json | Remove dependencies | ✓ CRITICAL |
| vscode-extension/extension.js | Implement LSP client | ✓ CRITICAL |
| vscode-extension/package.json | Fix main path | ✓ REQUIRED |
| nvim/lua/creo_lsp.lua | Fix language ID | ✓ REQUIRED |
| setup_links.sh | Fix directory paths | ✓ REQUIRED |
| src/shared/parser.js | Create new file | ✓ CRITICAL |

---

## TESTING PROCEDURE

### 1. Linux Development Testing
```bash
cd /path/to/repo
./setup_links.sh
code .  # Test in VS Code
nvim test.pro  # Test in Neovim
```

### 2. Windows Deployment Testing
```cmd
xcopy vscode-extension %USERPROFILE%\.vscode\extensions\creo-lsp-local\ /E /I /Y
xcopy server %USERPROFILE%\.vscode\extensions\creo-lsp-local\server\ /E /I /Y
xcopy src %USERPROFILE%\.vscode\extensions\creo-lsp-local\src\ /E /I /Y
```

Open VS Code, create test.pro file, verify:
- Syntax highlighting works
- Diagnostics appear
- Hover works
- No errors in Output → Creo LSP

---

## FUTURE ENHANCEMENTS

1. **Completion Provider**: Add to server.js capabilities
2. **Go to Definition**: Track mapkey definitions
3. **Semantic Tokens**: More detailed syntax coloring
4. **Code Actions**: Quick fixes for common issues
5. **Document Symbols**: Outline view
6. **Formatting**: Auto-format .pro files
