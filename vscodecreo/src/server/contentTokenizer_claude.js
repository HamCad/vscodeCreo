// ============================================================================
// PHASE 2: CONTENT-LEVEL TOKENIZER
// ============================================================================
//
// PURPOSE
// Parses block content to extract semantic tokens like mapkey.name,
// mapkey.label, and mapkey.description from the macro commands.
//
// ============================================================================

const { extractMapkeyBlocks, REGEX } = require('./blockTokenizer');

// -----------------------------------------------------------------------------
// CONTENT PARSING REGEXES
// -----------------------------------------------------------------------------
const CONTENT_REGEX = {
    MAPKEY_LABEL: /@MAPKEY_LABEL/,
    MAPKEY_NAME: /@MAPKEY_NAME/,
    NESTED_MAPKEY: /%([^\s;]+);/g
};

// -----------------------------------------------------------------------------
// TOKEN UTILITIES
// -----------------------------------------------------------------------------
/**
 * Creates a token object
 */
function createToken(type, value, start, end, blockId = null) {
    return { type, value, start, end, blockId };
}

/**
 * Finds and extracts a macro value that starts with a specific marker.
 * Handles multi-line macros by joining continuation lines.
 * 
 * @param {string} rawContent - The raw block content
 * @param {number} baseOffset - Starting offset in the original document
 * @param {RegExp} startMarker - Regex to identify the start of the macro
 * @param {string} blockId - Block identifier
 * @returns {Object|null} Token object or null if not found
 */
function extractMacroValue(rawContent, baseOffset, startMarker, blockId) {
    const lines = rawContent.split("\n");
    const startLineIndex = lines.findIndex(l => startMarker.test(l));
    
    if (startLineIndex === -1) return null;

    const valueLines = [];
    let i = startLineIndex;
    let hitEnd = false;

    while (i < lines.length && !hitEnd) {
        let line = lines[i];

        // Remove the start marker (e.g., @MAPKEY_LABEL or @MAPKEY_NAME)
        line = line.replace(startMarker, "").trim();

        // Remove continuation prefix
        line = line.replace(REGEX.CONTINUATION_LINE_START, "").trim();

        // Check for semicolon indicating end of macro
        if (REGEX.MACRO_END.test(line)) {
            hitEnd = true;
            const semiIndex = line.indexOf(';');
            line = line.substring(0, semiIndex);
        }

        // Remove trailing backslash if continuation
        line = line.replace(REGEX.CONTINUATION_LINE_END, "").trim();

        if (line.length > 0) {
            valueLines.push(line);
        }
        
        i++;
        
        // Stop if we hit the end without continuation
        if (hitEnd) break;
    }

    const value = valueLines.join(" ").trim();
    
    // Calculate absolute position in original document
    const absoluteStart =
        baseOffset +
        lines.slice(0, startLineIndex).join("\n").length +
        (startLineIndex > 0 ? 1 : 0);
    const absoluteEnd = absoluteStart + value.length;

    return createToken("macro.value", value, absoluteStart, absoluteEnd, blockId);
}

// -----------------------------------------------------------------------------
// PARSE BLOCK CONTENT
// -----------------------------------------------------------------------------
/**
 * Parses a single mapkey block to extract semantic tokens.
 * 
 * @param {Object} block - Block object from extractMapkeyBlocks
 * @returns {Array} Array of tokens with structure:
 *   {
 *     type: string,
 *     value: string,
 *     start: number,
 *     end: number,
 *     blockId: string
 *   }
 */
function parseBlockContent(block) {
    const tokens = [];

    // Extract mapkey name from the block
    const nameMatch = block.rawContent.match(/^mapkey\s+([^\s]+)/);
    if (nameMatch) {
        const mapkeyName = nameMatch[1];
        const nameStart = block.start + block.rawContent.indexOf(mapkeyName);
        const nameEnd = nameStart + mapkeyName.length;
        
        tokens.push(createToken(
            "mapkey.name",
            mapkeyName,
            nameStart,
            nameEnd,
            block.id
        ));
    }

    // Extract @MAPKEY_LABEL → mapkey.label
    const labelToken = extractMacroValue(
        block.rawContent,
        block.start,
        CONTENT_REGEX.MAPKEY_LABEL,
        block.id
    );
    
    if (labelToken) {
        tokens.push({
            ...labelToken,
            type: "mapkey.label"
        });
    }

    // Extract @MAPKEY_NAME → mapkey.description
    const descToken = extractMacroValue(
        block.rawContent,
        block.start,
        CONTENT_REGEX.MAPKEY_NAME,
        block.id
    );
    
    if (descToken) {
        tokens.push({
            ...descToken,
            type: "mapkey.description"
        });
    }

    // Extract nested mapkeys (%mapkey_name;)
    const nestedMatches = [...block.rawContent.matchAll(CONTENT_REGEX.NESTED_MAPKEY)];
    for (const match of nestedMatches) {
        const nestedName = match[1];
        const matchStart = block.start + match.index + 1; // +1 to skip the %
        const matchEnd = matchStart + nestedName.length;
        
        tokens.push(createToken(
            "mapkey.nested",
            nestedName,
            matchStart,
            matchEnd,
            block.id
        ));
    }

    return tokens;
}

/**
 * Main entry point: extracts blocks and parses their content.
 * 
 * @param {string} text - Raw document text
 * @returns {Object} Object with structure:
 *   {
 *     blocks: Array,
 *     tokens: Array
 *   }
 */
function tokenizeMapkeys(text) {
    const blocks = extractMapkeyBlocks(text);
    const allTokens = [];

    for (const block of blocks) {
        const blockTokens = parseBlockContent(block);
        allTokens.push(...blockTokens);
        
        // Attach tokens to block object
        block.tokens = blockTokens;
    }

    return {
        blocks,
        tokens: allTokens
    };
}

// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------
module.exports = {
    tokenizeMapkeys,
    parseBlockContent,
    extractMacroValue,
    createToken,
    CONTENT_REGEX
};