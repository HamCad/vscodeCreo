import * as vscode from 'vscode';
import { TokenAdapter } from './providers/tokenAdapter';
import { CreoHoverProvider } from './providers/hoverProvider';

export function activate(context: vscode.ExtensionContext) {
  const selector: vscode.DocumentSelector = [{ language: 'pro', scheme: 'file' }];

  const tokenizer = new TokenAdapter();

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      selector,
      tokenizer,
      tokenizer.getLegend()
    )
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, new CreoHoverProvider(tokenizer))
  );

  vscode.window.showInformationMessage('Creo Mapkey extension active: LSP tokenizer + hover ready.');
}

export function deactivate() {}
