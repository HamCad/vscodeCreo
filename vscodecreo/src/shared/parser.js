// PATCH FOR server/server.js
// Fix: "Method not found: textDocument/diagnostic" error

// Add this handler to the handlers object in server/server.js
// Insert after the 'textDocument/hover' handler

'textDocument/diagnostic': (params) => {
  const { uri } = params.textDocument;
  const doc = getDocument(uri);
  
  if (!doc) {
    return {
      kind: 'full',
      items: []
    };
  }
  
  const diagnostics = [];
  
  try {
    const ast = parse(doc.text);
    
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
  
  return {
    kind: 'full',
    items: diagnostics
  };
},


// COMPLETE UPDATED server.js FILE
// Replace your entire server/server.js with this:

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

  'textDocument/diagnostic': (params) => {
    const { uri } = params.textDocument;
    const doc = getDocument(uri);
    
    if (!doc) {
      return {
        kind: 'full',
        items: []
      };
    }
    
    const diagnostics = [];
    
    try {
      const ast = parse(doc.text);
      
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
    
    return {
      kind: 'full',
      items: diagnostics
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
