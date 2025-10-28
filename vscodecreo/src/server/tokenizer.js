// ============================================================================
// CREO MAPKEY TOKENIZER - MASTER ENTRY
// ============================================================================
//
// PURPOSE
// This file coordinates all tokenizer phases. Each submodule is responsible
// for a distinct layer of the parsing pipeline:
//
//   1. blockTokenizer.js    → isolates full mapkey definitions
//   2. contentTokenizer.js  → tokenizes inside each mapkey block
//   3. documentTokenizer.js → processes global markers and regions
//
// Each module returns arrays of token objects with:
//   { type, value, start, end, blockId? }
//
// New token categories can be added in their respective module, then
// optionally referenced here for aggregation or ordering.
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

    // // Phase 2: mapkey content
    // for (const block of blocks) {
    //     const blockTokens = tokenizeMapkeyContent(block);
    //     block.tokens = blockTokens;
    //     tokens.push(...blockTokens);
    // }
    // 
    // // Phase 3: document-level
    // const documentTokens = tokenizeDocumentLevel(text, blocks);
    // tokens.push(...documentTokens);

    return tokens.sort((a, b) => a.start - b.start);
}

// -----------------------------------------------------------------------------
// HELPER ACCESSORS
// -----------------------------------------------------------------------------
function getMapkeyBlocks(text) {
    const blocks = extractMapkeyBlocks(text);
    for (const block of blocks) {
        block.tokens = tokenizeMapkeyContent(block);
    }
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
