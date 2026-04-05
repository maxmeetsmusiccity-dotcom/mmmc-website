#!/bin/bash
set -e
echo "=== TypeScript check ==="
npx tsc --noEmit
echo "=== Unit tests ==="
npx vitest run
echo "=== Build ==="
npm run build
echo "=== All checks passed ==="
