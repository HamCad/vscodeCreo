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
    type: "mapkey.tag.name",
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
  
  // Add derived tokens (label/description content and mapkey.end)
  result = addDerivedTokens(text, result);
  
  return result;
}

/**
 * Add derived tokens:
 * 1. mapkey.label - content after @MAPKEY_LABEL
 * 2. mapkey.description - content after @MAPKEY_NAME
 * 3. mapkey.end - final semicolon of mapkey definition
 */
export function addDerivedTokens(text: string, tokens: Token[]): Token[] {
  const derived: Token[] = [...tokens];
  
  // Find @MAPKEY_LABEL and @MAPKEY_NAME tags and create content tokens
  for (const token of tokens) {
    if (token.type === "mapkey.tag.label") {
      const contentToken = extractContentAfterTag(text, token, "mapkey.label");
      if (contentToken) derived.push(contentToken);
    } else if (token.type === "mapkey.tag.name") {
      const contentToken = extractContentAfterTag(text, token, "mapkey.description");
      if (contentToken) derived.push(contentToken);
    }
  }
  
  // Add mapkey.end tokens
  const withEnds = addMapkeyEndTokens(text, derived);
  
  return withEnds.sort((a, b) => a.start - b.start);
}

/**
 * Extract content after @MAPKEY_LABEL or @MAPKEY_NAME tag
 */
function extractContentAfterTag(text: string, tagToken: Token, contentType: string): Token | null {
  // Start position is right after the tag
  let start = tagToken.end;
  
  // Find the end of this line
  let lineEnd = text.indexOf('\n', start);
  if (lineEnd === -1) lineEnd = text.length;
  
  // Get content from after tag to end of line
  let content = text.substring(start, lineEnd);
  let currentEnd = lineEnd;
  
  // Check if we hit a semicolon on the first line (before any backslash)
  const firstLineSemicolon = content.indexOf(';');
  if (firstLineSemicolon !== -1) {
    // Stop at the semicolon
    content = content.substring(0, firstLineSemicolon).trim();
    currentEnd = start + firstLineSemicolon;
    
    // Don't create empty tokens
    if (!content) return null;
    
    return { 
      type: contentType, 
      value: content, 
      start: start,
      end: currentEnd 
    };
  }
  
  // Remove trailing backslash from first line
  content = content.replace(/\s*\\$/g, '').trim();
  
  // Check if line ends with backslash (continuation)
  let prevLineEnd = lineEnd;
  while (currentEnd < text.length) {
    // Check if previous line ended with backslash
    const prevLineContent = text.substring(start, prevLineEnd);
    if (!prevLineContent.trim().endsWith('\\')) break;
    
    // Find next line start
    let nextLineStart = currentEnd + 1;
    if (nextLineStart >= text.length) break;
    
    // Skip "mapkey(continued)" if present
    const continuedMatch = text.substring(nextLineStart).match(/^mapkey\(continued\)\s*/);
    if (continuedMatch) {
      nextLineStart += continuedMatch[0].length;
    }
    
    // Find next line end
    let nextLineEnd = text.indexOf('\n', nextLineStart);
    if (nextLineEnd === -1) nextLineEnd = text.length;
    
    // Get line content
    const lineContent = text.substring(nextLineStart, nextLineEnd);
    
    // Check for semicolon in this line (end of content)
    const semicolonPos = lineContent.indexOf(';');
    if (semicolonPos !== -1) {
      // Add content up to semicolon and stop
      const partialLine = lineContent.substring(0, semicolonPos).trim();
      if (partialLine) {
        content += ' ' + partialLine;
      }
      currentEnd = nextLineStart + semicolonPos;
      break;
    }
    
    // No semicolon, add full line (removing trailing backslash)
    const cleanLine = lineContent.replace(/\s*\\$/g, '').trim();
    if (cleanLine) {
      content += ' ' + cleanLine;
    }
    
    prevLineEnd = nextLineEnd;
    currentEnd = nextLineEnd;
  }
  
  // Final cleanup - remove any remaining trailing semicolons or backslashes
  content = content.replace(/[;\\]+$/g, '').trim();
  
  // Don't create empty tokens
  if (!content) return null;
  
  return { 
    type: contentType, 
    value: content, 
    start: start,
    end: currentEnd 
  };
}

/**
 * Add mapkey.end tokens
 * A mapkey.end is the final semicolon of a mapkey definition,
 * which is NOT followed by another mapkey(continued) line.
 */
function addMapkeyEndTokens(text: string, tokens: Token[]): Token[] {
  const result = [...tokens];
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line ends with a semicolon (but not semicolon-backslash)
    const trimmed = line.trim();
    if (!trimmed.endsWith(';') || trimmed.endsWith(';\\')) continue;
    
    // Check if the next non-empty line is NOT a mapkey(continued) or comment continuation
    let isMapkeyEnd = true;
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j].trim();
      
      // Skip empty lines
      if (nextLine === '') continue;
      
      // If next line is mapkey(continued), this is NOT a mapkey.end
      if (nextLine.startsWith('mapkey(continued)')) {
        isMapkeyEnd = false;
        break;
      }
      
      // If next line is a comment ending with ;\, continue checking
      if (nextLine.startsWith('!') && nextLine.endsWith(';\\')) {
        continue;
      }
      
      // Any other non-empty line means this is a mapkey.end
      break;
    }
    
    // If this is the last line, it's definitely a mapkey.end
    if (i === lines.length - 1 && trimmed.endsWith(';')) {
      isMapkeyEnd = true;
    }
    
    if (isMapkeyEnd) {
      // Find the position of the final semicolon
      const lineStart = lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
      const semicolonPos = lineStart + line.lastIndexOf(';');
      
      result.push({
        type: 'mapkey.end',
        value: ';',
        start: semicolonPos,
        end: semicolonPos + 1
      });
    }
  }
  
  return result;
}

/**
 * Step 3: Optional helper for hover or diagnostics.
 */
export function getTokenAtPosition(text: string, position: number): Token | null {
  const tokens = tokenize(text);
  return tokens.find(t => position >= t.start && position < t.end) || null;
}