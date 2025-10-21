#!/bin/bash

# Set variables
OUTPUT_FILE="extension-structure.env"
ROOT_DIR="$HOME/vscodeCreo/vscodecreo"
SKIP_DIRS=(".vscode" "node_modules" "out") # Directories to skip
INCLUDE_EXTENSIONS=("ts" "js" "json")      # File extensions to include

# Function to check if a directory should be skipped
should_skip_dir() {
  local dir="$1"
  for skip in "${SKIP_DIRS[@]}"; do
    if [[ "$dir" == *"$skip"* ]]; then
      return 0 # Skip
    fi
  done
  return 1 # Do not skip
}

# Function to get file extension
get_extension() {
  local filename="$1"
  echo "${filename##*.}"
}

# Function to print file contents with dividers
print_file() {
  local file="$1"
  echo "====================" >>"$OUTPUT_FILE"
  echo "$file" >>"$OUTPUT_FILE"
  echo "====================" >>"$OUTPUT_FILE"
  echo "" >>"$OUTPUT_FILE"
  cat "$file" >>"$OUTPUT_FILE"
  echo -e "\n" >>"$OUTPUT_FILE"
}

# Function to traverse directories recursively
traverse_dir() {
  local dir="$1"

  for file in "$dir"/*; do
    [ -e "$file" ] || continue

    if [ -d "$file" ]; then
      if should_skip_dir "$file"; then
        continue
      fi
      traverse_dir "$file"
    else
      local ext
      ext=$(get_extension "$file")
      for allowed in "${INCLUDE_EXTENSIONS[@]}"; do
        if [[ "$ext" == "$allowed" ]]; then
          print_file "$file"
        fi
      done
    fi
  done
}

# Clear output file
>"$OUTPUT_FILE"

# Print date/time at the top
echo "Script run on: $(date)" >>"$OUTPUT_FILE"
echo "" >>"$OUTPUT_FILE"

# Start traversing
traverse_dir "$ROOT_DIR"

echo "Directory contents written to $OUTPUT_FILE"
