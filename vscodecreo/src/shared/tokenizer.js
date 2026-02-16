// tokenizer.js
// Minimal forgiving tokenizer for Creo mapkeys. No external libs.
// Edit TOKEN_SPECS to tweak token regexes. Each pattern is a JS regex string (not a RegExp).

/*
Token types proposed:
T_KEYWORD, T_IDENTIFIER, T_DIRECTIVE, T_TILDE, T_SEMICOLON,
T_BACKSLASH_EOL, T_BACKSLASH_EOL_CONT, T_EOF, T_EOL,
T_STRING, T_COMMENT, T_ARG, T_WHITESPACE, T_UNKNOWN
*/

function compileSpecs(specs) {
  // compile each string into RegExp with sticky flag. 'm' used to allow ^ to match start-of-line.
  return specs.map(s => ({
    type: s.type,
    re: new RegExp(s.pattern, 'ym'),
    // optional: whether we want to skip emitting this token in final stream (e.g., whitespace)
    skip: !!s.skip
  }));
}

const TOKEN_SPECS = [
  // Order: more specific first.
  { type: 'T_KEYWORD',      pattern: '\\bmapkey\\b' },
  { type: 'T_DIRECTIVE',    pattern: '@[A-Za-z0-9_\\-\\(\\):]+' }, // e.g., @MAPKEY_LABEL
  { type: 'T_TILDE',        pattern: '~' },
  { type: 'T_SEMICOLON',    pattern: ';' },
  { type: 'T_BACKSLASH_EOL',pattern: '\\\\\\r?\\n' }, // backslash then newline (line continuation)
  // Example combining continuation marker appearing after backslash newline:
  // If you need to match backslash+EOL + a specific "mapkey(continued)" token at start of next line,
  // add a T_BACKSLASH_EOL_CONT with the continuation anchor. Example shown in comment below.
  // { type: 'T_BACKSLASH_EOL_CONT', pattern: '\\\\\\r?\\n^\\s*mapkey\\(continued\\)' },

  { type: 'T_STRING',       pattern: `"(?:\\\\.|[^"\\\\])*"?|'(?:\\\\.|[^'\\\\])*'?` }, // forgiving quotes
  { type: 'T_COMMENT',      pattern: '#.*$' }, // or adjust to // style
  { type: 'T_IDENTIFIER',   pattern: '[A-Za-z0-9_\\-\\+]+(?:\\:[A-Za-z0-9_\\-]+)?' }, // e.g., name or gui:sub
  { type: 'T_WHITESPACE',   pattern: '[ \\t]+' , skip: true},
  { type: 'T_EOL',          pattern: '\\r?\\n' },
  // ARG – fallback chunk until a semicolon or tilde or backslash_EOL or EOL (non-greedy-ish)
  { type: 'T_ARG',          pattern: '[^~;\\\\\\r\\n]+' },
  // Unknown single char fallback
  { type: 'T_UNKNOWN',      pattern: '.' }
];

const COMPILED_SPECS = compileSpecs(TOKEN_SPECS);

function computeLineColFromIndex(text, index) {
  // compute line/col naive: count up to index (fast enough for moderate file sizes)
  const lines = text.slice(0, index).split(/\r?\n/);
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  return { line, col };
}

function tokenize(text) {
  const tokens = [];
  const specs = COMPILED_SPECS;
  let pos = 0;
  const len = text.length;

  while (pos < len) {
    let matched = false;

    for (let i = 0; i < specs.length; ++i) {
      const { type, re, skip } = specs[i];
      re.lastIndex = pos;
      const m = re.exec(text);
      if (!m) continue;
      // ensure match begins exactly at pos (sticky ensures this, but double-check)
      if (m.index !== pos) continue;

      matched = true;
      const value = m[0];
      const start = pos;
      const end = pos + value.length;
      pos = end;

      if (!skip) {
        const loc = computeLineColFromIndex(text, start);
        tokens.push({
          type,
          value,
          start,
          end,
          line: loc.line,
          col: loc.col
        });
      }
      break;
    }

    if (!matched) {
      // Should not happen because T_UNKNOWN matches '.'; but safe fallback:
      const start = pos;
      pos += 1;
      const loc = computeLineColFromIndex(text, start);
      tokens.push({
        type: 'T_UNKNOWN',
        value: text[start],
        start,
        end: pos,
        line: loc.line,
        col: loc.col
      });
    }
  }

  // EOF token
  const loc = computeLineColFromIndex(text, pos);
  tokens.push({ type: 'T_EOF', value: '', start: pos, end: pos, line: loc.line, col: loc.col });
  return tokens;
}

module.exports = { tokenize, TOKEN_SPECS };

