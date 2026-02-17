


// build pieces
const CONT = '^\\s*mapkey\\(continued\\)';         // start-of-line continuation marker (string)
const BACKSLASH_EOL = '\\\\\\r?\\n';               // literal backslash then newline

// compose
const BACKSLASH_EOL_CONT = BACKSLASH_EOL + CONT;   // '\\\\\r?\n^\\s*mapkey\\(continued\\)'

// compile into RegExp with 'ym' flags to use sticky matching and multiline '^'
new RegExp(BACKSLASH_EOL_CONT, 'ym');

Place such an item early in TOKEN_SPECS if you want the tokenizer to emit a special T_BACKSLASH_EOL_CONT token. But prefer leaving the specific recognition to the parser — tokenizer should only identify backslash+EOL and the continuation marker on the next line if absolutely required.
