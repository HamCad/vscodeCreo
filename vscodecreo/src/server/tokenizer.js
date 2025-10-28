// ============================================================================
// CREO MAPKEY TOKENIZER - MASTER ENTRY
// ============================================================================
//
// PURPOSE
// Coordinates all tokenizer phases. Each submodule handles one layer:
//   1. blockTokenizer.js    → isolates full mapkey definitions
//   2. contentTokenizer.js  → tokenizes inside each mapkey block
//   3. documentTokenizer.js → processes global markers and regions
//
// Each module returns arrays of token objects:
//   { type, value, start, end, blockId? }
//
// ============================================================================

const { extractMapkeyBlocks } = require("./blockTokenizer");
// const { tokenizeMapkeyContent } = require("./contentTokenizer");
// const { tokenizeDocumentLevel } = require("./documentTokenizer");

// -----------------------------------------------------------------------------
// MAIN TOKENIZATION ENTRY POINT
// -----------------------------------------------------------------------------
function tokenize(text) {
    const blocks = extractMapkeyBlocks(text);
    const tokens = [];

    // Phase 1: collect all tokens from each block
    for (const block of blocks) {
        if (block.tokens && Array.isArray(block.tokens)) {
            tokens.push(...block.tokens);
        }
    }

    // // Phase 2: mapkey content (optional)
    // for (const block of blocks) {
    //     const blockTokens = tokenizeMapkeyContent(block);
    //     block.tokens.push(...blockTokens);
    //     tokens.push(...blockTokens);
    // }

    // // Phase 3: document-level (optional)
    // const documentTokens = tokenizeDocumentLevel(text, blocks);
    // tokens.push(...documentTokens);

    
    console.log("Tokens found:", tokens.length);
    console.log("Token types:");
    console.table(tokens.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
    }, {}));
    // tokens.forEach((t, i) => console.log(`${i}: ${t.type}`));


    return tokens.sort((a, b) => a.start - b.start);
}

// -----------------------------------------------------------------------------
// HELPER ACCESSORS
// -----------------------------------------------------------------------------
function getMapkeyBlocks(text) {
    const blocks = extractMapkeyBlocks(text);
    // if content tokenization is disabled, just return phase 1 tokens
    return blocks;
}

function getTokenAtPosition(text, position) {
    const tokens = tokenize(text);
    return tokens.find(t => position >= t.start && position < t.end) || null;
}

function getBlockAtPosition(text, position) {
    const blocks = getMapkeyBlocks(text);
    return blocks.find(b => position >= b.start && position <= b.end) || null;
}

// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------
module.exports = {
    tokenize,
    getMapkeyBlocks,
    getTokenAtPosition,
    getBlockAtPosition
};
