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
exports.CreoHoverProvider = void 0;
const vscode = __importStar(require("vscode"));
const tokenizer_1 = require("../server/tokenizer");
const mapkeyStructure_1 = require("../server/mapkeyStructure");
class CreoHoverProvider {
    provideHover(document, position, _token) {
        const text = document.getText();
        const offset = document.offsetAt(position);
        const tokens = (0, tokenizer_1.tokenize)(text);
        const token = tokens.find(t => offset >= t.start && offset < t.end);
        if (!token)
            return;
        const md = new vscode.MarkdownString();
        const allMapkeys = (0, mapkeyStructure_1.parseMapkeys)(text);
        const line = document.positionAt(token.start).line + 1;
        // === CASE 1: hovering a mapkey name or continuation ===
        if (token.type === 'mapkey.name' || token.type.startsWith('mapkey.continuation')) {
            const current = allMapkeys.find(mk => offset >= mk.range.start && offset <= mk.range.end);
            if (current) {
                md.appendMarkdown(`## Mapkey \`${current.name}\`\n`);
                md.appendMarkdown(`${current.label}\n\n`);
                const defLine = document.positionAt(current.range.start).line + 1;
                const defUri = `${document.uri.toString()}#L${defLine}`;
                md.appendMarkdown(`**Defined at:** [Line ${defLine}](${defUri})\n\n`);
                // Show nested mapkeys if any
                if (current.calledMapkeys && current.calledMapkeys.length > 0) {
                    md.appendMarkdown(`**Calls:** ${current.calledMapkeys.join(', ')}\n\n`);
                }
                md.appendMarkdown(`**Range:** Lines ${document.positionAt(current.range.start).line + 1} - ${document.positionAt(current.range.end).line + 1}\n\n`);
                md.appendMarkdown(`---\n\n`);
                // find all mapkeys that call this one
                const refs = allMapkeys
                    .filter(mk => mk.calledMapkeys?.includes(token.value))
                    .map(mk => {
                    const line = document.positionAt(mk.range.start).line + 1;
                    const uri = `${document.uri.toString()}#L${line}`;
                    return `[${mk.name}](${uri}) (line ${line})`;
                });
                if (refs.length > 0)
                    md.appendMarkdown(`**Called by:**\n\n${refs.join('\n\n')}\n\n`);
                else
                    md.appendMarkdown(`**Called by:** none\n\n`);
            }
        }
        // === CASE 2: hovering a nested call ===
        if (token.type === 'mapkey.nested.name') {
            const def = allMapkeys.find(mk => mk.name === token.value);
            if (def) {
                md.appendMarkdown(`## Nested mapkey: \`${token.value}\`\n`);
                if (def.label)
                    md.appendMarkdown(`${def.label}\n\n`);
                const defLine = document.positionAt(def.range.start).line + 1;
                const defUri = `${document.uri.toString()}#L${defLine}`;
                md.appendMarkdown(`**Defined at:** [Line ${defLine}](${defUri})\n\n`);
            }
            const parents = allMapkeys
                .filter(mk => mk.calledMapkeys?.includes(token.value))
                .map(mk => {
                const line = document.positionAt(mk.range.start).line + 1;
                const uri = `${document.uri.toString()}#L${line}`;
                return `[${mk.name}](${uri}) (line ${line})`;
            });
            if (parents.length > 0)
                md.appendMarkdown(`**Used in:** \n\n${parents.join('\n\n')}\n\n`);
            else
                md.appendMarkdown(`**Used in:** none\n\n`);
        }
        md.appendMarkdown(`---\n`);
        md.appendMarkdown(`**Token:** \`${token.value}\`  \n**Type:** \`${token.type}\`  \n**Line:** ${line}`);
        md.isTrusted = true;
        return new vscode.Hover(md);
    }
}
exports.CreoHoverProvider = CreoHoverProvider;
//# sourceMappingURL=hoverProvider_v2.js.map