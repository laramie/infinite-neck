#!/bin/bash

# Define the directory path (use '.' for the current directory)
DIRECTORY="./songs"

# Check if the directory exists
if [ -d "$DIRECTORY" ]; then
    # Loop through each item in the directory
    for file in "$DIRECTORY"/*; do
        # Check if the item is a regular file (not a directory)
        if [ -f "$file" ]; then
            echo "Processing file: $file"
            # Replace 'your_command' with the actual command you want to run
            # The "$file" variable passes the full file path as an argument
            ##node bin/dump-songfile-properties.js "$file" "$.visibleNoteTables" 
            node bin/dump-songfile-properties.js "$file" "$..namedNotes" 
        fi
    done
else
    echo "Directory not found: $DIRECTORY"
    exit 1
fi
