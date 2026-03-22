#!/bin/bash

# 🚀 Quick Start Script for Improved Pre-Sales AI Agent
# This script sets up and runs the application

echo "=========================================="
echo "  Pre-Sales AI Agent - Quick Start"
echo "  Version 2.0.0 (Improved)"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js found: $(node --version)"
echo ""

# Check for .env file
if [ ! -f "backend/.env" ]; then
    echo "⚠️  No .env file found in backend/"
    echo ""
    echo "Creating template .env file..."
    cat > backend/.env << EOF
# Gemini AI API Key (Get from: https://ai.google.dev/)
GEMINI_API_KEY=your_gemini_api_key_here

# Server Port
PORT=3000

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
EOF
    echo "✓ Template .env created at backend/.env"
    echo ""
    echo "⚠️  IMPORTANT: Edit backend/.env and add your Gemini API key!"
    echo "   Get your key from: https://ai.google.dev/"
    echo ""
    read -p "Press Enter after you've added your API key..."
fi

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install backend dependencies"
    exit 1
fi
echo "✓ Backend dependencies installed"
cd ..

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi
echo "✓ Frontend dependencies installed"
cd ..

echo ""
echo "=========================================="
echo "  ✓ Setup Complete!"
echo "=========================================="
echo ""
echo "To start the application:"
echo ""
echo "1. Start Backend (in one terminal):"
echo "   cd backend && node server.js"
echo ""
echo "2. Start Frontend (in another terminal):"
echo "   cd frontend && npm run dev"
echo ""
echo "3. Open browser:"
echo "   http://localhost:5173"
echo ""
echo "=========================================="
echo ""
echo "💡 Testing the improvements:"
echo ""
echo "Try these casual messages in the chat:"
echo "  • 'tbh our crm is pretty bad rn'"
echo "  • 'we have like 30 people maybe 35 idk'"
echo "  • 'everyone uses diff tools its chaotic'"
echo ""
echo "The AI should now understand natural language! ✨"
echo ""
