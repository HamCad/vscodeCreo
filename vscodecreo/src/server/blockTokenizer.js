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
function addSimpleToken(list, type, value, blockId = null) {
    list.push({ type, value, blockId });
}


// -----------------------------------------------------------------------------
// HELPER: FLATTEN MULTILINE TOKEN
// -----------------------------------------------------------------------------
function flattenMultiLine(lines, startIndex, startRegex, endRegex) {
    const valueLines = [];
    let i = startIndex;

    while (i < lines.length) {
        let line = lines[i];

        // Remove continuation prefix if present
        line = line.replace(startRegex, "").trim();

        // Check if line ends with continuation
        const endsWithContinuation = endRegex.test(line);
        if (endsWithContinuation) {
            // Remove trailing backslash
            line = line.replace(endRegex, "").trim();
        }

        valueLines.push(line);
        i++;

        if (!endsWithContinuation) break;
    }

    return { value: valueLines.join(" "), linesConsumed: i - startIndex };
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

        // Emit mapkey.name from declaration
        const nameStart = line.indexOf(mapkeyName);
        const nameEnd = nameStart + mapkeyName.length;
        addToken(tokens, "mapkey.name", mapkeyName, currentOffset + nameStart, currentOffset + nameEnd, blockId);

        i++;

        // Collect continuation lines
        while (i < lines.length) {
            const nextLine = lines[i];
            const trimmed = nextLine.trim();

            if (trimmed === "") break;

            // handle comment continuation lines (no need to check endsWith)
            if (REGEX.CONTINUATION_COMMENT.test(trimmed)) {
                collected.push(nextLine);
                blockEnd += nextLine.length + 1;
                i++;
                continue;
            }

            if (!REGEX.CONTINUATION_LINE.test(trimmed)) break;

            collected.push(nextLine);
            blockEnd += nextLine.length + 1;
            i++;
        }

        const blockContent = collected.join("\n");

        // Extract @MAPKEY_LABEL token
        const labelLineIndex = collected.findIndex(l => REGEX.MAPKEY_LABEL.test(l));
        if (labelLineIndex !== -1) {
            const { value: labelValue } = flattenMultiLine(
                collected,
                labelLineIndex,
                REGEX.CONTINUATION_LINE_START,
                REGEX.CONTINUATION_LINE_END
            );
            addSimpleToken(tokens, "mapkey.label", labelValue, blockId);
        }

        // Extract @MAPKEY_NAME → mapkey.description
        const descLineIndex = collected.findIndex(l => REGEX.MAPKEY_NAME.test(l));
        if (descLineIndex !== -1) {
            const { value: descValue } = flattenMultiLine(
                collected,
                descLineIndex,
                REGEX.CONTINUATION_LINE_START,
                REGEX.CONTINUATION_LINE_END
            );
            addSimpleToken(tokens, "mapkey.description", descValue, blockId);
        }

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
    addSimpleToken,
    flattenMultiLine,
    REGEX
};
