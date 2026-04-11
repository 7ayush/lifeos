#!/bin/bash
# Skip build if no frontend files changed since last deployment

# Check if this is the first build (no previous commit to compare)
if [ -z "$CF_PAGES_COMMIT_SHA" ]; then
  echo "First build — running full build"
  npm run build
  exit 0
fi

# Check if any frontend files changed
CHANGED=$(git diff --name-only HEAD~1 HEAD -- . 2>/dev/null)

if [ -z "$CHANGED" ]; then
  echo "No frontend changes detected — skipping build"
  mkdir -p dist
  echo "<html><body>No changes</body></html>" > dist/index.html
  exit 0
fi

echo "Frontend changes detected:"
echo "$CHANGED"
npm run build
