#!/usr/bin/env bash
# diagnose_vscode.sh - Debug VS Code extension installation

echo "=========================================="
echo "VS Code Extension Diagnostics"
echo "=========================================="
echo ""

# Detect VS Code variant
if [ -d "$HOME/.config/Code - OSS" ]; then
    VSCODE_DIR="$HOME/.config/Code - OSS"
    VSCODE_CMD="code-oss"
    echo "Detected: VS Code OSS"
elif [ -d "$HOME/.config/Code" ]; then
    VSCODE_DIR="$HOME/.config/Code"
    VSCODE_CMD="code"
    echo "Detected: VS Code (official)"
else
    echo "ERROR: No VS Code installation found"
    exit 1
fi

echo "Config directory: $VSCODE_DIR"
echo ""

# Check extension directory
EXT_DIR="$VSCODE_DIR/extensions/creo-lsp-local"

echo "1. Extension Directory Check"
echo "========================================"
if [ -L "$EXT_DIR" ]; then
    echo "✓ Symlink exists: $EXT_DIR"
    TARGET=$(readlink -f "$EXT_DIR")
    echo "  → Points to: $TARGET"
    
    if [ -d "$TARGET" ]; then
        echo "  ✓ Target directory exists"
    else
        echo "  ✗ ERROR: Target directory does not exist!"
        exit 1
    fi
else
    echo "✗ ERROR: Extension directory not found or not a symlink"
    exit 1
fi
echo ""

# Check required files
echo "2. Required Files Check"
echo "========================================"
REQUIRED_FILES=(
    "package.json"
    "extension.js"
    "language-configuration.json"
    "syntaxes/pro.tmLanguage.json"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$EXT_DIR/$file" ]; then
        echo "✓ $file"
    else
        echo "✗ MISSING: $file"
    fi
done
echo ""

# Check server files
echo "3. Server Files Check"
echo "========================================"
SERVER_DIR="$TARGET/../server"
if [ -d "$SERVER_DIR" ]; then
    echo "✓ Server directory exists: $SERVER_DIR"
    if [ -f "$SERVER_DIR/server.js" ]; then
        echo "  ✓ server.js found"
    else
        echo "  ✗ server.js NOT FOUND"
    fi
else
    echo "✗ Server directory NOT FOUND: $SERVER_DIR"
fi
echo ""

# Check parser files
echo "4. Parser Files Check"
echo "========================================"
PARSER_DIR="$TARGET/../src/shared"
if [ -d "$PARSER_DIR" ]; then
    echo "✓ Parser directory exists: $PARSER_DIR"
    for file in ast.js parser.js tokenizer.js; do
        if [ -f "$PARSER_DIR/$file" ]; then
            echo "  ✓ $file"
        else
            echo "  ✗ MISSING: $file"
        fi
    done
else
    echo "✗ Parser directory NOT FOUND: $PARSER_DIR"
fi
echo ""

# Validate package.json
echo "5. package.json Validation"
echo "========================================"
if [ -f "$EXT_DIR/package.json" ]; then
    # Check for required fields
    NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$EXT_DIR/package.json" | cut -d'"' -f4)
    MAIN=$(grep -o '"main"[[:space:]]*:[[:space:]]*"[^"]*"' "$EXT_DIR/package.json" | cut -d'"' -f4)
    
    echo "Extension name: $NAME"
    echo "Main entry: $MAIN"
    
    # Check if main file exists
    if [ -n "$MAIN" ]; then
        MAIN_PATH="$EXT_DIR/$MAIN"
        if [ -f "$MAIN_PATH" ]; then
            echo "✓ Main file exists: $MAIN_PATH"
        else
            echo "✗ Main file NOT FOUND: $MAIN_PATH"
        fi
    fi
    
    # Check language ID
    LANG_ID=$(grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' "$EXT_DIR/package.json" | head -1 | cut -d'"' -f4)
    echo "Language ID: $LANG_ID"
    
    if [ "$LANG_ID" != "pro" ]; then
        echo "⚠ WARNING: Language ID should be 'pro'"
    fi
fi
echo ""

# Test Node.js and server
echo "6. Node.js & Server Test"
echo "========================================"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✓ Node.js installed: $NODE_VERSION"
    
    if [ -f "$SERVER_DIR/server.js" ]; then
        echo ""
        echo "Testing server.js syntax..."
        if node --check "$SERVER_DIR/server.js" 2>&1; then
            echo "✓ server.js syntax valid"
        else
            echo "✗ server.js has syntax errors"
        fi
    fi
else
    echo "✗ Node.js NOT FOUND"
fi
echo ""

# Check permissions
echo "7. Permissions Check"
echo "========================================"
ls -la "$EXT_DIR" | head -5
echo ""

# VS Code extensions list
echo "8. VS Code Extensions List"
echo "========================================"
if command -v $VSCODE_CMD &> /dev/null; then
    echo "Installed extensions:"
    $VSCODE_CMD --list-extensions 2>/dev/null | head -10
else
    echo "⚠ Cannot run $VSCODE_CMD command"
fi
echo ""

echo "=========================================="
echo "Diagnosis Complete"
echo "=========================================="
echo ""
echo "If extension not loading, try:"
echo "1. Restart VS Code completely"
echo "2. Run: $VSCODE_CMD --disable-extensions"
echo "3. Check VS Code logs: Help → Toggle Developer Tools → Console"
echo "4. Check extension host log: ~/.config/$VSCODE_CMD/logs/*/exthost*/exthost.log"
