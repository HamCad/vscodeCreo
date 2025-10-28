// ============================================================================
// PHASE 1: BLOCK-LEVEL TOKENIZER
// ============================================================================
//
// PURPOSE
// Identifies and extracts complete mapkey definitions from raw document text.
// Emits tokens for mapkey.name and mapkey.nested.
//
// ============================================================================

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------
const REGEX = {
    MAPKEY_START: /^mapkey\s/,
    DECLARATION: /^mapkey\s+([^\s;]+)/,
    CONTINUATION_LINE: /(?:^mapkey\(continued\)|@).*\\$/,
    CONTINUATION_COMMENT: /^\s*!.+;\\$/,
    NESTED_MAPKEY: /%(.*\w);/,
    MAPKEY_END: /.+(?:[^\\]$)(?=\n)/
};

// -----------------------------------------------------------------------------
// TOKEN UTILITIES
// -----------------------------------------------------------------------------
function addToken(list, type, value, start, end, blockId = null) {
    list.push({ type, value, start, end, blockId });
}

function addSimpleToken(list, type, value, blockId = null) {
    list.push({ type, value, blockId });
}

// -----------------------------------------------------------------------------
// EXTRACT ALL MAPKEY BLOCKS
// -----------------------------------------------------------------------------
function extractMapkeyBlocks(text) {
    const blocks = [];
    const lines = text.split("\n");

    let currentOffset = 0;
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const declMatch = line.match(REGEX.DECLARATION);

        if (!declMatch) {
            currentOffset += line.length + 1;
            i++;
            continue;
        }

        const mapkeyName = declMatch[1];
        const blockStartLine = i;
        const blockStart = currentOffset;
        const blockId = `mapkey_${blockStartLine}_${mapkeyName}`;

        const collected = [line];
        const tokens = [];

        // --- Emit mapkey.name token ---
        const nameStart = line.indexOf(mapkeyName);
        const nameEnd = nameStart + mapkeyName.length;
        addToken(tokens, "mapkey.name", mapkeyName, currentOffset + nameStart, currentOffset + nameEnd, blockId);

        let blockEnd = currentOffset + line.length;
        i++;

        // --- Collect continuation lines ---
        while (i < lines.length) {
            const nextLine = lines[i];
            const trimmed = nextLine.trim();

            if (trimmed === "") break;

            if (REGEX.CONTINUATION_COMMENT.test(trimmed) || REGEX.CONTINUATION_LINE.test(trimmed)) {
                collected.push(nextLine);
                blockEnd += nextLine.length + 1;

                // --- Emit nested mapkey tokens if any ---
                const nestedMatch = nextLine.match(REGEX.NESTED_MAPKEY);
                if (nestedMatch) {
                    const nestedName = nestedMatch[1];
                    addSimpleToken(tokens, "mapkey.nested", nestedName, blockId);
                }

                i++;
                continue;
            }

            break;
        }

        const blockContent = collected.join("\n");

        blocks.push({
            id: blockId,
            name: mapkeyName,
            start: blockStart,
            end: blockEnd,
            startLine: blockStartLine,
            content: blockContent,
            tokens
        });

        // Update offset
        currentOffset = lines.slice(0, i).join("\n").length + (i > 0 ? 1 : 0);
    }

    return blocks;
}

// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------
module.exports = {
    extractMapkeyBlocks,
    addToken,
    addSimpleToken,
    REGEX
};
