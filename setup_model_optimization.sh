#!/bin/bash
# Master setup script for model optimization system

set -e

echo "=========================================="
echo "Model Optimization System Setup"
echo "=========================================="
echo ""

# Setup ML environment
echo "1. Setting up ML environment..."
cd ml
./setup_env.sh
cd ..
echo ""

# Setup dashboard
echo "2. Setting up dashboard..."
cd dashboard
./setup_dashboard.sh
cd ..
echo ""

# Setup infrastructure (optional)
echo "3. Infrastructure setup (optional)..."
read -p "Do you want to install infrastructure dependencies? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd infra
    echo "Installing CDK dependencies..."
    npm install
    cd ..
    echo "✓ Infrastructure dependencies installed"
else
    echo "Skipping infrastructure setup"
fi
echo ""

echo "=========================================="
echo "✓ Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Activate Python environment: source .venv/bin/activate"
echo "2. Start dashboard dev server: cd dashboard && npm start"
echo "3. Deploy infrastructure: cd infra && cdk deploy"
echo ""
echo "See MODEL_OPTIMIZATION_README.md for detailed documentation"
