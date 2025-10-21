import { Token, tokenize } from './tokenizer';

/**
 * Represents a complete mapkey definition with all its components
 */
export interface MapkeyDefinition {
  name: string;
  nameToken: Token;
  description?: string;
  descriptionToken?: Token;
  label?: string;
  labelToken?: Token;
  startToken: Token;  // mapkey.begin
  endToken?: Token;   // mapkey.end
  allTokens: Token[]; // All tokens within this mapkey
  range: {
    start: number;
    end: number;
  };
}

/**
 * Parse text and return structured mapkey definitions
 */
export function parseMapkeys(text: string): MapkeyDefinition[] {
  const tokens = tokenize(text);
  const mapkeys: MapkeyDefinition[] = [];
  
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    
    // Look for mapkey.begin tokens
    if (token.type === 'mapkey.begin') {
      const mapkey = buildMapkeyDefinition(tokens, i);
      if (mapkey) {
        mapkeys.push(mapkey);
        // Skip to the end of this mapkey
        i = tokens.findIndex(t => t === mapkey.endToken);
        if (i === -1) i = tokens.length;
      }
    }
    i++;
  }
  
  return mapkeys;
}

/**
 * Build a complete MapkeyDefinition starting from a mapkey.begin token
 */
function buildMapkeyDefinition(tokens: Token[], startIndex: number): MapkeyDefinition | null {
  const beginToken = tokens[startIndex];
  if (beginToken.type !== 'mapkey.begin') return null;
  
  // Find the mapkey.name (should be right after begin)
  let nameToken: Token | undefined;
  let descriptionToken: Token | undefined;
  let labelToken: Token | undefined;
  let endToken: Token | undefined;
  
  // Collect all tokens that belong to this mapkey
  const mapkeyTokens: Token[] = [beginToken];
  
  // Look ahead to find the name and end of this mapkey
  for (let i = startIndex + 1; i < tokens.length; i++) {
    const token = tokens[i];
    
    // Get the name (should be immediately after begin)
    if (!nameToken && token.type === 'mapkey.name') {
      nameToken = token;
      mapkeyTokens.push(token);
      continue;
    }
    
    // Get description
    if (token.type === 'mapkey.description') {
      descriptionToken = token;
      mapkeyTokens.push(token);
      continue;
    }
    
    // Get label
    if (token.type === 'mapkey.label') {
      labelToken = token;
      mapkeyTokens.push(token);
      continue;
    }
    
    // Check if we've reached the end of this mapkey
    if (token.type === 'mapkey.end') {
      endToken = token;
      mapkeyTokens.push(token);
      break;
    }
    
    // Check if we've hit the start of a new mapkey (no end found)
    if (token.type === 'mapkey.begin') {
      // This mapkey has no explicit end
      break;
    }
    
    // Add all tokens in between to this mapkey
    mapkeyTokens.push(token);
  }
  
  // Must have at least a name
  if (!nameToken) return null;
  
  // Determine the range
  const rangeStart = beginToken.start;
  const rangeEnd = endToken ? endToken.end : mapkeyTokens[mapkeyTokens.length - 1].end;
  
  return {
    name: nameToken.value,
    nameToken,
    description: descriptionToken?.value,
    descriptionToken,
    label: labelToken?.value,
    labelToken,
    startToken: beginToken,
    endToken,
    allTokens: mapkeyTokens,
    range: {
      start: rangeStart,
      end: rangeEnd
    }
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
 * (This is a simple version - you'd expand this to search for actual usages)
 */
export function findMapkeyReferences(text: string, mapkeyName: string): MapkeyDefinition[] {
  const mapkeys = parseMapkeys(text);
  return mapkeys.filter(mk => mk.name === mapkeyName);
}

/**
 * Build a call graph of mapkey dependencies
 * (Looks for patterns like ~ Command `ProCmdMapkeys` followed by mapkey names)
 */
export interface MapkeyCallGraph {
  [mapkeyName: string]: string[]; // mapkey name -> list of mapkeys it calls
}

export function buildCallGraph(text: string): MapkeyCallGraph {
  const mapkeys = parseMapkeys(text);
  const graph: MapkeyCallGraph = {};
  
  // Simple pattern to find mapkey calls: look for other mapkey names in the body
  const allNames = mapkeys.map(mk => mk.name);
  
  for (const mapkey of mapkeys) {
    graph[mapkey.name] = [];
    
    // Get the text content of this mapkey
    const mapkeyText = text.substring(mapkey.range.start, mapkey.range.end);
    
    // Look for references to other mapkeys
    for (const otherName of allNames) {
      if (otherName === mapkey.name) continue;
      
      // Simple check: does the mapkey text contain the other mapkey's name?
      // You might want to make this more sophisticated
      if (mapkeyText.includes(otherName)) {
        graph[mapkey.name].push(otherName);
      }
    }
  }
  
  return graph;
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