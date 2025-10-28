// ============================================================================
// PHASE 1: BLOCK-LEVEL TOKENIZER
// ============================================================================
//
// PURPOSE
// Identifies and extracts complete mapkey definitions from raw document text.
// A "block" is a contiguous set of lines belonging to one mapkey.
//
// Each block object returned contains:
//   {
//      id, name, start, end, content, tokens:[]
//   }
//
// To add new block-level detection logic (for other structure types):
//   1. Define new regex constants below.
//   2. Extend the main loop with your detection logic.
//
// ============================================================================

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------
const REGEX = {
    DECLARATION: /^mapkey\s+([^\s;]+)/,
    CONTINUATION: /^mapkey\(continued\)/,
    COMMENT: /^\s*!/,
};

// -----------------------------------------------------------------------------
// TOKEN UTILITIES
// -----------------------------------------------------------------------------
function addToken(list, type, value, start, end, blockId = null) {
    list.push({ type, value, start, end, blockId });
}

// -----------------------------------------------------------------------------
// EXTRACT ALL MAPKEY BLOCKS
// -----------------------------------------------------------------------------
function extractMapkeyBlocks(text) {
    const blocks = [];
    const lines = text.split("\n");

    let currentOffset = 0; // Tracks absolute char index
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

        // Collect all continuation lines
        const collected = [line];
        let blockEnd = currentOffset + line.length;
        i++;

        while (i < lines.length) {
            const nextLine = lines[i];
            const trimmed = nextLine.trim();

            // stop on blank line
            if (trimmed === "") break;

            // comment line
            if (REGEX.COMMENT.test(trimmed)) {
                collected.push(nextLine);
                blockEnd += nextLine.length + 1;
                i++;
                // continue only if line ends with ;\
                if (trimmed.endsWith(";\\"))
                    continue;
                else
                    break;
            }

            // continuation lines
            if (!REGEX.CONTINUATION.test(trimmed)) break;
            collected.push(nextLine);
            blockEnd += nextLine.length + 1;

            if (trimmed.endsWith(";\\"))
                i++;
            else if (trimmed.endsWith(";")) {
                i++;
                break;
            } else {
                i++;
                break;
            }
        }

        // Combine block content
        const blockContent = collected.join("\n");

        blocks.push({
            id: blockId,
            name: mapkeyName,
            start: blockStart,
            end: blockEnd,
            content: blockContent,
            tokens: []
        });

        // Update offset up to current line
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
    REGEX
};

/**
 * ---------------------------------------------------------------------------
 * HOW TO EXTEND THIS MODULE
 * ---------------------------------------------------------------------------
 * Example: adding detection for custom top-level block type:
 *
 * 1. Define a new regex:
 *      const REGEX = { ... , CUSTOMBLOCK: /^custom\s+(\w+)/ };
 *
 * 2. Inside main while-loop, before DECLARATION test:
 *      const customMatch = line.match(REGEX.CUSTOMBLOCK);
 *      if (customMatch) {
 *          // Collect until terminator
 *          const block = collectCustomBlock(lines, i);
 *          blocks.push(block);
 *          continue;
 *      }
 *
 * 3. Define helper like collectCustomBlock() using same pattern as mapkey.
 *
 * 4. No other files need updates unless you want special tokenization later.
 *
 * ---------------------------------------------------------------------------
 */
