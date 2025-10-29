// ============================================================================
// PHASE 1: BLOCK-LEVEL TOKENIZER
// ============================================================================
//
// PURPOSE
// Identifies and extracts complete mapkey definitions from raw document text.
// A "block" is a contiguous set of lines belonging to one mapkey.
// Each block contains the raw macro commands that will be parsed by contentTokenizer.
//
// ============================================================================

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------
const REGEX = {
    MAPKEY_START: /^mapkey\s/,
    CONTINUATION_LINE: /^\s*(?:mapkey\(continued\)|@).*\\$/,
    CONTINUATION_LINE_START: /^mapkey\(continued\)\s/,
    CONTINUATION_LINE_END: /\\$/,
    CONTINUATION_COMMENT: /^\s*!.+;\\$/,
    MACRO_START: /~/,
    MACRO_END: /;/,
    MAPKEY_END: /[^\\]$/
};

// -----------------------------------------------------------------------------
// EXTRACT ALL MAPKEY BLOCKS
// -----------------------------------------------------------------------------
/**
 * Extracts mapkey blocks from raw text.
 * Each block represents one complete mapkey definition with its macro commands.
 * 
 * @param {string} text - Raw document text
 * @returns {Array} Array of block objects with structure:
 *   {
 *     id: string,
 *     name: string,
 *     start: number,
 *     end: number,
 *     rawContent: string,
 *     blockContent: string[]
 *   }
 */
function extractMapkeyBlocks(text) {
    const blocks = [];
    const lines = text.split("\n");
    let currentOffset = 0;
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        
        // Check if this line starts a mapkey definition
        if (!REGEX.MAPKEY_START.test(line)) {
            currentOffset += line.length + 1;
            i++;
            continue;
        }

        // Extract mapkey name from declaration line
        const nameMatch = line.match(/^mapkey\s+([^\s]+)/);
        if (!nameMatch) {
            currentOffset += line.length + 1;
            i++;
            continue;
        }

        const mapkeyName = nameMatch[1];
        const blockStartLine = i;
        const blockStart = currentOffset;
        const blockId = `mapkey_${blockStartLine}_${mapkeyName}`;

        const rawLines = [line];
        const blockContent = [];
        let blockEnd = currentOffset + line.length;

        i++;

        // Collect continuation lines until we hit MAPKEY_END
        while (i < lines.length) {
            const nextLine = lines[i];
            const trimmed = nextLine.trim();

            // Empty line signals end of block
            if (trimmed === "") break;

            // Check if it's a continuation comment
            if (REGEX.CONTINUATION_COMMENT.test(trimmed)) {
                rawLines.push(nextLine);
                blockEnd += nextLine.length + 1;
                i++;
                
                // If comment ends with ;\, continue to next line
                if (trimmed.endsWith(";\\")) {
                    continue;
                } else {
                    break;
                }
            }

            // Check if it's a continuation line
            if (REGEX.CONTINUATION_LINE_START.test(trimmed)) {
                rawLines.push(nextLine);
                blockEnd += nextLine.length + 1;
                
                // Process macro commands from this line
                processLineForMacros(nextLine, blockContent);
                
                // Check if line ends without continuation
                if (REGEX.MAPKEY_END.test(trimmed) && !REGEX.CONTINUATION_LINE_END.test(trimmed)) {
                    i++;
                    break;
                }
                
                i++;
                continue;
            }

            // Not a continuation line, end of block
            break;
        }

        blocks.push({
            id: blockId,
            name: mapkeyName,
            start: blockStart,
            end: blockEnd,
            rawContent: rawLines.join("\n"),
            blockContent: blockContent
        });

        currentOffset = blockEnd + 1;
    }

    return blocks;
}

/**
 * Processes a line to extract macro commands and add them to blockContent.
 * Handles multi-line macros by accumulating them.
 * 
 * @param {string} line - The line to process
 * @param {Array} blockContent - Array to append macro commands to
 * @param {Object} state - State object to track if we're in a multi-line macro
 */
function processLineForMacros(line, blockContent, state) {
    // Remove continuation prefix
    let cleaned = line.replace(REGEX.CONTINUATION_LINE_START, "").trim();
    
    // Check if this line ends with continuation marker (backslash)
    const hasContinuation = REGEX.CONTINUATION_LINE_END.test(cleaned);
    
    // Remove trailing backslash if present
    if (hasContinuation) {
        cleaned = cleaned.replace(REGEX.CONTINUATION_LINE_END, "").trim();
    }
    
    // If we have content to add
    if (cleaned.length > 0) {
        // Check if we're continuing from a previous line
        if (state.continuingMacro) {
            // Append to previous macro
            blockContent[blockContent.length - 1] += ' ' + cleaned;
        } else {
            // Start new macro
            blockContent.push(cleaned);
        }
        
        // Update state: are we continuing onto next line?
        state.continuingMacro = hasContinuation;
    }
}

// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------
module.exports = {
    extractMapkeyBlocks,
    REGEX
};
