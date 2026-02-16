// server/server.js
const path = require('path');
const { createConnection, ProposedFeatures, TextDocuments, DiagnosticSeverity } = require('vscode-languageserver/node');
const { parse } = require(path.join(__dirname, '..', 'src', 'shared', 'parser'));
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments();

connection.onInitialize((_params) => {
  return {
    capabilities: {
      textDocumentSync: documents.syncKind,
      hoverProvider: true,
      documentSymbolProvider: true
    }
  };
});

documents.onDidChangeContent(change => {
  const text = change.document.getText();
  const program = parse(text);
  // simple diagnostic: flag numeric literal value > 100 as warning
  const diagnostics = [];
  traverse(program);
  connection.sendDiagnostics({ uri: change.document.uri, diagnostics });

  function traverse(node) {
    if (!node) return;
    if (node.type === 'Program') {
      node.body.forEach(traverse);
    } else if (node.type === 'Assignment') {
      if (node.right && node.right.type === 'NumberLiteral' && node.right.value > 100) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: {
            start: { line: 0, character: node.right.range.start },
            end: { line: 0, character: node.right.range.end }
          },
          message: 'Number literal > 100',
          source: 'my-lang'
        });
      }
    }
  }
});

connection.onHover(params => {
  const uri = params.textDocument.uri;
  // simple hover: show the AST node under first char of the range
  return { contents: { kind: 'plaintext', value: 'MyLang server — hover not implemented in detail' } };
});

documents.listen(connection);
connection.listen();

