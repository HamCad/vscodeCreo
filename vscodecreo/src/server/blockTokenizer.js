// ============================================================================
// PHASE 1: BLOCK-LEVEL TOKENIZER
// ============================================================================
//
// PURPOSE
// Identifies and extracts complete mapkey definitions from raw document text.
// A "block" is a contiguous set of lines belonging to one mapkey.
//
// ============================================================================

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------
const REGEX = {
    MAPKEY_START: /^mapkey\s/,
    DECLARATION: /^mapkey\s+([^\s;]+)/,
    CONTINUATION_LINE: /(?:^mapkey\(continued\)|@).*\\$/,
    CONTINUATION_LINE_START: /^mapkey\(continued\)\s/,
    CONTINUATION_LINE_END: /[^;](\\$)/,
    CONTINUATION_COMMENT: /^\s*!.+;\\$/,
    MACRO_END: /;/,
    NESTED_MAPKEY: /%(.*\w);/,
    MAPKEY_LABEL: /@MAPKEY_LABEL/,
    MAPKEY_NAME: /@MAPKEY_NAME/, 
    MAPKEY_END: /.+(?:[^\\]$)(?=\n)/ 
};

// -----------------------------------------------------------------------------
// TOKEN UTILITIES
// -----------------------------------------------------------------------------
function addToken(list, type, value, start, end, blockId = null) {
    list.push({ type, value, start, end, blockId });
}

/**
 * Simplified token creation for regex-based matches.
 * - Finds the first line matching `startRegex`.
 * - Joins continuation lines until hitting `REGEX.MACRO_END`.
 * - Removes continuation prefixes and trailing backslashes.
 */
function addRegexToken(lines, baseOffset, startRegex, type, tokens, blockId) {
    const startLineIndex = lines.findIndex(l => startRegex.test(l));
    if (startLineIndex === -1) return;

    const valueLines = [];
    let i = startLineIndex;
    let hitEnd = false;

    while (i < lines.length && !hitEnd) {
        let line = lines[i];

        // Remove the start marker (e.g., @MAPKEY_LABEL or @MAPKEY_NAME)
        line = line.replace(startRegex, "").trim();

        // Remove prefix (mapkey(continued))
        line = line.replace(REGEX.CONTINUATION_LINE_START, "").trim();

        // Check for semicolon indicating end of macro
        if (REGEX.MACRO_END.test(line)) {
            hitEnd = true;
            line = line.split(";")[0];
        }

        // Remove trailing backslash if continuation
        line = line.replace(REGEX.CONTINUATION_LINE_END, "").trim();

        valueLines.push(line);
        i++;
    }

    const value = valueLines.join(" ");
    const absoluteStart =
        baseOffset +
        lines.slice(0, startLineIndex).join("\n").length +
        (startLineIndex > 0 ? 1 : 0);
    const absoluteEnd = absoluteStart + value.length;

    addToken(tokens, type, value, absoluteStart, absoluteEnd, blockId);
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
        let blockEnd = currentOffset + line.length;
        const tokens = [];

        // Emit mapkey.name token from declaration
        const nameStart = line.indexOf(mapkeyName);
        const nameEnd = nameStart + mapkeyName.length;
        addToken(tokens, "mapkey.name", mapkeyName, currentOffset + nameStart, currentOffset + nameEnd, blockId);

        i++;

        // Collect continuation lines
        while (i < lines.length) {
            const nextLine = lines[i];
            const trimmed = nextLine.trim();

            if (trimmed === "") break;
            if (REGEX.CONTINUATION_COMMENT.test(trimmed)) {
                collected.push(nextLine);
                blockEnd += nextLine.length + 1;
                i++;
                if (trimmed.endsWith(";\\"))
                    continue;
                else
                    break;
            }
            if (!REGEX.MAPKEY_START.test(trimmed) && !REGEX.CONTINUATION_LINE_START.test(trimmed))
                break;

            collected.push(nextLine);
            blockEnd += nextLine.length + 1;
            i++;
        }

        const blockContent = collected.join("\n");

        // -----------------------------------------------------------------
        // Handle @MAPKEY_LABEL → mapkey.label
        // -----------------------------------------------------------------
        addRegexToken(collected, currentOffset, REGEX.MAPKEY_LABEL, "mapkey.label", tokens, blockId);

        // -----------------------------------------------------------------
        // Handle @MAPKEY_NAME → mapkey.description
        // -----------------------------------------------------------------
        addRegexToken(collected, currentOffset, REGEX.MAPKEY_NAME, "mapkey.description", tokens, blockId);

        blocks.push({
            id: blockId,
            name: mapkeyName,
            start: blockStart,
            end: blockEnd,
            content: blockContent,
            tokens
        });

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
    addRegexToken,
    REGEX
};