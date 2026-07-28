#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="dist"
OUT_FILE="$OUT_DIR/infinite-neck-$STAMP.tar.gz"

if [[ "${1-}" == "--output" ]]; then
  if [[ -z "${2-}" ]]; then
    echo "Usage: $0 [--output path/to/archive.tar.gz]"
    exit 1
  fi
  OUT_FILE="$2"
  OUT_DIR="$(dirname "$OUT_FILE")"
fi

mkdir -p "$OUT_DIR"

INCLUDE_DIRS=(
  "img"
  "fill"
  "songs"
  "plugins"
  "templates"
  "bin"
  "jsonTree80kg"
)

EXCLUDES=(
  ".DS_Store"
  "*/.DS_Store"
  "._*"
  "*/._*"
  "Thumbs.db"
  "*/Thumbs.db"
)

ROOT_FILES=()
while IFS= read -r -d '' file; do
  ROOT_FILES+=("${file#./}")
done < <(find . -maxdepth 1 -type f -print0)

TAR_EXCLUDES=()
for pattern in "${EXCLUDES[@]}"; do
  TAR_EXCLUDES+=("--exclude=$pattern")
done

tar -czf "$OUT_FILE" "${TAR_EXCLUDES[@]}" "${INCLUDE_DIRS[@]}" "${ROOT_FILES[@]}"

echo "Created $OUT_FILE"