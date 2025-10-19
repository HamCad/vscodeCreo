// src/semanticTokens.ts
import * as vscode from 'vscode';

const TOKEN_TYPES = [
  'keyword',     // mapkey, directives like %Z-RESETFIND
  'function',    // commands starting with ProCmd..., or UI actions interpreted as functions
  'variable',    // backtick identifiers (dialogs, widgets, fields)
  'property',    // named UI element pieces (e.g. EditPanel, Table names)
  'string',      // literal-like backtick contents when considered stringy
  'comment',     // ! comments or star separators
  'number',      // integer numeric values, -1, etc
  'operator',    // operators like ==, ` == ` occurrences
  'namespace',   // mapkey label or name
];

const TOKEN_MODIFIERS: string[] = [
  'declaration', 'readonly'
];

export class MapkeySemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  private legend: vscode.SemanticTokensLegend;
  private typeMap: Map<string, number>;
  private modifierMap: Map<string, number>;

  constructor() {
    this.legend = new vscode.SemanticTokensLegend(TOKEN_TYPES, TOKEN_MODIFIERS);
    this.typeMap = new Map();
    TOKEN_TYPES.forEach((t, i) => this.typeMap.set(t, i));
    this.modifierMap = new Map();
    TOKEN_MODIFIERS.forEach((m, i) => this.modifierMap.set(m, i));
  }

  public getLegend() {
    return this.legend;
  }

  // Helper to compute modifier bitset
  private modifierBits(mods: string[]): number {
    let bits = 0;
    for (const m of mods) {
      const idx = this.modifierMap.get(m);
      if (typeof idx === 'number') bits |= (1 << idx);
    }
    return bits;
  }

  public provideDocumentSemanticTokens(
    document: vscode.TextDocument
  ): vscode.ProviderResult<vscode.SemanticTokens> {
    const builder = new vscode.SemanticTokensBuilder(this.legend);

    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const line = document.lineAt(lineNum);
      const text = line.text;

      // 1) Comments: start with '!' or lines that are just stars/visual separators
      const commentMatch = text.match(/^!.*$/);
      if (commentMatch) {
        builder.push(lineNum, 0, text.length, this.typeMap.get('comment')!, 0);
        continue; // whole line is comment
      }
      if (/^\s*\*{3,}/.test(text)) {
        builder.push(lineNum, 0, text.length, this.typeMap.get('comment')!, 0);
        continue;
      }

      // 2) mapkey / mapkey(continued) / mapkey label lines
      const mapkeyHeader = text.match(/^(mapkey(?:\s|\(|$)|mapkey\(continued\)|^\s*mapkey\()/i);
      if (mapkeyHeader) {
        // highlight the 'mapkey' word
        const mStart = text.search(/mapkey/i);
        if (mStart >= 0) {
          builder.push(lineNum, mStart, 'mapkey'.length, this.typeMap.get('keyword')!, 0);
        }
      }

      // 3) Directive lines beginning with % (e.g. %Z-RESETFIND)
      const directive = text.match(/(^|\s)(%[A-Z0-9_\-]+)\b/);
      if (directive) {
        const idx = text.indexOf(directive[2]);
        builder.push(lineNum, idx, directive[2].length, this.typeMap.get('keyword')!, 0);
      }

      // 4) Mapkey "command verb" — typical pattern: "~ <Command> ..." or after mapkey header
      // We'll look for a command token as the first alpha word after optional "~" or after header
      const cmdMatch = text.match(/(?:^\s*~\s*|^\s*mapkey(?:\(continued\))?\s*[~%]?\s*)?([A-Za-z_][A-Za-z0-9_]*)\b/);
      if (cmdMatch && cmdMatch[1]) {
        // exclude common false positives like 'mapkey' itself
        const cmd = cmdMatch[1];
        const cmdIndex = text.indexOf(cmd);
        // classify as 'function' if looks like ProCmd* or common mapkey verbs as 'function' too
        const isProCmd = /^ProCmd/i.test(cmd);
        const functionCmds = /^(Command|Select|Activate|Open|Close|Input|Update|PopupOver|RButtonArm|Arm|Name|Activate|Update|Popup|Close|Open|Select|Activate|Command|Input)$/i;
        const type = (isProCmd || functionCmds.test(cmd)) ? 'function' : 'property';
        builder.push(lineNum, cmdIndex, cmd.length, this.typeMap.get(type)!, 0);
      }

      // 5) Backtick-enclosed identifiers: `identifier` (can repeat)
      // For each backtick group, decide token type: ProCmd* -> function, otherwise variable/property
      const backtickRegex = /`([^`]+)`/g;
      let bkMatch: RegExpExecArray | null;
      while ((bkMatch = backtickRegex.exec(text))) {
        const full = bkMatch[0];
        const inner = bkMatch[1];
        const start = bkMatch.index;
        // classify heuristically:
        if (/^ProCmd/i.test(inner)) {
          builder.push(lineNum, start, full.length, this.typeMap.get('function')!, 0);
        } else if (/[A-Z][A-Za-z0-9_]*\./.test(inner) || /\b(EditPanel|Table|OptionMenu|Radio|Btn|Dlg|Layout|Panel|node_edit)\b/i.test(inner)) {
          builder.push(lineNum, start, full.length, this.typeMap.get('property')!, 0);
        } else {
          builder.push(lineNum, start, full.length, this.typeMap.get('variable')!, 0);
        }

        // also try to capture numeric suffixes directly after a backtick-identifier (e.g. `Table`2 or `Option`1)
        const after = text.substr(bkMatch.index + full.length);
        const numAfter = after.match(/^\s*([-+]?\d+)/);
        if (numAfter) {
          const numStr = numAfter[1];
          const numStart = start + full.length + after.indexOf(numStr);
          builder.push(lineNum, numStart, numStr.length, this.typeMap.get('number')!, 0);
        }
      }

      // 6) Operators and equality markers (==)
      const opRegex = /(==|!=|<=|>=|[<>]=?|==)/g;
      let opMatch: RegExpExecArray | null;
      while ((opMatch = opRegex.exec(text))) {
        builder.push(lineNum, opMatch.index, opMatch[0].length, this.typeMap.get('operator')!, 0);
      }

      // 7) Inline numeric matches (standalone numbers)
      const numberRegex = /(^|[^\d-])(-?\b\d+\b)/g;
      let numM: RegExpExecArray | null;
      while ((numM = numberRegex.exec(text))) {
        const n = numM[2];
        const idx = numM.index + numM[0].indexOf(n);
        builder.push(lineNum, idx, n.length, this.typeMap.get('number')!, 0);
      }

      // 8) Special case: fields referenced by dot-paths (ExtRulesLayout.ExtBasicNumbLayout.BasicNumberStart)
      const dottedPathRegex = /([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)+)/g;
      let dp: RegExpExecArray | null;
      while ((dp = dottedPathRegex.exec(text))) {
        builder.push(lineNum, dp.index, dp[0].length, this.typeMap.get('property')!, 0);
      }

      // Note: we intentionally do not "consume" matched zones here so multiple token types can overlap
      // (e.g., backtick identifiers plus a numeric suffix). The builder handles multiple pushes.
    }

    return builder.build();
  }
}

// Activation helper to register provider
export function activate(context: vscode.ExtensionContext) {
  const provider = new MapkeySemanticTokensProvider();
  const selector: vscode.DocumentSelector = [{ language: 'pro' }, { language: 'mapkey' }, { scheme: 'file' }];
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      selector,
      provider,
      provider.getLegend()
    )
  );
}

// optional deactivate
export function deactivate() {}
