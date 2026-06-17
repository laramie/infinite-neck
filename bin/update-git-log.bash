#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bin/update-git-log.bash --since YYYY-MM-DD

Print changelog-ready commit lines for commits on this branch since the given date.
EOF
}

SINCE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --since)
      SINCE="${2-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$SINCE" ]]; then
  echo "Missing required --since YYYY-MM-DD argument" >&2
  usage >&2
  exit 1
fi

git log --since="$SINCE" --no-merges --pretty=format:"- %h **%ad** %s" --date=short
