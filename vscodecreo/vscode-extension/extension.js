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
