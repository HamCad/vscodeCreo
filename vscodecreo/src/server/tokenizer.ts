/**
 * Master Tokenizer for LSP
 * ------------------------
 * This defines all tokens used throughout your language server.
 * Each token includes a unique name and a regex.
 */

export interface TokenDefinition {
  type: string;
  regex: RegExp;
  groups?: { type: string; index: number }[];
}

export interface Token {
  type: string;
  value: string;
  start: number;
  end: number;
}

/**
 * Step 1: Define your tokens here.
 */
export const TOKEN_DEFINITIONS: TokenDefinition[] = [
  {
    type: "mapkey.begin",
    regex: /^mapkey\s+/gm,
  },
  {
    type: "mapkey.name",
    // Captures the mapkey name (everything between "mapkey " and first whitespace/semicolon)
    regex: /^mapkey\s+([^\s;]+)/gm,
    groups: [
      { type: "mapkey.name", index: 1 },
    ],
  },
  {
    type: "mapkey.line.begin",
    regex: /^mapkey\(continued\)/gm,
  },
  {
    type: "mapkey.line.break",
    regex: /\\$/gm,
  },
  {
    type: "mapkey.line.end",
    regex: /;\\$/gm,
  },
  {
    type: "mapkey.tag.label",
    regex: /@MAPKEY_LABEL/g,
  },
  {
    type: "mapkey.tag.description",
    regex: /@MAPKEY_NAME/g,
  },
  {
    type: "comment.line",
    regex: /!.*$/gm,
  }
];

/**
 * Step 2: Tokenize input text using all definitions.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];

  for (const def of TOKEN_DEFINITIONS) {
    // Create a fresh regex each time to avoid lastIndex issues
    const regex = new RegExp(def.regex.source, def.regex.flags);
    const { groups } = def;
    
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      // If no groups, treat whole match as one token
      if (!groups) {
        const start = match.index;
        const end = start + match[0].length;

        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

        tokens.push({ type: def.type, value: match[0], start, end });
        continue;
      }

      // Process capture groups
      for (const g of groups) {
        const value = match[g.index];
        if (!value) continue;

        // Calculate position based on the match position and the substring
        // This is more reliable than indexOf
        const groupStart = match.index + match[0].indexOf(value);
        const groupEnd = groupStart + value.length;

        if (!Number.isFinite(groupStart) || !Number.isFinite(groupEnd) || groupEnd <= groupStart) continue;

        tokens.push({ type: g.type, value, start: groupStart, end: groupEnd });
      }
    }
  }

  // Sort tokens by position
  let result = tokens.sort((a, b) => a.start - b.start);
  
  // Merge multiline descriptions
  result = mergeMultilineMapkeyNames(text, result);
  
  return result;
}

/**
 * Merge multiline @MAPKEY_NAME tokens
 * -----------------------------------
 * If a description continues past a line break (\)
 * until the next line.end token (;\\$), merge them.
 */
export function mergeMultilineMapkeyNames(text: string, tokens: Token[]): Token[] {
  const merged: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // Only merge description tokens
    if (token.type === "mapkey.tag.description") {
      let start = token.start;
      let end = token.end;
      
      // Find the end of this line
      let lineEnd = text.indexOf('\n', end);
      if (lineEnd === -1) lineEnd = text.length;
      
      // Get content from @MAPKEY_NAME to end of line
      let value = text.substring(start, lineEnd).trim();
      let currentEnd = lineEnd;
      
      // Check if line ends with backslash (continuation)
      let j = i + 1;
      while (currentEnd < text.length && text.substring(Math.max(0, currentEnd - 2), currentEnd).includes('\\')) {
        // Find next line start
        let nextLineStart = currentEnd + 1;
        
        // Skip "mapkey(continued)" if present
        const continuedMatch = text.substring(nextLineStart).match(/^mapkey\(continued\)\s*/);
        if (continuedMatch) {
          nextLineStart += continuedMatch[0].length;
        }
        
        // Find next line end
        let nextLineEnd = text.indexOf('\n', nextLineStart);
        if (nextLineEnd === -1) nextLineEnd = text.length;
        
        // Check if this line ends with semicolon-backslash (end of description)
        const lineContent = text.substring(nextLineStart, nextLineEnd);
        value += ' ' + lineContent.trim();
        currentEnd = nextLineEnd;
        
        if (lineContent.trim().endsWith(';\\')) {
          break;
        }
      }
      
      // Remove trailing backslashes and semicolons from value
      value = value.replace(/[\\;]+$/g, '').trim();
      
      merged.push({ 
        type: token.type, 
        value, 
        start, 
        end: currentEnd 
      });
      
      // Skip tokens that were merged
      while (j < tokens.length && tokens[j].start < currentEnd) {
        j++;
      }
      i = j;
    } else {
      // Keep other tokens unchanged
      if (
        Number.isFinite(token.start) &&
        Number.isFinite(token.end) &&
        token.start >= 0 &&
        token.end > token.start
      ) {
        merged.push(token);
      }
      i++;
    }
  }

  return merged;
}

/**
 * Step 3: Optional helper for hover or diagnostics.
 */
export function getTokenAtPosition(text: string, position: number): Token | null {
  const tokens = tokenize(text);
  return tokens.find(t => position >= t.start && position < t.end) || null;
}