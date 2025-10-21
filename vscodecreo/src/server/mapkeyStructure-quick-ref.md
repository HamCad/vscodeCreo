# Mapkey Structure Rules of Thumb

### Key Highlights:
1. When to Update MapkeyDefinition

Only when you need to track NEW properties (like parameters, nested calls, etc.)
Most features work with the existing structure!

2. VS Code Provider Templates
Ready-to-use code for:

✅ Code Folding - Collapse/expand mapkeys
✅ Diagnostics - Show warnings/errors inline
✅ Go to Definition - F12 on a mapkey name
✅ Find All References - See where mapkeys are used
✅ Call Hierarchy - Visual tree of who calls whom

3. Enhanced Hover with Nesting Info

``// Shows:
// - Description & Label
// - "Used by: 3 mapkey(s)"
// - "Used in: MAPKEY_A, MAPKEY_B, MAPKEY_C" ``

4. Analysis Functions
Boilerplate for:

findMapkeyUsages() - Which mapkeys use this one?
getMapkeyDepth() - How many nested levels?
findCircularDependencies() - Detect infinite loops

5. Registration Pattern
Every provider follows the same pattern:

// 1. Create provider class
// 2. Import in extension.ts
// 3. Register with context.subscriptions.push()

You can copy/paste any provider template and it'll work immediately with your existing parseMapkeys() and buildCallGraph() functions!

## When to Update mapkeyStructure.ts

### Decision Tree

```
Adding a new feature?
│
├─ Need to find/navigate mapkeys?
│  └─ ✅ Use existing parseMapkeys() - No changes needed!
│
├─ Need to show mapkey info in UI? (hover, autocomplete, etc.)
│  └─ ✅ Use existing MapkeyDefinition - No changes needed!
│
├─ Need NEW information about mapkeys? (e.g., parameters, return values)
│  └─ 🔧 UPDATE MapkeyDefinition interface + buildMapkeyDefinition()
│
├─ Need to analyze relationships? (e.g., which mapkeys call others)
│  └─ 🔧 ADD new analysis function (like buildCallGraph)
│
└─ Need to provide VS Code features? (folding, diagnostics, etc.)
   └─ ✅ Use existing data + VS Code API - Add to extension.ts
```

---

## MapkeyDefinition Interface

**Update when:** You need to track NEW properties about a mapkey

### Current Structure
```typescript
export interface MapkeyDefinition {
  name: string;                    // Mapkey identifier
  nameToken: Token;                // Token for the name
  description?: string;            // @MAPKEY_NAME content
  descriptionToken?: Token;
  label?: string;                  // @MAPKEY_LABEL content
  labelToken?: Token;
  startToken: Token;               // mapkey.begin
  endToken?: Token;                // mapkey.end
  allTokens: Token[];              // All tokens within
  range: { start: number; end: number; }  // Position in document
}
```

### Example: Adding Parameters
```typescript
export interface MapkeyDefinition {
  // ... existing fields ...
  parameters?: MapkeyParameter[];  // NEW!
  callsMapkeys?: string[];         // NEW! List of mapkeys this one calls
}

interface MapkeyParameter {
  name: string;
  type?: string;
  defaultValue?: string;
}
```

Then update `buildMapkeyDefinition()` to populate these:
```typescript
function buildMapkeyDefinition(tokens: Token[], startIndex: number): MapkeyDefinition | null {
  // ... existing code ...
  
  // NEW: Extract parameters
  const parameters = extractParameters(mapkeyTokens);
  
  // NEW: Find called mapkeys
  const callsMapkeys = findCalledMapkeys(text, mapkeyTokens);
  
  return {
    // ... existing fields ...
    parameters,
    callsMapkeys
  };
}
```

---

## VS Code Integration Quick Reference

### 1. Code Folding Provider

**File:** `src/providers/foldingProvider.ts`

```typescript
import * as vscode from 'vscode';
import { getMapkeyFoldingRanges } from '../server/mapkeyStructure';

export class CreoFoldingProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(
    document: vscode.TextDocument,
    _context: vscode.FoldingContext,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FoldingRange[]> {
    const text = document.getText();
    const ranges = getMapkeyFoldingRanges(text);
    
    return ranges.map(range => {
      const startLine = document.positionAt(range.start).line;
      const endLine = document.positionAt(range.end).line;
      
      return new vscode.FoldingRange(
        startLine,
        endLine,
        vscode.FoldingRangeKind.Region
      );
    });
  }
}
```

**Register in extension.ts:**
```typescript
import { CreoFoldingProvider } from './providers/foldingProvider';

export function activate(context: vscode.ExtensionContext) {
  const selector: vscode.DocumentSelector = [{ language: 'pro', scheme: 'file' }];
  
  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      selector, 
      new CreoFoldingProvider()
    )
  );
}
```

---

### 2. Diagnostics Provider

**File:** `src/providers/diagnosticsProvider.ts`

```typescript
import * as vscode from 'vscode';
import { parseMapkeys } from '../server/mapkeyStructure';

export function provideDiagnostics(
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  const text = document.getText();
  const mapkeys = parseMapkeys(text);
  const diagnostics: vscode.Diagnostic[] = [];
  
  for (const mapkey of mapkeys) {
    // Check 1: Missing end token
    if (!mapkey.endToken) {
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(
          document.positionAt(mapkey.range.start),
          document.positionAt(mapkey.range.end)
        ),
        `Mapkey '${mapkey.name}' has no ending semicolon`,
        vscode.DiagnosticSeverity.Warning
      ));
    }
    
    // Check 2: Missing description
    if (!mapkey.description) {
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(
          document.positionAt(mapkey.nameToken.start),
          document.positionAt(mapkey.nameToken.end)
        ),
        `Mapkey '${mapkey.name}' has no @MAPKEY_NAME description`,
        vscode.DiagnosticSeverity.Information
      ));
    }
    
    // Check 3: Missing label
    if (!mapkey.label) {
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(
          document.positionAt(mapkey.nameToken.start),
          document.positionAt(mapkey.nameToken.end)
        ),
        `Mapkey '${mapkey.name}' has no @MAPKEY_LABEL`,
        vscode.DiagnosticSeverity.Hint
      ));
    }
  }
  
  return diagnostics;
}
```

**Register in extension.ts:**
```typescript
import { provideDiagnostics } from './providers/diagnosticsProvider';

export function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('creo');
  context.subscriptions.push(diagnosticCollection);
  
  // Update diagnostics on document change
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.languageId === 'pro') {
        const diagnostics = provideDiagnostics(event.document);
        diagnosticCollection.set(event.document.uri, diagnostics);
      }
    })
  );
  
  // Update diagnostics on document open
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(document => {
      if (document.languageId === 'pro') {
        const diagnostics = provideDiagnostics(document);
        diagnosticCollection.set(document.uri, diagnostics);
      }
    })
  );
}
```

---

### 3. Definition Provider (Go to Definition)

**File:** `src/providers/definitionProvider.ts`

```typescript
import * as vscode from 'vscode';
import { parseMapkeys } from '../server/mapkeyStructure';

export class CreoDefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Definition> {
    const text = document.getText();
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) return null;
    
    const word = document.getText(wordRange);
    const mapkeys = parseMapkeys(text);
    
    // Find the mapkey definition with this name
    const mapkey = mapkeys.find(mk => mk.name === word);
    if (!mapkey) return null;
    
    // Return the location of the mapkey definition
    return new vscode.Location(
      document.uri,
      new vscode.Range(
        document.positionAt(mapkey.nameToken.start),
        document.positionAt(mapkey.nameToken.end)
      )
    );
  }
}
```

**Register in extension.ts:**
```typescript
import { CreoDefinitionProvider } from './providers/definitionProvider';

context.subscriptions.push(
  vscode.languages.registerDefinitionProvider(
    selector,
    new CreoDefinitionProvider()
  )
);
```

---

### 4. Reference Provider (Find All References)

**File:** `src/providers/referenceProvider.ts`

```typescript
import * as vscode from 'vscode';
import { parseMapkeys, findMapkeyReferences } from '../server/mapkeyStructure';

export class CreoReferenceProvider implements vscode.ReferenceProvider {
  provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.ReferenceContext,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Location[]> {
    const text = document.getText();
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) return null;
    
    const word = document.getText(wordRange);
    const mapkeys = parseMapkeys(text);
    const locations: vscode.Location[] = [];
    
    // Find definition
    const definition = mapkeys.find(mk => mk.name === word);
    if (definition) {
      locations.push(new vscode.Location(
        document.uri,
        new vscode.Range(
          document.positionAt(definition.nameToken.start),
          document.positionAt(definition.nameToken.end)
        )
      ));
    }
    
    // Find all usages (mapkeys that call this one)
    for (const mapkey of mapkeys) {
      const mapkeyText = text.substring(mapkey.range.start, mapkey.range.end);
      
      // Simple search for the name in the mapkey body
      let searchPos = 0;
      while ((searchPos = mapkeyText.indexOf(word, searchPos)) !== -1) {
        const absolutePos = mapkey.range.start + searchPos;
        locations.push(new vscode.Location(
          document.uri,
          new vscode.Range(
            document.positionAt(absolutePos),
            document.positionAt(absolutePos + word.length)
          )
        ));
        searchPos += word.length;
      }
    }
    
    return locations;
  }
}
```

**Register in extension.ts:**
```typescript
import { CreoReferenceProvider } from './providers/referenceProvider';

context.subscriptions.push(
  vscode.languages.registerReferenceProvider(
    selector,
    new CreoReferenceProvider()
  )
);
```

---

### 5. Call Hierarchy Provider (Show Caller/Callee)

**File:** `src/providers/callHierarchyProvider.ts`

```typescript
import * as vscode from 'vscode';
import { parseMapkeys, buildCallGraph } from '../server/mapkeyStructure';

export class CreoCallHierarchyProvider implements vscode.CallHierarchyProvider {
  prepareCallHierarchy(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CallHierarchyItem[]> {
    const text = document.getText();
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) return null;
    
    const word = document.getText(wordRange);
    const mapkeys = parseMapkeys(text);
    const mapkey = mapkeys.find(mk => mk.name === word);
    if (!mapkey) return null;
    
    return [new vscode.CallHierarchyItem(
      vscode.SymbolKind.Function,
      mapkey.name,
      mapkey.description || '',
      document.uri,
      new vscode.Range(
        document.positionAt(mapkey.range.start),
        document.positionAt(mapkey.range.end)
      ),
      new vscode.Range(
        document.positionAt(mapkey.nameToken.start),
        document.positionAt(mapkey.nameToken.end)
      )
    )];
  }
  
  provideCallHierarchyOutgoingCalls(
    item: vscode.CallHierarchyItem,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CallHierarchyOutgoingCall[]> {
    const document = vscode.workspace.textDocuments.find(
      doc => doc.uri.toString() === item.uri.toString()
    );
    if (!document) return null;
    
    const text = document.getText();
    const callGraph = buildCallGraph(text);
    const calledMapkeys = callGraph[item.name] || [];
    const mapkeys = parseMapkeys(text);
    
    return calledMapkeys.map(calledName => {
      const callee = mapkeys.find(mk => mk.name === calledName);
      if (!callee) return null;
      
      const calleeItem = new vscode.CallHierarchyItem(
        vscode.SymbolKind.Function,
        callee.name,
        callee.description || '',
        document.uri,
        new vscode.Range(
          document.positionAt(callee.range.start),
          document.positionAt(callee.range.end)
        ),
        new vscode.Range(
          document.positionAt(callee.nameToken.start),
          document.positionAt(callee.nameToken.end)
        )
      );
      
      // Find the call location
      const callerText = text.substring(item.range.start.character, item.range.end.character);
      const callPos = callerText.indexOf(calledName);
      
      return new vscode.CallHierarchyOutgoingCall(
        calleeItem,
        [new vscode.Range(position, position)] // Simplified
      );
    }).filter(call => call !== null) as vscode.CallHierarchyOutgoingCall[];
  }
  
  provideCallHierarchyIncomingCalls(
    item: vscode.CallHierarchyItem,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CallHierarchyIncomingCall[]> {
    const document = vscode.workspace.textDocuments.find(
      doc => doc.uri.toString() === item.uri.toString()
    );
    if (!document) return null;
    
    const text = document.getText();
    const callGraph = buildCallGraph(text);
    const mapkeys = parseMapkeys(text);
    const incomingCalls: vscode.CallHierarchyIncomingCall[] = [];
    
    // Find all mapkeys that call this one
    for (const [callerName, callees] of Object.entries(callGraph)) {
      if (callees.includes(item.name)) {
        const caller = mapkeys.find(mk => mk.name === callerName);
        if (!caller) continue;
        
        const callerItem = new vscode.CallHierarchyItem(
          vscode.SymbolKind.Function,
          caller.name,
          caller.description || '',
          document.uri,
          new vscode.Range(
            document.positionAt(caller.range.start),
            document.positionAt(caller.range.end)
          ),
          new vscode.Range(
            document.positionAt(caller.nameToken.start),
            document.positionAt(caller.nameToken.end)
          )
        );
        
        incomingCalls.push(new vscode.CallHierarchyIncomingCall(
          callerItem,
          [new vscode.Range(position, position)] // Simplified
        ));
      }
    }
    
    return incomingCalls;
  }
}
```

**Register in extension.ts:**
```typescript
import { CreoCallHierarchyProvider } from './providers/callHierarchyProvider';

context.subscriptions.push(
  vscode.languages.registerCallHierarchyProvider(
    selector,
    new CreoCallHierarchyProvider()
  )
);
```

---

## Adding New Analysis Functions

### Template for Relationship Analysis

```typescript
// Add to mapkeyStructure.ts

/**
 * Find which mapkeys use a specific mapkey
 */
export function findMapkeyUsages(text: string, targetMapkey: string): MapkeyDefinition[] {
  const mapkeys = parseMapkeys(text);
  const usages: MapkeyDefinition[] = [];
  
  for (const mapkey of mapkeys) {
    if (mapkey.name === targetMapkey) continue; // Skip self
    
    const mapkeyText = text.substring(mapkey.range.start, mapkey.range.end);
    
    // Check if this mapkey contains the target
    if (mapkeyText.includes(targetMapkey)) {
      usages.push(mapkey);
    }
  }
  
  return usages;
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
  
  function findCycles(name: string, path: string[] = []): void {
    if (path.includes(name)) {
      // Found a cycle
      const cycleStart = path.indexOf(name);
      cycles.push([...path.slice(cycleStart), name]);
      return;
    }
    
    const callees = callGraph[name] || [];
    for (const callee of callees) {
      findCycles(callee, [...path, name]);
    }
  }
  
  for (const mapkeyName of Object.keys(callGraph)) {
    findCycles(mapkeyName);
  }
  
  return cycles;
}
```

---

## Enhanced Hover with Usage Info

**Update hoverProvider.ts:**

```typescript
import { parseMapkeys, getMapkeyAtPosition, findMapkeyUsages } from '../server/mapkeyStructure';

// In provideHover():
if (token.type.startsWith('mapkey.')) {
  const mapkey = getMapkeyAtPosition(text, offset);
  if (mapkey) {
    md.appendMarkdown(`## Mapkey: \`${mapkey.name}\`\n\n`);
    
    if (mapkey.description) {
      md.appendMarkdown(`**Description:** ${mapkey.description}\n\n`);
    }
    
    if (mapkey.label) {
      md.appendMarkdown(`**Label:** ${mapkey.label}\n\n`);
    }
    
    // NEW: Show usage count
    const usages = findMapkeyUsages(text, mapkey.name);
    md.appendMarkdown(`**Used by:** ${usages.length} mapkey(s)\n\n`);
    
    if (usages.length > 0) {
      md.appendMarkdown(`*Used in:* ${usages.map(mk => mk.name).join(', ')}\n\n`);
    }
    
    md.appendMarkdown(`---\n\n`);
  }
}
```

---

## TL;DR Cheat Sheet

| Feature | File to Create | Use Existing? |
|---------|----------------|---------------|
| Code Folding | `foldingProvider.ts` | ✅ Use `getMapkeyFoldingRanges()` |
| Diagnostics | `diagnosticsProvider.ts` | ✅ Use `parseMapkeys()` |
| Go to Definition | `definitionProvider.ts` | ✅ Use `parseMapkeys()` |
| Find References | `referenceProvider.ts` | ✅ Use `parseMapkeys()` |
| Call Hierarchy | `callHierarchyProvider.ts` | ✅ Use `buildCallGraph()` |
| New Relationships | Add function to `mapkeyStructure.ts` | 🔧 New analysis function |
| Hover Info | Update `hoverProvider.ts` | ✅ Use existing + new functions |

**Golden Rule:** Use existing `parseMapkeys()` and `buildCallGraph()` for most features. Only add new functions for NEW types of analysis!