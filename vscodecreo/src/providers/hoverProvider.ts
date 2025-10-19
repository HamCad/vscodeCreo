import * as vscode from 'vscode';
import { MapkeySemanticTokensProvider } from '../semanticTokenizer';

export class CreoHoverProvider implements vscode.HoverProvider {
    private tokenizer: MapkeySemanticTokensProvider;

    constructor(tokenizer: MapkeySemanticTokensProvider) {
        this.tokenizer = tokenizer;
    }

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
        // Get all tokens for the document
        const semanticTokens = await this.tokenizer.provideDocumentSemanticTokens(document, token);

        if (!semanticTokens) return null;

        const legend = this.tokenizer.getLegend();
        const tokenData = semanticTokens.data;

        // Decode semantic token data: [line, char, length, tokenTypeIndex, modifierSet]
        let currentLine = 0;
        let currentChar = 0;

        for (let i = 0; i < tokenData.length; i += 5) {
            currentLine += tokenData[i];
            if (tokenData[i] === 0) {
                currentChar += tokenData[i + 1];
            } else {
                currentChar = tokenData[i + 1];
            }

            const length = tokenData[i + 2];
            const tokenTypeIndex = tokenData[i + 3];
            const modifierSet = tokenData[i + 4];
            const tokenType = legend.tokenTypes[tokenTypeIndex];
            const tokenModifiers = this._decodeModifiers(legend.tokenModifiers, modifierSet);

            const start = new vscode.Position(currentLine, currentChar);
            const end = new vscode.Position(currentLine, currentChar + length);
            const range = new vscode.Range(start, end);

            if (range.contains(position)) {
                const tokenText = document.getText(range);
                const hoverMessage = new vscode.MarkdownString();

                hoverMessage.appendCodeblock(
                    `${tokenText}`,
                    'plaintext'
                );

                hoverMessage.appendMarkdown(`**Semantic Token Info:**\n`);
                hoverMessage.appendMarkdown(`- Type: \`${tokenType}\`\n`);
                hoverMessage.appendMarkdown(`- Modifiers: \`${tokenModifiers.join(', ') || 'none'}\`\n`);
                hoverMessage.appendMarkdown(`- Range: line ${currentLine}, char ${currentChar}, len ${length}\n`);

                return new vscode.Hover(hoverMessage, range);
            }
        }

        return null;
    }

    private _decodeModifiers(allModifiers: string[], modifierSet: number): string[] {
        const result: string[] = [];
        for (let i = 0; i < allModifiers.length; i++) {
            if (modifierSet & (1 << i)) {
                result.push(allModifiers[i]);
            }
        }
        return result;
    }
}
