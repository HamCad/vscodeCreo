import * as vscode from 'vscode';
// import { MapkeySemanticTokensProvider } from './semanticTokenizer';
import { CreoHoverProvider } from './providers/hoverProvider';

export function activate(context: vscode.ExtensionContext) {
    const selector: vscode.DocumentSelector = [
        { language: 'pro', scheme: 'file' }
    ];

    const semanticProvider = new MapkeySemanticTokensProvider();
    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            selector,
            semanticProvider,
            semanticProvider.getLegend()
        )
    );

    // Pass the same tokenizer to HoverProvider
    const hoverProvider = new CreoHoverProvider(semanticProvider);
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(selector, hoverProvider)
    );

    vscode.window.showInformationMessage('Creo Mapkey extension: semantic tokenizer + hover diagnostics active.');
}
