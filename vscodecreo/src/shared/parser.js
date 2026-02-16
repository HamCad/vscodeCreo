// parser.js
// A minimal recursive-descent parser that consumes tokens from tokenizer.js
// Produces AST nodes: MapkeyDefinition, DirectiveNode, CommandNode
// Each node has .start, .end offsets and source text where practicable.

const { tokenize } = require('./tokenizer');

// Helper: peek & consume token stream
function makeStream(tokens) {
  let i = 0;
  return {
    peek(n = 0) { return tokens[i + n] || { type: 'T_EOF', value: '', start: tokens[tokens.length - 1].end }; },
    next() { return tokens[i++] || { type: 'T_EOF', value: '', start: tokens[tokens.length - 1].end }; },
    eof() { return i >= tokens.length || tokens[i].type === 'T_EOF'; },
    index() { return i; }
  };
}

// Diagnostic factory
function diag(node, message, severity = 'error') {
  return { node, message, severity };
}

// Parse whole document
function parseTokens(tokens) {
  const stream = makeStream(tokens);
  const ast = { type: 'MapkeyFile', mapkeys: [] };
  const diagnostics = [];

  while (!stream.eof()) {
    const tk = stream.peek();
    if (tk.type === 'T_KEYWORD') {
      const mk = parseMapkey(stream, diagnostics);
      ast.mapkeys.push(mk);
      continue;
    }
    // skip tokens until keyword or EOF to recover
    stream.next();
  }

  return { ast, diagnostics };
}

// parse: mapkey NAME { directives/text } commands...
function parseMapkey(stream, diagnostics) {
  const startTok = stream.next(); // consume T_KEYWORD
  const node = {
    type: 'MapkeyDefinition',
    name: null,
    directives: [],
    commands: [],
    start: startTok.start,
    end: startTok.end
  };

  // name (IDENTIFIER expected)
  const maybeName = stream.peek();
  if (maybeName.type === 'T_IDENTIFIER') {
    const id = stream.next();
    node.name = id.value;
    node.end = id.end;
  } else {
    diagnostics.push(diag(startTok, 'Expected mapkey identifier after keyword', 'error'));
  }

  // collect directives and inline text until first T_TILDE or T_EOF
  while (!stream.eof()) {
    const t = stream.peek();
    if (t.type === 'T_TILDE' || t.type === 'T_EOF' || t.type === 'T_KEYWORD') break;
    if (t.type === 'T_DIRECTIVE') {
      const d = stream.next();
      node.directives.push({ type: 'DirectiveNode', value: d.value, start: d.start, end: d.end });
      node.end = d.end;
      continue;
    }
    // treat other tokens until commands as free text (label)
    if (t.type === 'T_ARG' || t.type === 'T_STRING' || t.type === 'T_IDENTIFIER') {
      const txt = stream.next();
      node.directives.push({ type: 'TextNode', value: txt.value, start: txt.start, end: txt.end });
      node.end = txt.end;
      continue;
    }
    // skip whitespace/comments handled by tokenizer skipping
    // EOL or unknown or others: consume and continue
    stream.next();
  }

  // parse commands: zero or more commands starting with T_TILDE until next mapkey or EOF
  while (!stream.eof()) {
    const t = stream.peek();
    if (t.type === 'T_TILDE') {
      const cmd = parseCommand(stream, diagnostics);
      node.commands.push(cmd);
      node.end = cmd.end;
      continue;
    }
    // If next mapkey starts, break to allow top-level loop to handle it
    if (t.type === 'T_KEYWORD') break;
    // otherwise consume and continue searching
    if (t.type === 'T_EOF') break;
    stream.next();
  }

  return node;
}

// parse a command: starts with T_TILDE, consumes tokens until matching T_SEMICOLON,
// joining across T_BACKSLASH_EOL tokens. If EOF before semicolon, returns partial node + diagnostic.
function parseCommand(stream, diagnostics) {
  const til = stream.next(); // consume T_TILDE
  const cmd = {
    type: 'CommandNode',
    rawParts: [],
    rawText: '',
    start: til.start,
    end: til.end,
    commandType: 'unknown' // to be determined heuristically
  };

  // collect tokens until semicolon
  let sawSemicolon = false;
  while (!stream.eof()) {
    const t = stream.peek();

    if (t.type === 'T_SEMICOLON') {
      const s = stream.next();
      cmd.rawParts.push({ type: s.type, value: s.value, start: s.start, end: s.end });
      cmd.end = s.end;
      sawSemicolon = true;
      break;
    }

    if (t.type === 'T_BACKSLASH_EOL') {
      // consume but join with next ARG if present
      const b = stream.next();
      cmd.rawParts.push({ type: b.type, value: '\\n', start: b.start, end: b.end }); // normalized
      continue;
    }

    if (t.type === 'T_EOF') {
      // unexpected EOF — partial command
      diagnostics.push(diag(t, 'Unterminated command: missing semicolon', 'warning'));
      cmd.end = t.end;
      break;
    }

    // consume most tokens as part of command body
    const part = stream.next();
    cmd.rawParts.push({ type: part.type, value: part.value, start: part.start, end: part.end });
    cmd.end = part.end;
  }

  // build rawText: join ARG/STRING/IDENTIFIER parts and normalize continuation into space
  cmd.rawText = cmd.rawParts
    .map(p => {
      if (p.type === 'T_BACKSLASH_EOL') return ' '; // continuation collapsed to space
      return p.value;
    })
    .join('').trim();

  // heuristics: determine commandType from rawText prefix (e.g., gui:main => session)
  if (/^\s*gui:main\b/i.test(cmd.rawText)) cmd.commandType = 'session';
  else if (/^\s*gui:popup\b/i.test(cmd.rawText)) cmd.commandType = 'popup';
  else if (/^\s*sidebar\b/i.test(cmd.rawText)) cmd.commandType = 'sidebar';
  else cmd.commandType = 'unknown';

  return cmd;
}

// top-level parse helper accepting text
function parseTextToAst(text) {
  const tokens = tokenize(text);
  return parseTokens(tokens);
}

module.exports = { parseTokens, parseTextToAst };

