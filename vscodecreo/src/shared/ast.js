// ast.js
// AST node definitions and helpers for Creo mapkey LSP
// No external dependencies.

//
// Base Node
//

class ASTNode {
  constructor(type, start, end) {
    this.type = type;
    this.start = start || 0;
    this.end = end || 0;
  }
}

//
// Root File Node
//

class MapkeyFile extends ASTNode {
  constructor() {
    super('MapkeyFile', 0, 0);
    this.mapkeys = [];
  }

  addMapkey(node) {
    this.mapkeys.push(node);
    this.end = Math.max(this.end, node.end);
  }
}

//
// Mapkey Definition
//

class MapkeyDefinition extends ASTNode {
  constructor(start) {
    super('MapkeyDefinition', start, start);
    this.name = null;
    this.directives = [];
    this.commands = [];
  }

  setName(name, start, end) {
    this.name = name;
    this.start = start;
    this.end = end;
  }

  addDirective(node) {
    this.directives.push(node);
    this.end = Math.max(this.end, node.end);
  }

  addCommand(node) {
    this.commands.push(node);
    this.end = Math.max(this.end, node.end);
  }
}

//
// Directive Node
//

class DirectiveNode extends ASTNode {
  constructor(value, start, end) {
    super('DirectiveNode', start, end);
    this.value = value;
  }
}

//
// Text Node (labels or free text after mapkey name)
//

class TextNode extends ASTNode {
  constructor(value, start, end) {
    super('TextNode', start, end);
    this.value = value;
  }
}

//
// Command Node
//

class CommandNode extends ASTNode {
  constructor(start) {
    super('CommandNode', start, start);
    this.rawParts = [];      // raw token pieces
    this.rawText = '';       // reconstructed command body
    this.commandType = 'unknown'; // session | popup | sidebar | unknown
  }

  addPart(part) {
    this.rawParts.push(part);
    this.end = Math.max(this.end, part.end);
  }

  finalize() {
    this.rawText = this.rawParts
      .map(p => {
        if (p.type === 'T_BACKSLASH_EOL') return ' ';
        return p.value;
      })
      .join('')
      .trim();

    this.commandType = classifyCommandType(this.rawText);
  }
}

//
// Classification logic (extend as needed)
//

function classifyCommandType(text) {
  if (!text) return 'unknown';

  if (/^\s*gui:main\b/i.test(text)) return 'session';
  if (/^\s*gui:popup\b/i.test(text)) return 'popup';
  if (/^\s*sidebar\b/i.test(text)) return 'sidebar';

  return 'unknown';
}

//
// Traversal Utilities
//

function walk(node, visitor) {
  if (!node) return;

  visitor(node);

  switch (node.type) {
    case 'MapkeyFile':
      node.mapkeys.forEach(n => walk(n, visitor));
      break;

    case 'MapkeyDefinition':
      node.directives.forEach(n => walk(n, visitor));
      node.commands.forEach(n => walk(n, visitor));
      break;

    case 'CommandNode':
      // rawParts are flat token fragments, not AST nodes
      break;

    default:
      break;
  }
}

//
// Semantic Token Extraction (for LSP semanticTokens)
// Returns array of token descriptors:
// { start, length, tokenType, tokenModifiers }
// You convert these to LSP-encoded integers later.
//

function collectSemanticTokens(ast) {
  const tokens = [];

  walk(ast, node => {
    switch (node.type) {

      case 'MapkeyDefinition':
        if (node.name) {
          tokens.push({
            start: node.start,
            length: node.name.length,
            tokenType: 'mapkeyName',
            tokenModifiers: []
          });
        }
        break;

      case 'DirectiveNode':
        tokens.push({
          start: node.start,
          length: node.value.length,
          tokenType: 'directive',
          tokenModifiers: []
        });
        break;

      case 'CommandNode':
        tokens.push({
          start: node.start,
          length: node.end - node.start,
          tokenType: `command.${node.commandType}`,
          tokenModifiers: []
        });
        break;
    }
  });

  return tokens;
}

//
// Basic Structural Validation
//

function validateAST(ast) {
  const diagnostics = [];

  walk(ast, node => {

    if (node.type === 'MapkeyDefinition') {
      if (!node.name) {
        diagnostics.push({
          message: 'Mapkey missing name',
          start: node.start,
          end: node.end,
          severity: 'error'
        });
      }
    }

    if (node.type === 'CommandNode') {
      if (!node.rawText || node.rawText.length === 0) {
        diagnostics.push({
          message: 'Empty command body',
          start: node.start,
          end: node.end,
          severity: 'warning'
        });
      }
    }

  });

  return diagnostics;
}

//
// Exports
//

module.exports = {
  MapkeyFile,
  MapkeyDefinition,
  DirectiveNode,
  TextNode,
  CommandNode,
  walk,
  collectSemanticTokens,
  validateAST
};

