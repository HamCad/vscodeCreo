/**
 * Minimal LSP Server
 * ------------------
 * Provides hover info using your tokenizer.
 * Expand later for completions, diagnostics, etc.
 */

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  Hover,
  TextDocumentPositionParams,
  InitializeResult
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { tokenize, getTokenAtPosition } from './tokenizer';

// Create the LSP connection and document manager
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// Log when server starts
connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      hoverProvider: true, // Enable hover feature
    },
  };
});

/**
 * Example: Hover provider powered by tokenizer
 */
connection.onHover((params: TextDocumentPositionParams): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const text = document.getText();
  const offset = document.offsetAt(params.position);
  const token = getTokenAtPosition(text, offset);

  if (!token) return null;

  // Hover content — you can expand this to show metadata, docs, etc.
  return {
    contents: {
      kind: 'markdown',
      value: `**Token Type:** ${token.type}\n\n\`${token.value}\``,
    },
  };
});

// Listen to open/change/close events
documents.listen(connection);
connection.listen();
