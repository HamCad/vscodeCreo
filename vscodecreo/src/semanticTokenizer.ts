// src/semanticTokenizer.ts
import * as vscode from 'vscode';

/**
 * Semantic Tokenizer v3.0 - faithful to pro.tmLanguage.json
 *
 * Token type names chosen to be descriptive and close to your tmLanguage scopes:
 * - keyword_control  ~ for 'mapkey' header and @MAPKEY_* directives
 * - markup_bold      ~ for the mapkey names/labels captured in grammar
 * - entity_function  ~ for mapkey(continued) marker lines you had as entity.name.function
 * - storage_modifier  ~ for @MANUAL_PAUSE / @SYSTEM tokens
 * - mapkey_content    ~ for the generic body capture regions
 * plus improved types:
 * - procmd           ~ ProCmd* tokens (special color)
 * - action           ~ Input / Update and their last-target token
 * - identifier       ~ backtick identifiers (default)
 * - property         ~ dotted property paths
 * - string           ~ literal text for manual pause/system messages
 * - number, operator, comment as expected
 */

const TOKEN_TYPES = [
  'keyword_control',  // mapkey header, @MAPKEY_* name/label, % directives
  'markup_bold',      // names/labels captured as bold in tmLanguage
  'entity_function',  // mapkey(continued) marker
  'storage_modifier', // @MANUAL_PAUSE, @SYSTEM
  'mapkey_content',   // general body region
  'procmd',           // ProCmd* (special color)
  'action',           // Input / Update and their target
  'identifier',       // generic `backtick` identifiers
  'property',         // dotted paths like ExtRulesLayout.X
  'string',           // manual pause or quoted paths
  'number',
  'operator',
  'comment'
];

const TOKEN_MODIFIERS: string[] = [];

export class MapkeySemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  private legend: vscode.SemanticTokensLegend;
  private typeMap: Map<string, number>;

  constructor() {
    this.legend = new vscode.SemanticTokensLegend(TOKEN_TYPES, TOKEN_MODIFIERS);
    this.typeMap = new Map();
    TOKEN_TYPES.forEach((t, i) => this.typeMap.set(t, i));
  }

  public getLegend() {
    return this.legend;
  }

  /**
   * Build logical entries by following your TM grammar approach:
   * - lines starting with ^mapkey\s+ or ^mapkey(continued)
   * - continuation lines joined until semicolon terminator ( ; or ;\ )
   *
   * This mirrors your tmLanguage which groups mapkey-body across continuation lines.
   */
  private buildEntries(document: vscode.TextDocument): { text: string; startLine: number }[] {
    const entries: { text: string; startLine: number }[] = [];
    let buffer = '';
    let bufferStart = -1;
    let inBuffer = false;

    // We'll treat any line that begins with 'mapkey' or 'mapkey(continued)' as the start (per your grammar)
    const headerRE = /^\s*mapkey(?:\s+|\(|$)/i;

    for (let i = 0; i < document.lineCount; i++) {
      const raw = document.lineAt(i).text;
      const line = raw.replace(/\r?\n$/, '');

      if (headerRE.test(line)) {
        // start a new buffer if not already buffering
        if (inBuffer) {
          // If previous buffer had no explicit semicolon termination, still push what we had
          entries.push({ text: buffer.trim(), startLine: bufferStart });
        }
        inBuffer = true;
        bufferStart = i;
        buffer = line.trimRight();
      } else if (inBuffer) {
        // continuation: include the line (tmLanguage "while" behavior)
        buffer += ' ' + line.trim();
      } else {
        // ignore non-mapkey lines
      }

      // Check termination: look for a semicolon terminator at end of logical entry
      // tmLanguage used end: ";" with possible escaping; we consider ';' that ends the statement.
      if (inBuffer && /;\s*$/.test(buffer)) {
        entries.push({ text: buffer.trim(), startLine: bufferStart });
        inBuffer = false;
        buffer = '';
        bufferStart = -1;
      }
    }

    // leftover buffer
    if (inBuffer && buffer.trim().length > 0) {
      entries.push({ text: buffer.trim(), startLine: bufferStart });
    }

    return entries;
  }

  // find backtick spans: `...`
  private findBackticks(text: string) {
    const spans: { start: number; end: number; inner: string }[] = [];
    const re = /`([^`]+)`/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      spans.push({ start: m.index, end: m.index + m[0].length, inner: m[1] });
    }
    return spans;
  }

  // helper to push token
  private push(builder: vscode.SemanticTokensBuilder, line: number, char: number, len: number, type: string) {
    const tIdx = this.typeMap.get(type);
    if (tIdx !== undefined) builder.push(line, char, len, tIdx, 0);
  }

  public provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SemanticTokens> {
    const builder = new vscode.SemanticTokensBuilder(this.legend);
    const entries = this.buildEntries(document);

    // Pre-compiled regexes borrowed from your tmLanguage where applicable:
    const mapkeyInitRE = /^(mapkey\s+)([^;\s]+[^;]*?)/i; // begin capture groups
    const mapkeyDefinitionRE = /(@MAPKEY_LABEL|@MAPKEY_NAME)/i;
    const mapkeyContinuedRE = /^mapkey\(continued\)/i;
    const mapkeySysCmdRE = /(@MANUAL_PAUSE|@SYSTEM)/i;
    const percentDirectiveRE = /(%[A-Z0-9_\-]+)/g;

    for (const e of entries) {
      const { text, startLine } = e;

      // 1) mapkey-init: ^(mapkey\s+)(name)
      {
        const m = text.match(mapkeyInitRE);
        if (m) {
          const headerIdx = text.search(/mapkey/i);
          if (headerIdx >= 0) {
            this.push(builder, startLine, headerIdx, m[1].length, 'keyword_control'); // 'mapkey'
          }
          if (m[2]) {
            // the second capture is the name after mapkey (markup.bold)
            const nameIdx = text.indexOf(m[2], headerIdx + m[1].length);
            if (nameIdx >= 0) {
              this.push(builder, startLine, nameIdx, m[2].length, 'markup_bold');
            }
          }
        }
      }

      // 2) mapkey-definition: @MAPKEY_LABEL / @MAPKEY_NAME
      {
        const defMatch = text.match(mapkeyDefinitionRE);
        if (defMatch) {
          const idx = text.indexOf(defMatch[1]);
          if (idx >= 0) {
            this.push(builder, startLine, idx, defMatch[1].length, 'keyword_control');
            // try to capture the following label content (up to semicolon), mark as string-like (markup_bold or string)
            const semi = text.lastIndexOf(';');
            const labelStart = idx + defMatch[1].length;
            if (semi > labelStart) {
              const len = semi - labelStart;
              if (len > 0) this.push(builder, startLine, labelStart, len, 'markup_bold');
            }
          }
        }
      }

      // 3) mapkey(continued) marker
      if (mapkeyContinuedRE.test(text)) {
        const idx = text.search(/mapkey\(continued\)/i);
        if (idx >= 0) this.push(builder, startLine, idx, 'mapkey(continued)'.length, 'entity_function');
      }

      // 4) syscmds like @MANUAL_PAUSE and @SYSTEM
      {
        const sys = text.match(mapkeySysCmdRE);
        if (sys) {
          const idx = text.indexOf(sys[1]);
          this.push(builder, startLine, idx, sys[1].length, 'storage_modifier');

          // For @MANUAL_PAUSE / @SYSTEM: everything after directive until semicolon is literal display string
          if (/^@MANUAL_PAUSE|@SYSTEM$/i.test(sys[1])) {
            const semicolonPos = text.lastIndexOf(';');
            const strStart = idx + sys[1].length;
            const strLen = semicolonPos >= 0 ? semicolonPos - strStart : Math.max(0, text.length - strStart);
            if (strLen > 0) this.push(builder, startLine, strStart, strLen, 'string');
            // done processing this entry's string portion
            // still continue to find other tokens if needed, but we won't treat inner words as commands
          }
        }
      }

      // 5) percent directives
      {
        let pm: RegExpExecArray | null;
        while ((pm = percentDirectiveRE.exec(text))) {
          this.push(builder, startLine, pm.index, pm[1].length, 'keyword_control');
        }
      }

      // 6) mapkey-body handling (use the tmLanguage capture idea):
      // The tmLanguage used: begin "(~\s\w+|(?<=^mapkey\(continued\)\s)`\S+`?)([^;\\]+)(?=;|\\;|\\$)"
      // We'll attempt to locate the "~ <verb>" pattern first and also locate any backtick spans.
      const backticks = this.findBackticks(text);

      // Mark ProCmd backticks first
      for (const bt of backticks) {
        if (/^ProCmd/i.test(bt.inner)) {
          this.push(builder, startLine, bt.start, bt.end - bt.start, 'procmd');
        } else {
          // default identifier marking like tmLanguage markup.bold variant for body
          this.push(builder, startLine, bt.start, bt.end - bt.start, 'identifier');
        }
      }

      // Also mark bare ProCmd words outside backticks
      {
        const bareProCmdRE = /\bProCmd[A-Za-z0-9_]*\b/g;
        let pm: RegExpExecArray | null;
        while ((pm = bareProCmdRE.exec(text))) {
          this.push(builder, startLine, pm.index, pm[0].length, 'procmd');
        }
      }

      // Find the tilde "~ verb" pattern
      const tildeMatch = text.match(/~\s*([A-Za-z_][A-Za-z0-9_]*)\b/);
      if (tildeMatch) {
        const verb = tildeMatch[1];
        const verbIdx = text.indexOf(verb, text.indexOf('~'));
        if (/^(Input|Update)$/i.test(verb)) {
          // mark the action verb
          this.push(builder, startLine, verbIdx, verb.length, 'action');

          // mark last backtick before semicolon as action target (if present)
          if (backticks.length) {
            const last = backticks[backticks.length - 1];
            // ensure it occurs before terminating semicolon for this entry
            const semi = text.lastIndexOf(';');
            if (semi >= 0 && last.start < semi) {
              this.push(builder, startLine, last.start, last.end - last.start, 'action');
            } else {
              // fallback: capture last word before semicolon
              const semiPos = semi >= 0 ? semi : text.length;
              const between = text.slice(verbIdx + verb.length, semiPos);
              const lastWordMatch = between.match(/([^\s`]+)\s*$/);
              if (lastWordMatch) {
                const idx = text.lastIndexOf(lastWordMatch[1]);
                this.push(builder, startLine, idx, lastWordMatch[1].length, 'action');
              }
            }
          } else {
            // no backticks: same fallback as above
            const semi = text.lastIndexOf(';');
            const semiPos = semi >= 0 ? semi : text.length;
            const between = text.slice(verbIdx + verb.length, semiPos);
            const lastWordMatch = between.match(/([^\s`]+)\s*$/);
            if (lastWordMatch) {
              const idx = text.lastIndexOf(lastWordMatch[1]);
              this.push(builder, startLine, idx, lastWordMatch[1].length, 'action');
            }
          }
        } else {
          // mark other verbs as mapkey_content (or identifier)
          this.push(builder, startLine, verbIdx, verb.length, 'mapkey_content');
        }
      }

      // Dotted properties (ExtRulesLayout.*)
      {
        const dottedRE = /\b([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+)\b/g;
        let dm: RegExpExecArray | null;
        while ((dm = dottedRE.exec(text))) {
          this.push(builder, startLine, dm.index, dm[1].length, 'property');
        }
      }

      // numbers
      {
        const numRE = /-?\b\d+\b/g;
        let nm: RegExpExecArray | null;
        while ((nm = numRE.exec(text))) {
          this.push(builder, startLine, nm.index, nm[0].length, 'number');
        }
      }

      // operators
      {
        const opRE = /(==|!=|<=|>=|[<>]=?)/g;
        let om: RegExpExecArray | null;
        while ((om = opRE.exec(text))) {
          this.push(builder, startLine, om.index, om[0].length, 'operator');
        }
      }

      // comment-like visual separators already handled earlier? also handle lines starting with ! just in case
      if (/^!/.test(text) || /^\*{3,}/.test(text)) {
        this.push(builder, startLine, 0, Math.min(text.length, 2000), 'comment');
      }

      // End per-entry loop
    } // entries loop

    return builder.build();
  }
}
