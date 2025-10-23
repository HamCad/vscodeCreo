# Quick Reference: Adding Tokens to Hover Provider

## Decision Flow Chart

```
Do I need this token in hover?
│
├─ YES → Do other features need it too? (diagnostics, references, etc.)
│        │
│        ├─ YES → STORE in MapkeyDefinition
│        │        Follow: Path A (below)
│        │
│        └─ NO → DON'T STORE, use token.value directly
│                 Follow: Path B (below)
│
└─ NO → Don't add anything
```

---

## Path A: Store Token in MapkeyDefinition

**When to use:** Multiple features need this token (hover + diagnostics + references)

### Step 1: Add to Interface
```typescript
// File: mapkeyStructure.ts

export interface MapkeyDefinition {
  // ... existing properties ...
  myNewTokens: Token[];  // or Token if single
}
```

### Step 2: Extract in buildMapkeyDefinition()
```typescript
// File: mapkeyStructure.ts

function buildMapkeyDefinition(block: MapkeyBlock): MapkeyDefinition {
  const tokens = block.tokens;
  
  // Extract your tokens
  const myNewTokens = tokens.filter(t => t.type === 'your.token.type');
  
  return {
    // ... existing properties ...
    myNewTokens,  // Add here
  };
}
```

### Step 3: Use in Hover Provider
```typescript
// File: hoverProvider.ts

if (token.type === 'your.token.type') {
  const mapkey = getMapkeyAtPosition(text, offset);
  if (mapkey && mapkey.myNewTokens) {
    mapkey.myNewTokens.forEach(t => {
      md.appendMarkdown(`- ${t.value}\n`);
    });
  }
}
```

---

## Path B: Use Token Directly (No Storage)

**When to use:** Only hover needs this token

### Step 1: Add Hover Condition
```typescript
// File: hoverProvider.ts

if (token.type === 'your.token.type') {
  // Use token.value directly!
  md.appendMarkdown(`## Token: \`${token.value}\`\n\n`);
}
```

### Step 2: Get Related Data (if needed)
```typescript
if (token.type === 'your.token.type') {
  // Option A: Get the current mapkey
  const mapkey = getMapkeyAtPosition(text, offset);
  
  // Option B: Get all mapkeys
  const allMapkeys = parseMapkeys(text);
  
  // Option C: Find specific tokens in current mapkey
  const relatedTokens = mapkey?.allTokens.filter(t => t.type === 'related.type');
}
```

---

## Common Patterns

### Pattern 1: Show Token + Definition Location
```typescript
if (token.type === 'mapkey.nested.name') {
  const nestedName = token.value;
  md.appendMarkdown(`## Nested: \`${nestedName}\`\n\n`);
  
  // Find definition
  const allMapkeys = parseMapkeys(text);
  const definition = allMapkeys.find(mk => mk.name === nestedName);
  
  if (definition) {
    const line = document.positionAt(definition.range.start).line + 1;
    md.appendMarkdown(`**Defined at:** Line ${line}\n\n`);
  }
}
```

### Pattern 2: Show Token + Usage Count
```typescript
if (token.type === 'mapkey.name') {
  const mapkeyName = token.value;
  
  // Find usages
  const usages = findMapkeyUsages(text, mapkeyName);
  md.appendMarkdown(`**Used by:** ${usages.length} mapkey(s)\n\n`);
}
```

### Pattern 3: Show All Tokens of Type in Current Mapkey
```typescript
if (token.type === 'mapkey.action.verb') {
  const mapkey = getMapkeyAtPosition(text, offset);
  
  // Get all action verbs in this mapkey
  const allVerbs = mapkey?.allTokens.filter(t => t.type === 'mapkey.action.verb');
  
  md.appendMarkdown(`**All actions in this mapkey:**\n`);
  allVerbs?.forEach(t => md.appendMarkdown(`- ${t.value}\n`));
}
```

### Pattern 4: Context-Aware Hover Based on Parent Token
```typescript
if (token.type === 'mapkey.action.arg.string') {
  const mapkey = getMapkeyAtPosition(text, offset);
  
  // Find the action verb this argument belongs to
  const allTokens = mapkey?.allTokens || [];
  const tokenIndex = allTokens.findIndex(t => t === token);
  
  // Look backwards for the verb
  for (let i = tokenIndex - 1; i >= 0; i--) {
    if (allTokens[i].type === 'mapkey.action.verb') {
      const verb = allTokens[i].value;
      md.appendMarkdown(`**Argument for:** ${verb}\n\n`);
      break;
    }
  }
}
```

---

## Checklist

Before adding a token to hover:

- [ ] Does the token type exist in tokenizer.ts?
- [ ] Do I need to store it? → Update MapkeyDefinition interface
- [ ] Do I need to store it? → Update buildMapkeyDefinition()
- [ ] Add hover condition with exact token type: `if (token.type === '...')`
- [ ] Import any helper functions needed (parseMapkeys, findMapkeyUsages, etc.)
- [ ] Test hover on that specific token type

---

## Common Mistakes to Avoid

❌ **Wrong:** Using `.startsWith()` when you want exact match
```typescript
if (token.type.startsWith('mapkey.'))  // Too broad!
```

✅ **Right:** Use exact match
```typescript
if (token.type === 'mapkey.nested.name')  // Specific!
```

---

❌ **Wrong:** Accessing nested properties that don't exist
```typescript
mapkey.nested.name  // ❌ 'nested' doesn't exist on MapkeyDefinition
```

✅ **Right:** Use token.value or stored property
```typescript
token.value  // ✅ Direct access
mapkey.nestedTokens  // ✅ Stored array
```

---

❌ **Wrong:** Forgetting to check if property exists
```typescript
mapkey.nestedTokens.forEach(...)  // ❌ Crashes if undefined
```

✅ **Right:** Always check first
```typescript
if (mapkey.nestedTokens && mapkey.nestedTokens.length > 0) {
  mapkey.nestedTokens.forEach(...)
}
```

---

## Testing Your Changes

1. **Compile TypeScript**
   ```bash
   npm run compile
   ```

2. **Reload VS Code Extension**
   - Press F5 in VS Code (or Run → Start Debugging)
   - In the Extension Development Host, open a .pro file

3. **Test Hover**
   - Hover over the specific token type you added
   - Check console for errors: View → Output → Select "Log (Extension Host)"

4. **Verify**
   - Does it show the right information?
   - Does it handle missing data gracefully?
   - Does it work for multiple instances?

---

## Quick Template

Copy this template when adding new hover logic:

```typescript
// In hoverProvider.ts, inside provideHover()

if (token.type === 'YOUR.TOKEN.TYPE') {
  // Get context if needed
  const mapkey = getMapkeyAtPosition(text, offset);
  
  // Build markdown
  md.appendMarkdown(`## Your Token: \`${token.value}\`\n\n`);
  
  // Add relevant info
  if (mapkey) {
    // Use mapkey data...
  }
  
  md.appendMarkdown(`\n---\n\n`);
}
```
