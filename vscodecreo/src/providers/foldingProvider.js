const vscode = require("vscode");
const tokenizer = require("../server/tokenizer");
const mapkeyStructure = require("../server/mapkeyStructure");

class MapkeyFoldingProvider {
    provideFoldingRanges(document, _context, _token) {
        const foldingRanges = [];
        this.addRegionFolding(document, foldingRanges);
        this.addMapkeyFolding(document, foldingRanges);
        return foldingRanges;
    }

    /**
     * Add folding ranges for !region ... !endregion blocks
     */
    addRegionFolding(document, foldingRanges) {
        const text = document.getText();
        // Use document-level tokens so regions outside mapkey blocks are found
        const tokens = tokenizer.tokenize(text);

        const regionStarts = [];
        const regionEnds = [];
        for (const token of tokens) {
            if (token.type === 'region.start') {
                regionStarts.push(document.positionAt(token.start).line);
            } else if (token.type === 'region.end') {
                regionEnds.push(document.positionAt(token.start).line);
            }
        }

        // Pair starts/ends as a simple stack (LIFO)
        const stack = [];
        for (const startLine of regionStarts) stack.push(startLine);

        for (const endLine of regionEnds) {
            if (stack.length > 0) {
                const startLine = stack.pop();
                if (endLine > startLine) {
                    foldingRanges.push(new vscode.FoldingRange(startLine, endLine, vscode.FoldingRangeKind.Region));
                }
            }
        }

        // Begin Console Logging
        console.log("Tokens found:", tokens.length);
        // End Console Logging

    }

    /**
     * Add folding ranges for mapkey blocks
     */
    addMapkeyFolding(document, foldingRanges) {
        const text = document.getText();
        const mapkeys = mapkeyStructure.parseMapkeys(text);
        for (const mapkey of mapkeys) {
            const startLine = document.positionAt(mapkey.range.start).line;
            const endLine = document.positionAt(mapkey.range.end).line;
            if (endLine > startLine) {
                foldingRanges.push(new vscode.FoldingRange(startLine, endLine, vscode.FoldingRangeKind.Region));
            }
        }
    }
}

module.exports = {
    MapkeyFoldingProvider
};
