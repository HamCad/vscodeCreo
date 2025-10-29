// ============================================================================
// PHASE 1: BLOCK TOKENIZER (BOUNDARY DETECTION ONLY)
// ============================================================================
//
// PURPOSE
// - Identify start and end of each mapkey block.
// - Normalize macro commands (~ ... ;) including multiline ones.
// - Collect continuation comments and continuation lines.
//
// This module DOES NOT parse labels, names, or descriptions.
// ============================================================================

// -----------------------------------------------------------------------------
// REGEX DEFINITIONS
// -----------------------------------------------------------------------------
const REGEX = {
  MAPKEY_START: /^mapkey\s+/,
  CONTINUATION_LINE: /^mapkey\(continued\).*[\\;]?$/,
  CONTINUATION_LINE_START: /^mapkey\(continued\)\s*/,
  CONTINUATION_LINE_END: /\\$/,
  CONTINUATION_COMMENT: /^mapkey\(continued\)\s*!/,
  MACRO_START: /^~/,
  MACRO_END: /;$/,
  MAPKEY_END: /;\\?$/
};

// -----------------------------------------------------------------------------
// TOKEN UTILITIES
// -----------------------------------------------------------------------------
function addToken(list, type, value, start, end, blockId = null) {
  list.push({ type, value, start, end, blockId });
}

// -----------------------------------------------------------------------------
// EXTRACT MAPKEY BLOCKS
// -----------------------------------------------------------------------------
function extractMapkeyBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let i = 0;
  let offset = 0;

  while (i < lines.length) {
    const line = lines[i];
    const lineTrim = line.trim();

    // Look for MAPKEY_START
    if (!REGEX.MAPKEY_START.test(lineTrim)) {
      offset += line.length + 1;
      i++;
      continue;
    }

    const blockStart = offset;
    const blockLines = [line];
    const blockId = `mapkey_${i}`;

    i++;
    offset += line.length + 1;

    // Collect continuation lines and comments until MAPKEY_END
    while (i < lines.length) {
      const next = lines[i];
      const trimmed = next.trim();

      if (REGEX.MAPKEY_START.test(trimmed)) break; // Next mapkey begins → stop
      blockLines.push(next);
      offset += next.length + 1;
      i++;

      if (REGEX.MAPKEY_END.test(trimmed) && !REGEX.CONTINUATION_LINE_END.test(trimmed))
        break;
    }

    const rawBlock = blockLines.join("\n");

    // -------------------------------------------------------------------------
    // NORMALIZE MACRO COMMANDS (~ ... ;)
    // -------------------------------------------------------------------------
    const macroLines = [];
    let currentMacro = "";

    for (let rawLine of blockLines) {
      const line = rawLine.trim();

      if (REGEX.CONTINUATION_COMMENT.test(line)) {
        macroLines.push(line);
        continue;
      }

      // Handle macro start
      if (REGEX.MACRO_START.test(line)) {
        const cleanLine = line.replace(REGEX.CONTINUATION_LINE_START, "");

        if (REGEX.CONTINUATION_LINE_END.test(cleanLine)) {
          currentMacro += cleanLine.replace(REGEX.CONTINUATION_LINE_END, "");
          continue;
        }

        if (REGEX.MACRO_END.test(cleanLine)) {
          macroLines.push(cleanLine);
          currentMacro = "";
        } else {
          currentMacro += cleanLine;
        }

        continue;
      }

      // Handle continuation of a macro across multiple lines
      if (REGEX.CONTINUATION_LINE.test(line) && currentMacro) {
        let clean = line.replace(REGEX.CONTINUATION_LINE_START, "");
        if (REGEX.CONTINUATION_LINE_END.test(clean)) {
          currentMacro += clean.replace(REGEX.CONTINUATION_LINE_END, "");
        } else {
          currentMacro += clean;
          macroLines.push(currentMacro);
          currentMacro = "";
        }
        continue;
      }
    }

    const blockContent = macroLines.join("\n");

    blocks.push({
      id: blockId,
      start: blockStart,
      end: offset,
      content: blockContent
    });
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
