import * as vscode from 'vscode';
import { tokenize } from '../server/tokenizer';

export class TokenAdapter implements vscode.DocumentSemanticTokensProvider {
  private legend: vscode.SemanticTokensLegend;

  constructor() {
    const tokenTypes = [
      'mapkey.declaration',
      'mapkey.begin',
      'mapkey.name',
      'mapkey.line.begin',
      'mapkey.line.break',
      'mapkey.line.end',
      'mapkey.tag.label',
      'mapkey.tag.description'
    ];

    this.legend = new vscode.SemanticTokensLegend(tokenTypes, []);
  }

  getLegend(): vscode.SemanticTokensLegend {
    return this.legend;
  }

  async provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.SemanticTokens> {
    const text = document.getText();
    const tokens = tokenize(text);

    const builder = new vscode.SemanticTokensBuilder(this.legend);

    for (const t of tokens) {
      const startPos = document.positionAt(t.start);
      const endPos = document.positionAt(t.end);
      const line = startPos.line;
      const char = startPos.character;
      const length = endPos.character - startPos.character;

      const tokenTypeIndex = this.legend.tokenTypes.indexOf(t.type);
      if (tokenTypeIndex === -1) continue; // skip unknown token types

      builder.push(line, char, length, tokenTypeIndex, 0);
    }

    return builder.build();
  }
}
