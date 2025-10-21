# Tokenizer Rules of Thumb

## Quick Decision Tree

```
Adding a new token type?
│
├─ Is it a simple pattern match? (e.g., keywords, symbols, comments)
│  └─ ✅ JUST ADD TO STEP 1 - Done!
│
├─ Does it need capture groups? (e.g., extracting parts of a match)
│  └─ ✅ JUST ADD TO STEP 1 with groups array - Done!
│
├─ Does it span multiple lines?
│  └─ 🔧 ADD TO STEP 1, then UPDATE STEP 2
│
├─ Is it derived from other tokens? (e.g., content after a tag)
│  └─ 🔧 ADD TO STEP 1 (optional), then UPDATE STEP 2
│
└─ Does it need context from surrounding tokens?
   └─ 🔧 UPDATE STEP 2 with custom logic
```

---

## STEP 1: Simple Token Definitions

**When to use:** 90% of tokens - anything you can match with a regex

### Template 1: Simple Pattern Match
```typescript
{
  type: "your.token.name",
  regex: /your-pattern/flags
}
```

**Examples:**
```typescript
// Keywords
{ type: "keyword.if", regex: /\bif\b/g }

// Symbols
{ type: "semicolon", regex: /;/g }

// Line patterns
{ type: "comment.line", regex: /!.*$/gm }

// Word boundaries
{ type: "function.name", regex: /\bfunction\b/g }
```

### Template 2: Capture Groups
```typescript
{
  type: "parent.token.name",  // This type is rarely used
  regex: /^(pattern1)(pattern2)/gm,
  groups: [
    { type: "child.token.1", index: 1 },
    { type: "child.token.2", index: 2 },
  ]
}
```

**Examples:**
```typescript
// Extract multiple parts
{
  type: "mapkey.declaration",
  regex: /^(mapkey\s+)([^\s;]+)/gm,
  groups: [
    { type: "mapkey.keyword", index: 1 },  // "mapkey "
    { type: "mapkey.name", index: 2 },     // "MY_MAPKEY"
  ]
}

// Extract from inside pattern
{
  type: "variable.declaration",
  regex: /\$(\w+)\s*=\s*(.+)$/gm,
  groups: [
    { type: "variable.name", index: 1 },   // "varname"
    { type: "variable.value", index: 2 },  // "value"
  ]
}
```

---

## STEP 2: Complex Token Processing

**When to use:** Tokens that need post-processing, merging, or derivation

### Scenario A: Multiline Token Merging

**When:** Your token spans multiple lines with continuation characters

**Boilerplate:**
```typescript
export function processTokens(text: string, tokens: Token[]): Token[] {
  const processed: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // Check if this is the token type you want to merge
    if (token.type === "your.multiline.token") {
      const merged = mergeMultilineToken(text, token);
      processed.push(merged);
      
      // Skip past any tokens that were part of this merged token
      while (i < tokens.length && tokens[i].start < merged.end) {
        i++;
      }
    } else {
      processed.push(token);
      i++;
    }
  }

  return processed;
}

function mergeMultilineToken(text: string, token: Token): Token {
  let start = token.start;
  let end = token.end;
  let value = token.value;
  
  // Your merging logic here
  // Example: continue if line ends with backslash
  while (text[end - 1] === '\\') {
    // Find next line
    let nextLineEnd = text.indexOf('\n', end);
    if (nextLineEnd === -1) break;
    
    // Add content
    value += text.substring(end, nextLineEnd);
    end = nextLineEnd;
  }
  
  return { type: token.type, value, start, end };
}
```

### Scenario B: Derived Tokens

**When:** You need to create new tokens based on existing ones

**Boilerplate:**
```typescript
export function addDerivedTokens(text: string, tokens: Token[]): Token[] {
  const derived: Token[] = [...tokens];
  
  // Find tokens you want to derive from
  for (const token of tokens) {
    if (token.type === "source.token") {
      const newToken = deriveToken(text, token);
      if (newToken) derived.push(newToken);
    }
  }
  
  return derived.sort((a, b) => a.start - b.start);
}

function deriveToken(text: string, sourceToken: Token): Token | null {
  // Extract content after the source token
  const start = sourceToken.end;
  
  // Find where it ends (e.g., semicolon, newline, etc.)
  let end = text.indexOf(';', start);
  if (end === -1) end = text.indexOf('\n', start);
  if (end === -1) return null;
  
  const value = text.substring(start, end).trim();
  
  return {
    type: "derived.token",
    value,
    start,
    end
  };
}
```

### Scenario C: Context-Aware Tokens

**When:** Token behavior depends on surrounding tokens

**Boilerplate:**
```typescript
export function addContextualTokens(text: string, tokens: Token[]): Token[] {
  const result: Token[] = [...tokens];
  
  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    const prev = i > 0 ? tokens[i - 1] : null;
    const next = i < tokens.length - 1 ? tokens[i + 1] : null;
    
    // Check context
    if (current.type === "some.token" && 
        next?.type === "expected.next") {
      
      // Add contextual token
      result.push({
        type: "contextual.token",
        value: "context-based-value",
        start: current.start,
        end: next.end
      });
    }
  }
  
  return result.sort((a, b) => a.start - b.start);
}
```

---

## STEP 3: Helper Functions

**When to use:** Never required, but useful for convenience

### Standard Helper (Already Provided)
```typescript
export function getTokenAtPosition(text: string, position: number): Token | null {
  const tokens = tokenize(text);
  return tokens.find(t => position >= t.start && position < t.end) || null;
}
```

### Additional Helpers You Might Add
```typescript
// Get all tokens of a specific type
export function getTokensByType(text: string, type: string): Token[] {
  return tokenize(text).filter(t => t.type === type);
}

// Get tokens in a range
export function getTokensInRange(text: string, start: number, end: number): Token[] {
  return tokenize(text).filter(t => 
    t.start >= start && t.end <= end
  );
}

// Get the next token of a specific type
export function getNextToken(text: string, fromPosition: number, type: string): Token | null {
  const tokens = tokenize(text);
  return tokens.find(t => t.start >= fromPosition && t.type === type) || null;
}
```

---

## Common Patterns Reference

### Pattern 1: Tag + Content
```typescript
// STEP 1: Define the tag
{ type: "tag.marker", regex: /@TAG_NAME/g }

// STEP 2: Extract content after tag
function extractContentAfterTag(text: string, tagToken: Token): Token {
  const start = tagToken.end;
  const semicolonPos = text.indexOf(';', start);
  const end = semicolonPos !== -1 ? semicolonPos : text.indexOf('\n', start);
  
  return {
    type: "tag.content",
    value: text.substring(start, end).trim(),
    start,
    end
  };
}
```

### Pattern 2: Scope Markers (Begin/End)
```typescript
// STEP 1: Define markers
{ type: "block.begin", regex: /BEGIN/g }
{ type: "block.end", regex: /END/g }

// STEP 2: Create scope tokens
function addScopeTokens(text: string, tokens: Token[]): Token[] {
  const result = [...tokens];
  const beginTokens = tokens.filter(t => t.type === "block.begin");
  const endTokens = tokens.filter(t => t.type === "block.end");
  
  for (let i = 0; i < beginTokens.length; i++) {
    const begin = beginTokens[i];
    const end = endTokens[i]; // Match pairs
    
    if (end) {
      result.push({
        type: "block.scope",
        value: text.substring(begin.start, end.end),
        start: begin.start,
        end: end.end
      });
    }
  }
  
  return result;
}
```

### Pattern 3: Line Continuations
```typescript
// STEP 1: Define continuation marker
{ type: "line.continuation", regex: /\\$/gm }

// STEP 2: Merge continued lines
function mergeContinuedLines(text: string, tokens: Token[]): Token[] {
  // Implementation similar to mergeMultilineToken above
}
```

---

## Real-World Example Walkthrough

### Adding a new token: `config.option`

**Requirement:** Match patterns like `option_name YES` or `option_name NO`

#### Step 1: Simple match
```typescript
{
  type: "config.option",
  regex: /^(\w+)\s+(YES|NO)$/gm,
  groups: [
    { type: "option.name", index: 1 },
    { type: "option.value", index: 2 }
  ]
}
```
✅ **Done! No Step 2 needed.**

---

### Adding: `config.option` with multiline values

**Requirement:** Values can span multiple lines with `\`

#### Step 1: Define base tokens
```typescript
{ type: "option.name", regex: /^(\w+)\s+/gm }
{ type: "line.break", regex: /\\$/gm }
```

#### Step 2: Merge multiline values
```typescript
// In processTokens() or addDerivedTokens()
if (token.type === "option.name") {
  const value = extractMultilineValue(text, token);
  derived.push(value);
}
```
✅ **Done! Added processing logic.**

---

## TL;DR Cheat Sheet

| Token Type | Step 1 | Step 2 | Step 3 |
|------------|--------|--------|--------|
| Simple keyword | ✅ Add regex | ❌ | ❌ |
| Symbol/operator | ✅ Add regex | ❌ | ❌ |
| With capture groups | ✅ Add groups | ❌ | ❌ |
| Multiline | ✅ Add regex | ✅ Merge logic | ❌ |
| Derived content | ✅ (optional) | ✅ Derive logic | ❌ |
| Scope/pairing | ✅ Add begin/end | ✅ Pair logic | ❌ |
| Helper needed | ❌ | ❌ | ✅ Add function |

**Golden Rule:** If you can match it with regex alone → Step 1 only. If you need to process/combine/derive → Step 2.