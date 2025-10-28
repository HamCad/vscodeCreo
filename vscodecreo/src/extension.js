const vscode = require("vscode");
const ProHoverProvider = require("./providers/hoverProvider");
const MapkeyFoldingProvider = require("./providers/foldingProvider");

function activate(context) {
    const selector = [{ language: 'pro', scheme: 'file' }];

    // --- 1. Diagnostics ---


    // --- 2. Language Providers ---
    const providers = [
        // Folding Providers
        vscode.languages.registerFoldingRangeProvider(
            { language: 'pro' },
            new MapkeyFoldingProvider()
        ),
        // Hover Providers
        vscode.languages.registerHoverProvider(
            { language: 'pro' },
            new ProHoverProvider()
        )
    ];

    context.subscriptions.push(...providers);

    // --- 3. Commands ---

    // --- 4. Views ---


    // Information Message
    vscode.window.showInformationMessage('Creo Mapkey extension active: hover ready.');
}

module.exports = { activate }