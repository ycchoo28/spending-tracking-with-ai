#!/bin/bash

# Receipt Tracker Agent - E2E Test Runner
# This script runs the end-to-end test suite

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Receipt Tracker Agent - E2E Test Runner              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create a .env file with required configuration"
    echo "See .env.example for reference"
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
npx tsc --noEmit

# Run the E2E tests
echo ""
echo "🧪 Running E2E tests..."
echo ""

npx ts-node test-e2e.ts

echo ""
echo "✅ E2E test suite completed"
