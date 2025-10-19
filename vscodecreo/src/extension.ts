// src/extension.ts
import * as vscode from 'vscode';
import { MapkeySemanticTokensProvider } from './semanticTokens';

export function activate(context: vscode.ExtensionContext) {
    // Document selector for Creo Mapkey files
    const selector: vscode.DocumentSelector = [
        { language: 'pro', scheme: 'file' },
        { language: 'mapkey', scheme: 'file' }
    ];

    // 1) Register Semantic Tokens Provider
    const semanticProvider = new MapkeySemanticTokensProvider();
    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            selector,
            semanticProvider,
            semanticProvider.getLegend()
        )
    );

    // 2) Register Hover Provider (minimal, shows first token in line as example)
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(selector, {
            provideHover(document, position, token) {
                const lineText = document.lineAt(position.line).text;
                // naive example: highlight first command word in hover
                const match = lineText.match(/(?:^\s*~\s*|^\s*mapkey(?:\(continued\))?\s*)?([A-Za-z_][A-Za-z0-9_]*)/);
                if (match && match[1]) {
                    return new vscode.Hover(`**Mapkey Command:** \`${match[1]}\``);
                }
                return undefined;
            }
        })
    );

    // 3) Optional: Status message on activation
    vscode.window.showInformationMessage('Creo Mapkey extension activated with semantic highlighting.');
}

export function deactivate() {
    // nothing to clean up for now
}
