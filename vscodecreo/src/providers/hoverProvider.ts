import * as vscode from 'vscode';
import { TokenAdapter } from './tokenAdapter';

export class CreoHoverProvider implements vscode.HoverProvider {
  private tokenizer: TokenAdapter;

  constructor(tokenizer: TokenAdapter) {
    this.tokenizer = tokenizer;
  }

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    const semanticTokens = await this.tokenizer.provideDocumentSemanticTokens(document, token);
    if (!semanticTokens) return null;

    const legend = this.tokenizer.getLegend();
    const data = semanticTokens.data;

    let currentLine = 0;
    let currentChar = 0;

    for (let i = 0; i < data.length; i += 5) {
      currentLine += data[i];
      currentChar = data[i] === 0 ? currentChar + data[i + 1] : data[i + 1];
      const length = data[i + 2];
      const tokenTypeIndex = data[i + 3];
      const tokenType = legend.tokenTypes[tokenTypeIndex];

      const start = new vscode.Position(currentLine, currentChar);
      const end = new vscode.Position(currentLine, currentChar + length);
      const range = new vscode.Range(start, end);

      if (range.contains(position)) {
        const tokenText = document.getText(range);
        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.appendCodeblock(tokenText, 'plaintext');
        hoverMessage.appendMarkdown(`**Token:** \`${tokenType}\`\n`);
        hoverMessage.appendMarkdown(`Line: ${currentLine}, Col: ${currentChar}`);

        return new vscode.Hover(hoverMessage, range);
      }
    }

    return null;
  }
}
