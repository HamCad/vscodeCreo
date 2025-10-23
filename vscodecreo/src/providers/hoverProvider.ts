import * as vscode from 'vscode';
import { tokenize, Token } from '../server/tokenizer';
import { parseMapkeys, getMapkeyAtPosition } from '../server/mapkeyStructure';

export class CreoHoverProvider implements vscode.HoverProvider {

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const text = document.getText();
    const offset = document.offsetAt(position);

    let token: Token | null = null;
    try {
      token = this.getTokenAtOffset(text, offset);
    } catch (err) {
      console.error('Error tokenizing document for hover:', err);
      const md = new vscode.MarkdownString();
      md.appendCodeblock('⚠ Error tokenizing document');
      return new vscode.Hover(md);
    }

    if (!token) {
      // Optionally show info if no token is found
      const md = new vscode.MarkdownString();
      md.appendMarkdown('_No token found at this position_');
      return new vscode.Hover(md, new vscode.Range(position, position));
    }

    // Safety check for invalid token positions
    if (
      token.start < 0 ||
      token.end > text.length ||
      token.end <= token.start
    ) {
      const md = new vscode.MarkdownString();
      md.appendMarkdown('_Token has invalid position_');
      md.appendMarkdown(`\n**Debug:** ${JSON.stringify(token)}`);
      return new vscode.Hover(md, new vscode.Range(position, position));
    }

    const startPos = document.positionAt(token.start);
    const endPos = document.positionAt(token.end);
    const range = new vscode.Range(startPos, endPos);

    const md = new vscode.MarkdownString();
    
    // If hovering over a mapkey-related token, show the full mapkey structure
    if (token.type.startsWith('mapkey.')) {
      const mapkey = getMapkeyAtPosition(text, offset);
      if (mapkey) {
        md.appendMarkdown(`## Mapkey: \`${mapkey.name}\`\n\n`);
        
        if (mapkey.description) {
          md.appendMarkdown(`**Description:** ${mapkey.description}\n\n`);
        }
        
        if (mapkey.label) {
          md.appendMarkdown(`**Label:** ${mapkey.label}\n\n`);
        }
        
        // Show nested mapkeys if any
        if (mapkey.calledMapkeys && mapkey.calledMapkeys.length > 0) {
          md.appendMarkdown(`**Calls:** ${mapkey.calledMapkeys.join(', ')}\n\n`);
        }
        
        md.appendMarkdown(`**Range:** Lines ${document.positionAt(mapkey.range.start).line + 1} - ${document.positionAt(mapkey.range.end).line + 1}\n\n`);
        
        md.appendMarkdown(`---\n\n`);
      }
    }
    
    md.appendCodeblock(token.value, 'plaintext');
    md.appendMarkdown(`\n**Token type:** \`${token.type}\``);
    md.appendMarkdown(`  \nLine: ${startPos.line + 1}, Col: ${startPos.character + 1}`);

    // Debug info commented out
    // const surroundingTokens = this.getTokensAroundOffset(text, offset);
    // if (surroundingTokens.length > 0) {
    //   md.appendMarkdown('\n\n**Nearby tokens (debug):**\n');
    //   surroundingTokens.forEach(t => {
    //     md.appendMarkdown(`- [${t.type}] "${t.value}" (start=${t.start}, end=${t.end})\n`);
    //   });
    // }

    md.isTrusted = true; // allow links if needed

    return new vscode.Hover(md, range);
  }

  private getTokenAtOffset(text: string, offset: number): Token | null {
    const tokens = tokenize(text);
    return tokens.find(t => offset >= t.start && offset < t.end) || null;
  }

  // Commented out for now
  // private getTokensAroundOffset(text: string, offset: number, window: number = 5): Token[] {
  //   const tokens = tokenize(text);
  //   const idx = tokens.findIndex(t => offset >= t.start && offset < t.end);
  //   if (idx === -1) return [];
  //   // Return a window of tokens around the current one
  //   return tokens.slice(Math.max(0, idx - window), Math.min(tokens.length, idx + window + 1));
  // }
}