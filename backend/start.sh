#!/bin/bash

# Start script for AWS Bedrock RAG Backend
# Usage: ./start.sh

echo "🚀 Starting AWS Bedrock RAG Backend..."
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created!"
    echo ""
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Check if dependencies are installed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "📥 Installing dependencies..."
    pip install -r requirements.txt
    echo "✅ Dependencies installed!"
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "📝 Creating .env template..."
    cp .env.example .env 2>/dev/null || cat > .env << EOF
PINECONE_API_KEY=your-pinecone-key-here
PINECONE_INDEX=rag
AWS_ACCESS_KEY_ID=your-aws-access-key-here
AWS_SECRET_ACCESS_KEY=your-aws-secret-key-here
AWS_REGION=us-east-1
PORT=3000
EOF
    echo "✅ .env template created!"
    echo "⚠️  Please update .env with your API keys:"
    echo "    - PINECONE_API_KEY"
    echo "    - AWS_ACCESS_KEY_ID"
    echo "    - AWS_SECRET_ACCESS_KEY"
    echo ""
fi

# Check if AWS credentials are in .env
echo "🔍 Checking configuration..."
if grep -q "your-aws-access-key-here" .env 2>/dev/null || grep -q "your-pinecone-key-here" .env 2>/dev/null; then
    echo "⚠️  Warning: .env file contains placeholder values!"
    echo "💡 Please update .env with your actual API keys"
    echo ""
else
    echo "✅ Configuration looks good"
    echo ""
fi

echo "🎯 Starting server on port 3000..."
echo "📚 API docs available at: http://localhost:3000/docs"
echo "🏥 Health check: http://localhost:3000/health"
echo "💰 Cost: ~$0.0002 per query"
echo ""

# Start the server
python server.py

