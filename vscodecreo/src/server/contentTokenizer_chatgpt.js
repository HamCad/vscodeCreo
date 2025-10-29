// ============================================================================
// PHASE 2: CONTENT TOKENIZER (MAPKEY LABEL + NAME EXTRACTION)
// ============================================================================
//
// PURPOSE
// - Parse block content created by blockTokenizer
// - Extract @MAPKEY_NAME and @MAPKEY_LABEL fields
// ============================================================================

const { extractMapkeyBlocks } = require("./blockTokenizer");

const REGEX = {
  MAPKEY_NAME: /@MAPKEY_NAME([^\n;]*)/i,
  MAPKEY_LABEL: /@MAPKEY_LABEL([^\n;]*)/i
};

function tokenizeContent(text) {
  const blocks = extractMapkeyBlocks(text);
  const results = [];

  for (const block of blocks) {
    const tokens = [];

    const nameMatch = block.content.match(REGEX.MAPKEY_NAME);
    if (nameMatch) {
      tokens.push({
        type: "mapkey.name",
        value: nameMatch[1].trim(),
      });
    }

    const labelMatch = block.content.match(REGEX.MAPKEY_LABEL);
    if (labelMatch) {
      tokens.push({
        type: "mapkey.label",
        value: labelMatch[1].trim(),
      });
    }

    results.push({
      id: block.id,
      start: block.start,
      end: block.end,
      content: block.content,
      tokens
    });
  }

  return results;
}

module.exports = { tokenizeContent };
