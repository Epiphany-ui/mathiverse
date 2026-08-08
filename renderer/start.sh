#!/usr/bin/env bash
set -e

echo ""
echo "============================================"
echo "  Mathiverse Local Renderer"
echo "============================================"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 not found. Please install Python 3.10+."
    exit 1
fi

# Create venv if not exist
if [ ! -d "venv" ]; then
    echo "[INFO] Creating virtual environment..."
    python3 -m venv venv
fi

# Activate and install
source venv/bin/activate
echo "[INFO] Installing dependencies..."
pip install -r requirements.txt -q

echo "[INFO] Starting renderer on http://localhost:9876"
echo ""
python3 server.py
