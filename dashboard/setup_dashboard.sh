#!/bin/bash
# Setup script for dashboard

set -e

echo "Setting up dashboard for model optimization..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
else
    echo "Updating npm dependencies..."
    npm update
fi

echo "✓ Dashboard setup complete!"
echo ""
echo "To start the development server, run:"
echo "  npm start"
echo ""
echo "To build for production, run:"
echo "  npm run build"
