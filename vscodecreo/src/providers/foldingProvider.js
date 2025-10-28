const vscode = require("vscode")

const tokenizer = require("../server/tokenizer");
const mapkeyStructure = require("../server/mapkeyStructure");

class MapkeyFoldingProvider {
    provideFoldingRanges(document, _context, _token) {
        const foldingRanges = [];
        // Handle Region Folding (!region ... !endregion)
        this.addRegionFolding(document, foldingRanges);
        // Handle Mapkey Folding
        this.addMapkeyFolding(document, foldingRanges);
        return foldingRanges;
    }
    /**
     * Add folding ranges for !region ... !endregion blocks
     */
    addRegionFolding(document, foldingRanges) {
        const text = document.getText();
        const tokens = (0, tokenizer.tokenize)(text);
        // Find all region markers
        const regionStarts = [];
        const regionEnds = [];
        for (const token of tokens) {
            if (token.type === 'region.start') {
                const line = document.positionAt(token.start).line;
                regionStarts.push(line);
            }
            else if (token.type === 'region.end') {
                const line = document.positionAt(token.start).line;
                regionEnds.push(line);
            }
        }
        // Match region starts with ends
        const stack = [];
        let endIndex = 0;
        for (const startLine of regionStarts) {
            stack.push(startLine);
        }
        for (const endLine of regionEnds) {
            if (stack.length > 0) {
                const startLine = stack.pop();
                // Only create folding range if there's at least one line between
                if (endLine > startLine) {
                    foldingRanges.push(new vscode.FoldingRange(startLine, endLine, vscode.FoldingRangeKind.Region));
                }
            }
        }
    }
    /**
     * Add folding ranges for mapkey blocks
     * Folds from the mapkey declaration line to the last line of the mapkey
     */
    addMapkeyFolding(document, foldingRanges) {
        const text = document.getText();
        const mapkeys = (0, mapkeyStructure.parseMapkeys)(text);
        for (const mapkey of mapkeys) {
            const startLine = document.positionAt(mapkey.range.start).line;
            const endLine = document.positionAt(mapkey.range.end).line;
            // Only create folding range if mapkey spans multiple lines
            if (endLine > startLine) {
                foldingRanges.push(new vscode.FoldingRange(startLine, endLine, vscode.FoldingRangeKind.Region));
            }
        }
    }
}
exports.MapkeyFoldingProvider = MapkeyFoldingProvider;
//# sourceMappingURL=foldingProvider.js.map