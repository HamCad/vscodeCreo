const vscode = require("vscode")

const tokenizer = require("./tokenizer");
/**
 * Parse text and return structured mapkey definitions
 */
function parseMapkeys(text) {
    const blocks = (0, tokenizer.getMapkeyBlocks)(text);
    const mapkeys = [];
    for (const block of blocks) {
        const mapkey = buildMapkeyDefinition(block);
        mapkeys.push(mapkey);
    }
    return mapkeys;
}
/**
 * Build a complete MapkeyDefinition from a MapkeyBlock
 */
function buildMapkeyDefinition(block) {
    const tokens = block.tokens;
    // Find the name token
    const nameToken = tokens.find(t => t.type === 'mapkey.name');
    // Find description
    const descriptionToken = tokens.find(t => t.type === 'mapkey.description');
    // Find label
    const labelToken = tokens.find(t => t.type === 'mapkey.label');
    // Find system commands
    const systemCmdToken = tokens.find(t => t.type === 'mapkey.system.instruction');
    // Find all nested mapkey calls
    const nestedTokens = tokens.filter(t => t.type === 'mapkey.nested.name');
    const calledMapkeys = nestedTokens.map(t => t.value);
    return {
        name: block.name,
        nameToken,
        description: descriptionToken?.value,
        descriptionToken,
        label: labelToken?.value,
        labelToken,
        system: systemCmdToken?.value,
        systemCmdToken,
        block,
        range: {
            start: block.start,
            end: block.end
        },
        allTokens: tokens,
        calledMapkeys,
        nestedTokens
    };
}
/**
 * Find the mapkey definition at a given position
 */
function getMapkeyAtPosition(text, position) {
    const mapkeys = parseMapkeys(text);
    return mapkeys.find(mk => position >= mk.range.start && position <= mk.range.end) || null;
}
/**
 * Get all mapkey names in the document (useful for autocomplete/references)
 */
function getAllMapkeyNames(text) {
    const mapkeys = parseMapkeys(text);
    return mapkeys.map(mk => mk.name);
}
/**
 * Find all references to a specific mapkey name
 */
function findMapkeyReferences(text, mapkeyName) {
    const mapkeys = parseMapkeys(text);
    return mapkeys.filter(mk => mk.name === mapkeyName);
}
function buildCallGraph(text) {
    const mapkeys = parseMapkeys(text);
    const graph = {};
    for (const mapkey of mapkeys) {
        graph[mapkey.name] = mapkey.calledMapkeys;
    }
    return graph;
}
/**
 * Find which mapkeys use a specific mapkey
 */
function findMapkeyUsages(text, targetMapkey) {
    const mapkeys = parseMapkeys(text);
    return mapkeys.filter(mk => mk.calledMapkeys.includes(targetMapkey));
}
/**
 * Get dependency depth (how many nested calls)
 */
function getMapkeyDepth(text, mapkeyName) {
    const callGraph = buildCallGraph(text);
    function calculateDepth(name, visited = new Set()) {
        if (visited.has(name))
            return 0; // Circular reference
        visited.add(name);
        const callees = callGraph[name] || [];
        if (callees.length === 0)
            return 0;
        const depths = callees.map(callee => calculateDepth(callee, new Set(visited)));
        return 1 + Math.max(...depths, 0);
    }
    return calculateDepth(mapkeyName);
}
/**
 * Find circular dependencies
 */
function findCircularDependencies(text) {
    const callGraph = buildCallGraph(text);
    const cycles = [];
    const visited = new Set();
    function findCycles(name, path = []) {
        if (path.includes(name)) {
            // Found a cycle
            const cycleStart = path.indexOf(name);
            cycles.push([...path.slice(cycleStart), name]);
            return;
        }
        if (visited.has(name))
            return;
        const callees = callGraph[name] || [];
        for (const callee of callees) {
            findCycles(callee, [...path, name]);
        }
    }
    for (const mapkeyName of Object.keys(callGraph)) {
        if (!visited.has(mapkeyName)) {
            findCycles(mapkeyName);
            visited.add(mapkeyName);
        }
    }
    return cycles;
}
/**
 * Check if a mapkey exceeds the 5-layer nesting limit
 */
function checkNestingDepth(text) {
    const mapkeys = parseMapkeys(text);
    const violations = [];
    for (const mapkey of mapkeys) {
        const depth = getMapkeyDepth(text, mapkey.name);
        if (depth > 5) {
            violations.push({ mapkey: mapkey.name, depth });
        }
    }
    return violations;
}
function getMapkeyFoldingRanges(text) {
    const mapkeys = parseMapkeys(text);
    return mapkeys.map(mk => ({
        start: mk.range.start,
        end: mk.range.end
    }));
}


module.exports = {
    parseMapkeys,
    getMapkeyAtPosition,
    getAllMapkeyNames,
    findMapkeyReferences,
    buildCallGraph,
    findMapkeyUsages,
    getMapkeyDepth,
    findCircularDependencies,
    checkNestingDepth,
    getMapkeyFoldingRanges
}