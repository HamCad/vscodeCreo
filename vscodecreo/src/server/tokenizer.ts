/**
 * ============================================================================
 * CREO MAPKEY TOKENIZER - Two-Phase Design
 * ============================================================================
 * 
 * DESIGN PHILOSOPHY:
 * This tokenizer uses a two-phase approach optimized for Creo mapkey syntax:
 * 
 * Phase 1: Block-level tokenization
 *   - Identifies complete mapkey definitions (start to end)
 *   - Handles multiline continuations and edge cases
 *   - Creates a structured boundary for each mapkey
 * 
 * Phase 2: Content-level tokenization
 *   - Tokenizes within each mapkey block
 *   - Identifies actions (~...;), nested mapkeys, commands, arguments
 *   - Context-aware based on action verbs
 * 
 * WHY TWO PHASES?
 * - Mapkeys have complex multiline rules that are easier to handle in isolation
 * - Actions within mapkeys need context from the block structure
 * - Prevents token overlap and ambiguity
 * - Easier to debug and maintain
 * - Better performance (only tokenize relevant sections)
 * 
 * ============================================================================
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Token {
  type: string;
  value: string;
  start: number;      // Absolute position in document
  end: number;        // Absolute position in document
  blockId?: string;   // Which mapkey block this token belongs to (if applicable)
}

export interface MapkeyBlock {
  id: string;         // Unique identifier for this block
  name: string;       // Mapkey keybinding (e.g., "Z-MBD-MCS1")
  start: number;      // Start position in document
  end: number;        // End position in document
  content: string;    // Raw text content of the block
  tokens: Token[];    // All tokens within this block
}

// ============================================================================
// PHASE 1: BLOCK-LEVEL TOKENIZATION
// ============================================================================

/**
 * Extract all mapkey blocks from the document
 * 
 * A mapkey block consists of:
 * 1. Declaration line: ^mapkey <name> [metadata...]
 * 2. Continuation lines: ^mapkey(continued) ... ;\
 * 3. Final line: ^mapkey(continued) ... ; (no backslash)
 * 4. Comments within blocks: ^! ... ;\
 * 
 * Rules:
 * - Each continuation must start with "mapkey(continued)" or be a comment
 * - Lines must end with ";\" to continue (except final line ends with ";")
 * - Blank lines may terminate the mapkey
 * - Comments don't need "mapkey(continued)" but must end with ";\"
 */
export function extractMapkeyBlocks(text: string): MapkeyBlock[] {
  const blocks: MapkeyBlock[] = [];
  const lines = text.split('\n');
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Look for mapkey declaration: ^mapkey <name>
    const declMatch = line.match(/^mapkey\s+([^\s;]+)/);
    if (!declMatch) {
      i++;
      continue;
    }
    
    // Found a mapkey declaration
    const blockStartLine = i;
    const mapkeyName = declMatch[1];
    const blockId = `mapkey_${blockStartLine}_${mapkeyName}`;
    
    // Calculate absolute start position
    const blockStart = lines.slice(0, blockStartLine).join('\n').length + 
                       (blockStartLine > 0 ? 1 : 0);
    
    // Collect all lines belonging to this mapkey
    let blockEndLine = i;
    i++; // Move to next line
    
    while (i < lines.length) {
      const currentLine = lines[i];
      const trimmed = currentLine.trim();
      
      // Empty line - mapkey ends
      if (trimmed === '') {
        break;
      }
      
      // Comment line - must end with ;\  to continue
      if (trimmed.startsWith('!')) {
        blockEndLine = i;
        if (trimmed.endsWith(';\\')) {
          i++;
          continue;
        } else {
          // Comment without ;\ ends the mapkey
          i++;
          break;
        }
      }
      
      // Must be a continuation line
      if (!trimmed.startsWith('mapkey(continued)')) {
        // Not a valid continuation - mapkey ends
        break;
      }
      
      blockEndLine = i;
      
      // Check line ending
      if (trimmed.endsWith(';\\')) {
        // Continue to next line
        i++;
        continue;
      } else if (trimmed.endsWith(';')) {
        // Final line of mapkey
        i++;
        break;
      } else {
        // Invalid ending - mapkey ends
        i++;
        break;
      }
    }
    
    // Calculate absolute end position
    const blockEnd = lines.slice(0, blockEndLine + 1).join('\n').length;
    
    // Extract block content
    const blockContent = lines.slice(blockStartLine, blockEndLine + 1).join('\n');
    
    // Create the block
    blocks.push({
      id: blockId,
      name: mapkeyName,
      start: blockStart,
      end: blockEnd,
      content: blockContent,
      tokens: [] // Will be filled in Phase 2
    });
  }
  
  return blocks;
}

// ============================================================================
// PHASE 2: CONTENT-LEVEL TOKENIZATION
// ============================================================================

/**
 * Tokenize the contents of a mapkey block
 * 
 * This identifies:
 * - Metadata tags (@MAPKEY_NAME, @MAPKEY_LABEL)
 * - Actions (~ ... ;)
 * - Action verbs (first element after ~)
 * - Action arguments (backtick strings, integers)
 * - System commands (@MANUAL_PAUSE, @SYSTEM)
 * - Nested mapkeys (%)
 * - Comments (!)
 */
function tokenizeMapkeyContent(block: MapkeyBlock): Token[] {
  const tokens: Token[] = [];
  const content = block.content;
  const blockStart = block.start;
  
  // -------------------------------------------------------------------------
  // 1. TOKENIZE MAPKEY DECLARATION LINE
  // -------------------------------------------------------------------------
  
  // Match: mapkey <name>
  const declMatch = content.match(/^mapkey\s+([^\s;]+)/);
  if (declMatch) {
    const keywordStart = 0;
    const keywordEnd = 6; // "mapkey"
    
    tokens.push({
      type: 'mapkey.keyword',
      value: 'mapkey',
      start: blockStart + keywordStart,
      end: blockStart + keywordEnd,
      blockId: block.id
    });
    
    const nameStart = content.indexOf(declMatch[1], keywordEnd);
    const nameEnd = nameStart + declMatch[1].length;
    
    tokens.push({
      type: 'mapkey.name',
      value: declMatch[1],
      start: blockStart + nameStart,
      end: blockStart + nameEnd,
      blockId: block.id
    });
  }
  
  // -------------------------------------------------------------------------
  // 2. TOKENIZE METADATA TAGS
  // -------------------------------------------------------------------------
  
  // @MAPKEY_NAME with multiline content
  const nameTagRegex = /@MAPKEY_NAME/g;
  let match: RegExpExecArray | null;
  
  while ((match = nameTagRegex.exec(content)) !== null) {
    const tagStart = match.index;
    const tagEnd = tagStart + match[0].length;
    
    tokens.push({
      type: 'mapkey.tag.name',
      value: '@MAPKEY_NAME',
      start: blockStart + tagStart,
      end: blockStart + tagEnd,
      blockId: block.id
    });
    
    // Extract description content after tag
    const descToken = extractMetadataContent(content, tagEnd, blockStart, block.id);
    if (descToken) tokens.push(descToken);
  }
  
  // @MAPKEY_LABEL with multiline content
  const labelTagRegex = /@MAPKEY_LABEL/g;
  
  while ((match = labelTagRegex.exec(content)) !== null) {
    const tagStart = match.index;
    const tagEnd = tagStart + match[0].length;
    
    tokens.push({
      type: 'mapkey.tag.label',
      value: '@MAPKEY_LABEL',
      start: blockStart + tagStart,
      end: blockStart + tagEnd,
      blockId: block.id
    });
    
    // Extract label content after tag
    const labelToken = extractMetadataContent(content, tagEnd, blockStart, block.id);
    if (labelToken) {
      labelToken.type = 'mapkey.label';
      tokens.push(labelToken);
    }
  }
  
  // -------------------------------------------------------------------------
  // 3. TOKENIZE SYSTEM COMMANDS
  // -------------------------------------------------------------------------
  
  const systemCmdRegex = /(@MANUAL_PAUSE|@SYSTEM)/g;
  
  while ((match = systemCmdRegex.exec(content)) !== null) {

    const tagStart = match.index;
    const tagEnd = tagStart + match[0].length;

    tokens.push({
      type: 'mapkey.system.command',
      value: match[0],
      start: blockStart + tagStart,
      end: blockStart + tagEnd,
      blockId: block.id
    });

    // Extract label content after tag
    const labelToken = extractMetadataContent(content, tagEnd, blockStart, block.id);
    if (labelToken) {
      labelToken.type = 'mapkey.system.instruction';
      tokens.push(labelToken);
    }

  }
  
  // -------------------------------------------------------------------------
  // 4. TOKENIZE NESTED MAPKEYS
  // -------------------------------------------------------------------------
  
  // Pattern: %mapkeyname;
  const nestedRegex = /%([^;]+);/g;
  
  while ((match = nestedRegex.exec(content)) !== null) {
    const fullStart = match.index;
    const fullEnd = fullStart + match[0].length;
    
    // Token for the % symbol
    tokens.push({
      type: 'mapkey.nested.marker',
      value: '%',
      start: blockStart + fullStart,
      end: blockStart + fullStart + 1,
      blockId: block.id
    });
    
    // Token for the nested mapkey name
    tokens.push({
      type: 'mapkey.nested.name',
      value: match[1],
      start: blockStart + fullStart + 1,
      end: blockStart + fullEnd - 1,
      blockId: block.id
    });
    
    // Token for the semicolon
    tokens.push({
      type: 'mapkey.nested.terminator',
      value: ';',
      start: blockStart + fullEnd - 1,
      end: blockStart + fullEnd,
      blockId: block.id
    });
  }
  
  // -------------------------------------------------------------------------
  // 5. TOKENIZE ACTIONS (~ ... ;)
  // -------------------------------------------------------------------------
  
  // Actions are the core of mapkeys
  // Pattern: ~ <verb> <args...> ;
  // Args can be: `string`, integer, or `string` integer combinations
  const actionRegex = /~\s*([^\s;`]+)(.*?);/g;
  
  while ((match = actionRegex.exec(content)) !== null) {
    const actionStart = match.index;
    const actionEnd = actionStart + match[0].length;
    const verb = match[1];
    const argsString = match[2];
    
    // Token for ~ marker
    tokens.push({
      type: 'mapkey.action.marker',
      value: '~',
      start: blockStart + actionStart,
      end: blockStart + actionStart + 1,
      blockId: block.id
    });
    
    // Token for action verb
    const verbStart = content.indexOf(verb, actionStart + 1);
    tokens.push({
      type: 'mapkey.action.verb',
      value: verb,
      start: blockStart + verbStart,
      end: blockStart + verbStart + verb.length,
      blockId: block.id
    });
    
    // Tokenize arguments
    const argTokens = tokenizeActionArguments(
      argsString, 
      blockStart + verbStart + verb.length,
      block.id,
      verb
    );
    tokens.push(...argTokens);
    
    // Token for terminating semicolon
    tokens.push({
      type: 'mapkey.action.terminator',
      value: ';',
      start: blockStart + actionEnd - 1,
      end: blockStart + actionEnd,
      blockId: block.id
    });
  }
  
  // -------------------------------------------------------------------------
  // 6. TOKENIZE COMMENTS
  // -------------------------------------------------------------------------
  
  const commentRegex = /^!.*$/gm;
  
  while ((match = commentRegex.exec(content)) !== null) {
    tokens.push({
      type: 'comment.line',
      value: match[0],
      start: blockStart + match.index,
      end: blockStart + match.index + match[0].length,
      blockId: block.id
    });
  }
  
  // -------------------------------------------------------------------------
  // 7. TOKENIZE CONTINUATION MARKERS
  // -------------------------------------------------------------------------
  
  const contRegex = /^mapkey\(continued\)/gm;
  
  while ((match = contRegex.exec(content)) !== null) {
    tokens.push({
      type: 'mapkey.continuation',
      value: match[0],
      start: blockStart + match.index,
      end: blockStart + match.index + match[0].length,
      blockId: block.id
    });
  }
  
  return tokens;
}

// ============================================================================
// PHASE 3: DOCUMENT-LEVEL TOKENIZATION
// ============================================================================

/**
 * Tokenize document-level markers that exist outside of mapkey blocks
 * 
 * This includes:
 * - Region markers (!region, !endregion)
 * - Standalone comments
 * - Config options
 * - Any other global markers
 */
function tokenizeDocumentLevel(text: string): Token[] {
  const tokens: Token[] = [];
  
  // -------------------------------------------------------------------------
  // 1. TOKENIZE REGION MARKERS (for folding)
  // -------------------------------------------------------------------------
  
  const regionStartRegex = /^\s*!region/gm;
  let match: RegExpExecArray | null;
  
  while ((match = regionStartRegex.exec(text)) !== null) {
    tokens.push({
      type: 'region.start',
      value: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  const regionEndRegex = /^\s*!endregion/gm;
  
  while ((match = regionEndRegex.exec(text)) !== null) {
    tokens.push({
      type: 'region.end',
      value: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  // -------------------------------------------------------------------------
  // 2. TOKENIZE STANDALONE COMMENTS (outside mapkeys)
  // -------------------------------------------------------------------------
  
  // Find all mapkey block ranges to exclude them
  const blocks = extractMapkeyBlocks(text);
  const blockRanges = blocks.map(b => ({ start: b.start, end: b.end }));
  
  const commentRegex = /^!.*$/gm;
  
  while ((match = commentRegex.exec(text)) !== null) {
    const commentStart = match.index;
    const commentEnd = commentStart + match[0].length;
    
    // Check if this comment is inside a mapkey block
    const isInsideBlock = blockRanges.some(
      range => commentStart >= range.start && commentEnd <= range.end
    );
    
    // Only add if it's NOT inside a mapkey block
    if (!isInsideBlock) {
      tokens.push({
        type: 'comment.standalone',
        value: match[0],
        start: commentStart,
        end: commentEnd
      });
    }
  }
  
  return tokens;
}

/**
 * Extract metadata content after @MAPKEY_NAME or @MAPKEY_LABEL
 * Handles multiline content with backslash continuations
 */
function extractMetadataContent(
  content: string, 
  tagEnd: number, 
  blockStart: number,
  blockId: string
): Token | null {
  // Find the line containing the tag
  const beforeTag = content.substring(0, tagEnd);
  const lineStart = beforeTag.lastIndexOf('\n') + 1;
  const lineEnd = content.indexOf('\n', tagEnd);
  const firstLine = content.substring(tagEnd, lineEnd !== -1 ? lineEnd : content.length);
  
  // Check for semicolon on first line
  const semiPos = firstLine.indexOf(';');
  if (semiPos !== -1) {
    const value = firstLine.substring(0, semiPos).trim();
    if (!value) return null;
    
    return {
      type: 'mapkey.description',
      value,
      start: blockStart + tagEnd,
      end: blockStart + tagEnd + semiPos,
      blockId
    };
  }
  
  // Multiline content - collect until we hit a line without backslash
  let collectedContent = firstLine.replace(/\s*\\+\s*$/g, '').trim();
  let currentPos = lineEnd !== -1 ? lineEnd : content.length;
  
  while (currentPos < content.length) {
    const nextLineStart = currentPos + 1;
    const nextLineEnd = content.indexOf('\n', nextLineStart);
    const nextLine = content.substring(
      nextLineStart, 
      nextLineEnd !== -1 ? nextLineEnd : content.length
    );
    
    // Skip mapkey(continued) prefix
    const cleanLine = nextLine.replace(/^mapkey\(continued\)\s*/, '');
    
    // Check for semicolon
    const nextSemiPos = cleanLine.indexOf(';');
    if (nextSemiPos !== -1) {
      const partial = cleanLine.substring(0, nextSemiPos).trim();
      if (partial) collectedContent += ' ' + partial;
      break;
    }
    
    // Check for backslash continuation
    if (!cleanLine.trim().endsWith('\\')) break;
    
    // Add this line to content
    const cleaned = cleanLine.replace(/\s*\\+\s*$/g, '').trim();
    if (cleaned) collectedContent += ' ' + cleaned;
    
    currentPos = nextLineEnd !== -1 ? nextLineEnd : content.length;
  }
  
  if (!collectedContent) return null;
  
  return {
    type: 'mapkey.description',
    value: collectedContent,
    start: blockStart + tagEnd,
    end: blockStart + currentPos,
    blockId
  };
}

/**
 * Tokenize arguments within an action
 * 
 * Arguments can be:
 * - Backtick strings: `string`
 * - Integers: 123 or `123`
 * - Mixed combinations
 * 
 * The verb context helps identify what type of arguments to expect
 */
function tokenizeActionArguments(
  argsString: string, 
  baseOffset: number,
  blockId: string,
  verb: string
): Token[] {
  const tokens: Token[] = [];
  
  // Match backtick-enclosed strings
  const backtickRegex = /`([^`]*)`/g;
  let match: RegExpExecArray | null;
  
  while ((match = backtickRegex.exec(argsString)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    
    // Determine argument type based on verb context
    let argType = 'mapkey.action.arg.string';
    
    // Context-aware typing (expandable based on verb)
    if (verb === 'Command' || verb === 'ProCmdCommand') {
      argType = 'mapkey.action.arg.command';
    } else if (verb === 'Select' || verb === 'Activate') {
      argType = 'mapkey.action.arg.ui_element';
    }
    
    tokens.push({
      type: argType,
      value: match[1], // Content without backticks
      start: baseOffset + start + 1, // +1 to skip opening backtick
      end: baseOffset + end - 1,     // -1 to skip closing backtick
      blockId
    });
  }
  
  // Match standalone integers (not in backticks)
  const integerRegex = /\s(\d+)(?=\s|$)/g;
  
  while ((match = integerRegex.exec(argsString)) !== null) {
    tokens.push({
      type: 'mapkey.action.arg.integer',
      value: match[1],
      start: baseOffset + match.index + 1, // +1 for the space
      end: baseOffset + match.index + 1 + match[1].length,
      blockId
    });
  }
  
  return tokens;
}

// ============================================================================
// MAIN TOKENIZATION FUNCTION
// ============================================================================

/**
 * Main entry point for tokenization
 * 
 * This performs two-phase tokenization:
 * 1. Extract mapkey blocks
 * 2. Tokenize contents of each block
 * 3. Tokenize document-level markers (regions, etc.)
 * 
 * Returns a flat array of all tokens, sorted by position
 */
export function tokenize(text: string): Token[] {
  // Phase 1: Extract blocks
  const blocks = extractMapkeyBlocks(text);
  
  // Phase 2: Tokenize each block
  const allTokens: Token[] = [];
  
  for (const block of blocks) {
    const blockTokens = tokenizeMapkeyContent(block);
    block.tokens = blockTokens;
    allTokens.push(...blockTokens);
  }
  
  // Phase 3: Tokenize document-level markers (outside mapkey blocks)
  const documentTokens = tokenizeDocumentLevel(text);
  allTokens.push(...documentTokens);
  
  // Sort all tokens by position
  return allTokens.sort((a, b) => a.start - b.start);
}

/**
 * Get all mapkey blocks (useful for structure analysis)
 */
export function getMapkeyBlocks(text: string): MapkeyBlock[] {
  const blocks = extractMapkeyBlocks(text);
  
  // Tokenize each block
  for (const block of blocks) {
    block.tokens = tokenizeMapkeyContent(block);
  }
  
  return blocks; 
}

/**
 * Get the token at a specific position
 */
export function getTokenAtPosition(text: string, position: number): Token | null {
  const tokens = tokenize(text);
  return tokens.find(t => position >= t.start && position < t.end) || null;
}

/**
 * Get the mapkey block at a specific position
 */
export function getBlockAtPosition(text: string, position: number): MapkeyBlock | null {
  const blocks = getMapkeyBlocks(text);
  return blocks.find(b => position >= b.start && position <= b.end) || null;
}