#!/bin/bash
MEMORY_DIR=".agents/memory"

if [ -f "$MEMORY_DIR/context.md" ]; then
  echo "=== PROJECT MEMORY: context.md ==="
  cat "$MEMORY_DIR/context.md"
  echo ""
fi

if [ -f "$MEMORY_DIR/progress.md" ]; then
  echo "=== PROJECT MEMORY: progress.md (most recent entries) ==="
  head -n 30 "$MEMORY_DIR/progress.md"
fi
