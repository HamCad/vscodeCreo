import * as vscode from 'vscode';
import { CreoHoverProvider } from './providers/hoverProvider';

export function activate(context: vscode.ExtensionContext) {
  const selector: vscode.DocumentSelector = [{ language: 'pro', scheme: 'file' }];

  // Register hover provider only
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, new CreoHoverProvider())
  );

  vscode.window.showInformationMessage('Creo Mapkey extension active: hover ready.');
}

export function deactivate() {}
