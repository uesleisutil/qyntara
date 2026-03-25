#!/bin/bash
# Setup script for DL environment

set -e

echo "Setting up DL environment for model optimization..."

# Check if virtual environment exists
if [ ! -d "../.venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv ../.venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source ../.venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "Installing DL dependencies..."
pip install -r requirements.txt

echo "✓ DL environment setup complete!"
echo ""
echo "To activate the environment, run:"
echo "  source .venv/bin/activate"
