const vscode = require("vscode");
const tokenizer = require("../server/tokenizer");


class ProHoverProvider {
    provideHover(document, position, _token) {
        const text = document.getText();
        const offset = document.offsetAt(position);

        // Get all tokens across document (includes mapkey block tokens + document-level tokens)
        const tokens = tokenizer.tokenize(text);
        const token = tokens.find(t => offset >= t.start && offset < t.end);
        if (!token) return;

        const md = new vscode.MarkdownString();
        const line = document.positionAt(token.start).line + 1;

        // Begin Console Logging
        console.log("Hover provider triggered");
        console.log("Token count:", tokens.length);
        // End Console Logging

        md.appendMarkdown(`**Token:** \`${token.value}\`  \n**Type:** \`${token.type}\`  \n**Line:** ${line}`);
        md.isTrusted = true;
        return new vscode.Hover(md);
    }
}

module.exports = {
    ProHoverProvider
};



// Complete Hover Provider Below

// const mapkeyStructure = require("../server/mapkeyStructure"); 
//
// class ProHoverProvider {
//     provideHover(document, position, _token) {
//         const text = document.getText();
//         const offset = document.offsetAt(position);
//         const tokens = (0, tokenizer.tokenize)(text);
//         const token = tokens.find(t => offset >= t.start && offset < t.end);
//         if (!token)
//             return;
//         const md = new vscode.MarkdownString();
//         const allMapkeys = (0, mapkeyStructure.parseMapkeys)(text);
//         const line = document.positionAt(token.start).line + 1;
//         // === CASE 1: hovering a mapkey name or continuation ===
//         if (token.type === 'mapkey.name' || token.type.startsWith('mapkey.continuation')) {
//             const current = allMapkeys.find(mk => offset >= mk.range.start && offset <= mk.range.end);
//             if (current) {
//                 md.appendMarkdown(`## Mapkey \`${current.name}\`\n`);
//                 md.appendMarkdown(`${current.label}\n\n`);
//                 const defLine = document.positionAt(current.range.start).line + 1;
//                 const defUri = `${document.uri.toString()}#L${defLine}`;
//                 md.appendMarkdown(`**Defined at:** [Line ${defLine}](${defUri})\n\n`);
//                 // Show nested mapkeys if any
//                 if (current.calledMapkeys && current.calledMapkeys.length > 0) {
//                     md.appendMarkdown(`**Calls:** ${current.calledMapkeys.join(', ')}\n\n`);
//                 }
//                 md.appendMarkdown(`**Range:** Lines ${document.positionAt(current.range.start).line + 1} - ${document.positionAt(current.range.end).line + 1}\n\n`);
//                 md.appendMarkdown(`---\n\n`);
//                 // find all mapkeys that call this one
//                 const refs = allMapkeys
//                     .filter(mk => mk.calledMapkeys?.includes(token.value))
//                     .map(mk => {
//                     const line = document.positionAt(mk.range.start).line + 1;
//                     const uri = `${document.uri.toString()}#L${line}`;
//                     return `[${mk.name}](${uri}) (line ${line})`;
//                 });
//                 if (refs.length > 0)
//                     md.appendMarkdown(`**Called by:**\n\n${refs.join('\n\n')}\n\n`);
//                 else
//                     md.appendMarkdown(`**Called by:** none\n\n`);
//             }
//         }
//         // === CASE 2: hovering a nested call ===
//         if (token.type === 'mapkey.nested.name') {
//             const def = allMapkeys.find(mk => mk.name === token.value);
//             if (def) {
//                 md.appendMarkdown(`## Nested mapkey: \`${token.value}\`\n`);
//                 if (def.label)
//                     md.appendMarkdown(`${def.label}\n\n`);
//                 const defLine = document.positionAt(def.range.start).line + 1;
//                 const defUri = `${document.uri.toString()}#L${defLine}`;
//                 md.appendMarkdown(`**Defined at:** [Line ${defLine}](${defUri})\n\n`);
//             }
//             const parents = allMapkeys
//                 .filter(mk => mk.calledMapkeys?.includes(token.value))
//                 .map(mk => {
//                 const line = document.positionAt(mk.range.start).line + 1;
//                 const uri = `${document.uri.toString()}#L${line}`;
//                 return `[${mk.name}](${uri}) (line ${line})`;
//             });
//             if (parents.length > 0)
//                 md.appendMarkdown(`**Used in:** \n\n${parents.join('\n\n')}\n\n`);
//             else
//                 md.appendMarkdown(`**Used in:** none\n\n`);
//         }
//         md.appendMarkdown(`---\n`);
//         md.appendMarkdown(`**Token:** \`${token.value}\`  \n**Type:** \`${token.type}\`  \n**Line:** ${line}`);
//         md.isTrusted = true;
//         return new vscode.Hover(md);
//     }
// }