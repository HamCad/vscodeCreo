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
 * Copy/paste this section to add new tokens.
 */
export const TOKEN_DEFINITIONS: TokenDefinition[] = [
  {
    type: "mapkey.declaration", // the whole "mapkey ..." line
    regex: /^(mapkey\s+)([^;\s]+[^;]*?)/gm,
    groups: [
      { type: "mapkey.begin", index: 1 },
      { type: "mapkey.name", index: 2 },
    ],
  },
  {
    type: "mapkey.line.begin",
    regex: /^mapkey\(continued\)/
  },
  {
    type: "mapkey.line.break",
    regex: /[\\]$/
  },
  {
    type: "mapkey.line.end",
    regex: /\;\\$/
  },
  {
    type: "mapkey.tag.label",
    regex: /(\s@MAPKEY_LABEL)/
  },
  {
    type: "mapkey.tag.description",
    regex: /(\s@MAPKEY_NAME)/
  }
  // Add more token types below as needed
];

/**
 * Step 2: Tokenize input text using all definitions.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];

  for (const def of TOKEN_DEFINITIONS) {
    const { regex, groups } = def as any;
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      // If no subgroup definitions, treat whole match as one token
      if (!groups) {
        tokens.push({
          type: def.type,
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
        continue;
      }

      // Extract defined capture groups as distinct tokens
      for (const g of groups) {
        const value = match[g.index];
        if (!value) continue;
        const start = text.indexOf(value, match.index); // find group offset
        tokens.push({
          type: g.type,
          value,
          start,
          end: start + value.length,
        });
      }
    }
  }

  let result = tokens.sort((a, b) => a.start - b.start);
    result = mergeMultilineMapkeyNames(text, result);
    return result;


  // return tokens.sort((a, b) => a.start - b.start);
}
/**
 * Merge Multiline mapkeys
 */
/**
 * Merge multiline @MAPKEY_NAME tokens
 * -----------------------------------
 * If a description/value continues past a line break (\)
 * until the next line.end token (;\\$), merge them.
 * Also ignore any "mapkey(continued)" tokens found in between.
 */
export function mergeMultilineMapkeyNames(text: string, tokens: Token[]): Token[] {
  const merged: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // Detect start of a @MAPKEY_NAME sequence
    if (token.type === "mapkey.tag.description") {
      let value = token.value;
      let start = token.start;
      let end = token.end;

      // Move forward while lines continue
      while (
        tokens[i + 1] &&
        tokens[i + 1].type === "mapkey.line.break"
      ) {
        // skip the break token
        i++;

        // skip any "mapkey(continued)" markers
        while (
          tokens[i + 1] &&
          tokens[i + 1].type === "mapkey.line.begin"
        ) i++;

        // append until we find line.end
        if (tokens[i + 1] && tokens[i + 1].type !== "mapkey.line.end") {
          i++;
          value += "\n" + tokens[i].value;
          end = tokens[i].end;
        }
      }

      merged.push({ type: token.type, value, start, end });
    } else {
      // keep unchanged
      merged.push(token);
    }

    i++;
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

// export { tokenize, getTokenAtPosition };
