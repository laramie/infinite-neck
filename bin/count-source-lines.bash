find . -type f -name "*.js" \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/_tests/*" \
  -print0 | xargs -0 wc -l | sort -n
