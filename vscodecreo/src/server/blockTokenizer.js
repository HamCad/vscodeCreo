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
    CONTINUATION_COMMENT: /^\s*!.+;\\$/,
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
function flattenMultiLine(lines, startIndex) {
    const valueLines = [];
    let i = startIndex;

    while (i < lines.length) {
        let line = lines[i];

        // Remove continuation prefix if present
        line = line.replace(/^mapkey\(continued\)\s*/, "");

        // Remove trailing backslash
        const endsWithBackslash = line.endsWith("\\");
        if (endsWithBackslash) line = line.slice(0, -1);

        valueLines.push(line.trim());

        i++;
        if (!endsWithBackslash) break;
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

            if (!REGEX.CONTINUATION_LINE.test(trimmed)) break;

            collected.push(nextLine);
            blockEnd += nextLine.length + 1;
            i++;
        }

        const blockContent = collected.join("\n");

        // Extract @MAPKEY_LABEL token
        const labelLineIndex = collected.findIndex(l => REGEX.MAPKEY_LABEL.test(l));
        if (labelLineIndex !== -1) {
            const { value: labelValue } = flattenMultiLine(collected, labelLineIndex);
            addSimpleToken(tokens, "mapkey.label", labelValue, blockId);
        }

        // Extract @MAPKEY_NAME token (if different from declaration)
        const mapkeyNameLineIndex = collected.findIndex(l => REGEX.MAPKEY_NAME.test(l));
        if (mapkeyNameLineIndex !== -1) {
            const { value: mapkeyNameValue } = flattenMultiLine(collected, mapkeyNameLineIndex);
            addSimpleToken(tokens, "mapkey.name", mapkeyNameValue, blockId);
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
    REGEX
};
