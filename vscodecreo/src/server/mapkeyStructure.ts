import { Token, getMapkeyBlocks, MapkeyBlock } from './tokenizer';

/**
 * Represents a complete mapkey definition with all its components
 * This extends MapkeyBlock with derived properties
 */
export interface MapkeyDefinition {
  name: string;
  nameToken?: Token;
  description?: string;
  descriptionToken?: Token;
  label?: string;
  labelToken?: Token;
  system?: string,
  systemCmdToken?: Token;
  block: MapkeyBlock;  // Reference to the underlying block
  range: {
    start: number;
    end: number;
  };
  allTokens: Token[];  // All tokens within this mapkey
  calledMapkeys: string[];  // Mapkeys that this one calls
  nestedTokens?: Token[];  // Tokens for nested mapkey calls
}

/**
 * Parse text and return structured mapkey definitions
 */
export function parseMapkeys(text: string): MapkeyDefinition[] {
  const blocks = getMapkeyBlocks(text);
  const mapkeys: MapkeyDefinition[] = [];
  
  for (const block of blocks) {
    const mapkey = buildMapkeyDefinition(block);
    mapkeys.push(mapkey);
  }
  
  return mapkeys;
}

/**
 * Build a complete MapkeyDefinition from a MapkeyBlock
 */
function buildMapkeyDefinition(block: MapkeyBlock): MapkeyDefinition {
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
export function getMapkeyAtPosition(text: string, position: number): MapkeyDefinition | null {
  const mapkeys = parseMapkeys(text);
  return mapkeys.find(mk => position >= mk.range.start && position <= mk.range.end) || null;
}

/**
 * Get all mapkey names in the document (useful for autocomplete/references)
 */
export function getAllMapkeyNames(text: string): string[] {
  const mapkeys = parseMapkeys(text);
  return mapkeys.map(mk => mk.name);
}

/**
 * Find all references to a specific mapkey name
 */
export function findMapkeyReferences(text: string, mapkeyName: string): MapkeyDefinition[] {
  const mapkeys = parseMapkeys(text);
  return mapkeys.filter(mk => mk.name === mapkeyName);
}

/**
 * Build a call graph of mapkey dependencies
 */
export interface MapkeyCallGraph {
  [mapkeyName: string]: string[]; // mapkey name -> list of mapkeys it calls
}

export function buildCallGraph(text: string): MapkeyCallGraph {
  const mapkeys = parseMapkeys(text);
  const graph: MapkeyCallGraph = {};
  
  for (const mapkey of mapkeys) {
    graph[mapkey.name] = mapkey.calledMapkeys;
  }
  
  return graph;
}

/**
 * Find which mapkeys use a specific mapkey
 */
export function findMapkeyUsages(text: string, targetMapkey: string): MapkeyDefinition[] {
  const mapkeys = parseMapkeys(text);
  return mapkeys.filter(mk => mk.calledMapkeys.includes(targetMapkey));
}

/**
 * Get dependency depth (how many nested calls)
 */
export function getMapkeyDepth(text: string, mapkeyName: string): number {
  const callGraph = buildCallGraph(text);
  
  function calculateDepth(name: string, visited: Set<string> = new Set()): number {
    if (visited.has(name)) return 0; // Circular reference
    visited.add(name);
    
    const callees = callGraph[name] || [];
    if (callees.length === 0) return 0;
    
    const depths = callees.map(callee => calculateDepth(callee, new Set(visited)));
    return 1 + Math.max(...depths, 0);
  }
  
  return calculateDepth(mapkeyName);
}

/**
 * Find circular dependencies
 */
export function findCircularDependencies(text: string): string[][] {
  const callGraph = buildCallGraph(text);
  const cycles: string[][] = [];
  const visited = new Set<string>();
  
  function findCycles(name: string, path: string[] = []): void {
    if (path.includes(name)) {
      // Found a cycle
      const cycleStart = path.indexOf(name);
      cycles.push([...path.slice(cycleStart), name]);
      return;
    }
    
    if (visited.has(name)) return;
    
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
export function checkNestingDepth(text: string): { mapkey: string; depth: number }[] {
  const mapkeys = parseMapkeys(text);
  const violations: { mapkey: string; depth: number }[] = [];
  
  for (const mapkey of mapkeys) {
    const depth = getMapkeyDepth(text, mapkey.name);
    if (depth > 5) {
      violations.push({ mapkey: mapkey.name, depth });
    }
  }
  
  return violations;
}

/**
 * Get folding ranges for all mapkeys (for code folding)
 */
export interface FoldingRange {
  start: number;
  end: number;
  kind?: 'comment' | 'imports' | 'region';
}

export function getMapkeyFoldingRanges(text: string): FoldingRange[] {
  const mapkeys = parseMapkeys(text);
  return mapkeys.map(mk => ({
    start: mk.range.start,
    end: mk.range.end
  }));
}