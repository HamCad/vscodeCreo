// src/shared/parser.js
// Parser for Creo mapkey .pro files
// Uses tokenizer.js and ast.js

const { tokenize } = require('./tokenizer');
const {
  MapkeyFile,
  MapkeyDefinition,
  DirectiveNode,
  TextNode,
  CommandNode
} = require('./ast');

/**
 * Parse Creo .pro file text into AST
 * @param {string} text - Source code
 * @returns {MapkeyFile} Root AST node
 */
function parse(text) {
  const tokens = tokenize(text);
  const parser = new Parser(tokens);
  return parser.parseFile();
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  current() {
    return this.tokens[this.pos];
  }

  peek(offset = 1) {
    return this.tokens[this.pos + offset];
  }

  advance() {
    if (this.pos < this.tokens.length - 1) {
      this.pos++;
    }
    return this.current();
  }

  consume(type) {
    const tok = this.current();
    if (tok.type !== type) {
      throw new Error(`Expected ${type} but got ${tok.type} at position ${tok.start}`);
    }
    this.advance();
    return tok;
  }

  match(...types) {
    return types.includes(this.current().type);
  }

  parseFile() {
    const file = new MapkeyFile();
    
    while (!this.match('T_EOF')) {
      // Skip comments and empty lines
      if (this.match('T_COMMENT', 'T_EOL')) {
        this.advance();
        continue;
      }
      
      // Parse mapkey definition
      if (this.match('T_MAPKEY')) {
        const mapkey = this.parseMapkey();
        file.addMapkey(mapkey);
      } else {
        // Skip unknown content
        this.advance();
      }
    }
    
    return file;
  }

  parseMapkey() {
    const startTok = this.consume('T_MAPKEY');
    const mapkey = new MapkeyDefinition(startTok.start);
    
    // Expect opening parenthesis
    if (!this.match('T_LPAREN')) {
      throw new Error(`Expected '(' after 'mapkey' at position ${this.current().start}`);
    }
    this.advance();
    
    // Parse mapkey name (optional - could be continued line)
    if (this.match('T_IDENTIFIER', 'T_STRING')) {
      const nameTok = this.current();
      mapkey.setName(nameTok.value, nameTok.start, nameTok.end);
      this.advance();
    }
    
    // Parse optional label/description
    while (this.match('T_IDENTIFIER', 'T_STRING', 'T_ARG')) {
      const tok = this.current();
      mapkey.addDirective(new TextNode(tok.value, tok.start, tok.end));
      this.advance();
    }
    
    // Expect closing parenthesis
    if (this.match('T_RPAREN')) {
      this.advance();
    }
    
    // Parse directives (@MAPKEY_NAME, @SYSTEM, etc.)
    while (this.match('T_DIRECTIVE')) {
      const tok = this.current();
      mapkey.addDirective(new DirectiveNode(tok.value, tok.start, tok.end));
      this.advance();
    }
    
    // Skip EOL
    if (this.match('T_EOL')) {
      this.advance();
    }
    
    // Parse commands (lines starting with ~)
    while (this.match('T_TILDE')) {
      const cmd = this.parseCommand();
      mapkey.addCommand(cmd);
    }
    
    return mapkey;
  }

  parseCommand() {
    const startTok = this.consume('T_TILDE');
    const cmd = new CommandNode(startTok.start);
    
    // Collect all parts until semicolon or EOF
    while (!this.match('T_SEMICOLON', 'T_EOF', 'T_MAPKEY')) {
      // Handle line continuations
      if (this.match('T_BACKSLASH_EOL')) {
        const tok = this.current();
        cmd.addPart(tok);
        this.advance();
        continue;
      }
      
      // Skip standalone EOL (end of command)
      if (this.match('T_EOL')) {
        break;
      }
      
      // Add token to command
      const tok = this.current();
      cmd.addPart(tok);
      this.advance();
    }
    
    // Consume semicolon if present
    if (this.match('T_SEMICOLON')) {
      const tok = this.current();
      cmd.addPart(tok);
      this.advance();
    }
    
    // Skip trailing EOL
    if (this.match('T_EOL')) {
      this.advance();
    }
    
    cmd.finalize();
    return cmd;
  }
}

module.exports = { parse };
