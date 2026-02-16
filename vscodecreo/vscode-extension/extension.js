const vscode = require('vscode');

function activate(context) {

    const collection = vscode.languages.createDiagnosticCollection('creo');
    context.subscriptions.push(collection);

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId !== 'creo') return;
            validate(event.document, collection);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            if (document.languageId !== 'creo') return;
            validate(document, collection);
        })
    );
}

function validate(document, collection) {
    const diagnostics = [];
    const text = document.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('TODO')) {
            const range = new vscode.Range(i, 0, i, lines[i].length);
            const diagnostic = new vscode.Diagnostic(
                range,
                'Found TODO',
                vscode.DiagnosticSeverity.Warning
            );
            diagnostics.push(diagnostic);
        }
    }

    collection.set(document.uri, diagnostics);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};

