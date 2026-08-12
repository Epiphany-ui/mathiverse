#!/usr/bin/env bash
set -e

# cd to script directory so relative paths resolve correctly
cd "$(dirname "$0")"

echo ""
echo "============================================"
echo "  Mathiverse Local Renderer"
echo "============================================"
echo ""

# Check uv
if ! command -v uv &> /dev/null; then
    echo "[ERROR] uv not found. Install: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# uv auto-creates venv and installs deps, then runs server
echo "[INFO] Starting renderer on http://localhost:9876"
echo ""
exec uv run --with-requirements requirements.txt python server.py
