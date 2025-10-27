import * as vscode from 'vscode';
import { tokenize } from '../server/tokenizer';
import { parseMapkeys } from '../server/mapkeyStructure';

interface RegionMarker {
    line: number;
    type: 'start' | 'end';
}

export class CreoFoldingProvider implements vscode.FoldingRangeProvider {
    provideFoldingRanges(
        document: vscode.TextDocument,
        _context: vscode.FoldingContext,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.FoldingRange[]> {
        const foldingRanges: vscode.FoldingRange[] = [];
        
        // Handle Region Folding (!region ... !endregion)
        this.addRegionFolding(document, foldingRanges);
        
        // Handle Mapkey Folding
        this.addMapkeyFolding(document, foldingRanges);
        
        return foldingRanges;
    }

    /**
     * Add folding ranges for !region ... !endregion blocks
     */
    private addRegionFolding(
        document: vscode.TextDocument,
        foldingRanges: vscode.FoldingRange[]
    ): void {
        const text = document.getText();
        const tokens = tokenize(text);
        
        // Find all region markers
        const regionStarts: number[] = [];
        const regionEnds: number[] = [];
        
        for (const token of tokens) {
            if (token.type === 'region.start') {
                const line = document.positionAt(token.start).line;
                regionStarts.push(line);
            } else if (token.type === 'region.end') {
                const line = document.positionAt(token.start).line;
                regionEnds.push(line);
            }
        }
        
        // Match region starts with ends
        const stack: number[] = [];
        let endIndex = 0;
        
        for (const startLine of regionStarts) {
            stack.push(startLine);
        }
        
        for (const endLine of regionEnds) {
            if (stack.length > 0) {
                const startLine = stack.pop()!;
                
                // Only create folding range if there's at least one line between
                if (endLine > startLine) {
                    foldingRanges.push(
                        new vscode.FoldingRange(
                            startLine,
                            endLine,
                            vscode.FoldingRangeKind.Region
                        )
                    );
                }
            }
        }
    }

    /**
     * Add folding ranges for mapkey blocks
     * Folds from the mapkey declaration line to the last line of the mapkey
     */
    private addMapkeyFolding(
        document: vscode.TextDocument,
        foldingRanges: vscode.FoldingRange[]
    ): void {
        const text = document.getText();
        const mapkeys = parseMapkeys(text);
        
        for (const mapkey of mapkeys) {
            const startLine = document.positionAt(mapkey.range.start).line;
            const endLine = document.positionAt(mapkey.range.end).line;
            
            // Only create folding range if mapkey spans multiple lines
            if (endLine > startLine) {
                foldingRanges.push(
                    new vscode.FoldingRange(
                        startLine,
                        endLine,
                        vscode.FoldingRangeKind.Region
                    )
                );
            }
        }
    }
}