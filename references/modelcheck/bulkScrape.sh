#!/bin/bash

HTML_FILE="page.html"
TEXT_FILE="extracted.txt"
FORMAT_FILE="formatted.txt"
MISSING_FILE="missing_heading.txt"
URL_LIST="urls.txt"

# Classes to extract
CLASSES=("Heading_2" "Body" "List_1" "Preformatted" "Table_Cell")

# Strings to ignore/replace with ""
IGNORE_STRINGS=("Suggested Settings:")

>"$TEXT_FILE"
>"$FORMAT_FILE"
>"$MISSING_FILE"

while read -r URL; do
  [[ -z "$URL" ]] && continue # skip blank lines
  echo "Downloading $URL..."
  curl -s "$URL" -o "$HTML_FILE"

  echo "Processing $URL..." >>"$TEXT_FILE"
  echo "----------------------------------------" >>"$TEXT_FILE"

  # Variables for formatted output
  heading=""
  preformatted=""
  body_texts=()
  list_texts=()
  table_cells=()

  for CLASS in "${CLASSES[@]}"; do
    echo "==== $CLASS ====" >>"$TEXT_FILE"

    # Extract class content
    matches=$(grep -oP "<[^>]*class=\"${CLASS}\"[^>]*>.*?</div>" "$HTML_FILE" |
      sed 's/<[^>]*>//g' |
      sed 's/^[ \t]*//;s/[ \t]*$//' |
      awk 'NF')

    # Remove ignored strings
    for IGNORE in "${IGNORE_STRINGS[@]}"; do
      matches=$(echo "$matches" | sed "s/${IGNORE}//g")
    done

    if [[ -n "$matches" ]]; then
      echo "$matches" >>"$TEXT_FILE"
    fi

    # Process for formatted file
    case $CLASS in
    "Heading_2")
      heading=$(echo "$matches" | head -n 1 | awk '{print $1}' | sed 's/(.*//')
      ;;
    "Preformatted")
      preformatted="$matches"
      ;;
    "Body")
      while IFS= read -r line; do
        [[ -n "$line" ]] && body_texts+=("$line")
      done <<<"$matches"
      ;;
    "List_1")
      while IFS= read -r line; do
        [[ -n "$line" ]] && list_texts+=("$line")
      done <<<"$matches"
      ;;
    "Table_Cell")
      while IFS= read -r line; do
        [[ -n "$line" ]] && table_cells+=("$line")
      done <<<"$matches"
      ;;
    esac

    echo >>"$TEXT_FILE"
  done

  echo >>"$TEXT_FILE"

  # Log URL if missing heading
  if [[ -z "$heading" ]]; then
    echo "$URL" >>"$MISSING_FILE"
  fi

  # Combine Body + List_1
  combined_body=""
  if ((${#body_texts[@]} > 0)); then
    combined_body=$(printf "%s\n\n" "${body_texts[@]}")
  fi
  if ((${#list_texts[@]} > 0)); then
    combined_body+=$(printf "%s\n\n" "${list_texts[@]}")
  fi
  combined_body=$(echo -e "$combined_body" | sed ':a;N;$!ba;s/\n*$//')

  # Combine Table_Cell with |
  combined_table=""
  if ((${#table_cells[@]} > 0)); then
    combined_table=$(
      IFS='|'
      echo "${table_cells[*]}"
    )
  fi

  # Output formatted line
  echo "[\"$heading\", \"**$preformatted** \\n\\n $combined_body\", \"$combined_table\", \"\"]" >>"$FORMAT_FILE"

done <"$URL_LIST"

echo "Done. Outputs:"
echo " - $TEXT_FILE (raw text)"
echo " - $FORMAT_FILE (formatted list)"
echo " - $MISSING_FILE (URLs missing Heading_2)"
