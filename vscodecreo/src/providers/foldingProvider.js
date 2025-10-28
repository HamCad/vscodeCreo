"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreoFoldingProvider = void 0;
const vscode = __importStar(require("vscode"));
const tokenizer_1 = require("../server/tokenizer");
const mapkeyStructure_1 = require("../server/mapkeyStructure");
class CreoFoldingProvider {
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
        const tokens = (0, tokenizer_1.tokenize)(text);
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
        const mapkeys = (0, mapkeyStructure_1.parseMapkeys)(text);
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
exports.CreoFoldingProvider = CreoFoldingProvider;
//# sourceMappingURL=foldingProvider.js.map