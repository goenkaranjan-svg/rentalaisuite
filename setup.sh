#!/bin/bash

set -e

echo "🚀 Setting up Rental AI Suite..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    
    # Generate SESSION_SECRET
    if command -v openssl &> /dev/null; then
        SESSION_SECRET=$(openssl rand -base64 32)
        # Escape special characters for sed
        SESSION_SECRET_ESCAPED=$(echo "$SESSION_SECRET" | sed 's/[[\.*^$()+?{|]/\\&/g')
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/your-session-secret-here-change-this-in-production/$SESSION_SECRET_ESCAPED/" .env
        else
            # Linux
            sed -i "s/your-session-secret-here-change-this-in-production/$SESSION_SECRET_ESCAPED/" .env
        fi
        echo "✅ Generated SESSION_SECRET"
    else
        echo "⚠️  openssl not found. Please manually set SESSION_SECRET in .env"
    fi
    
    echo "✅ Created .env file"
    echo ""
    echo "⚠️  IMPORTANT: Please update the following in .env:"
    echo "   - DATABASE_URL (if not using Docker)"
    echo "   - CLIENT_ID (for OIDC authentication)"
    echo "   - ISSUER_URL or OIDC_ISSUER_URL (for OIDC authentication)"
    echo ""
else
    echo "✅ .env file already exists"
fi

# Check if Docker is available
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo ""
    echo "🐳 Docker detected. Would you like to start PostgreSQL with Docker? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "🐳 Starting PostgreSQL with Docker..."
        docker-compose up -d postgres
        
        echo "⏳ Waiting for PostgreSQL to be ready..."
        sleep 5
        
        # Update .env with Docker database URL
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rental_ai_suite|' .env
        else
            sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rental_ai_suite|' .env
        fi
        
        echo "✅ PostgreSQL is running!"
        echo "   Connection: postgresql://postgres:postgres@localhost:5432/rental_ai_suite"
    fi
else
    echo ""
    echo "⚠️  Docker not found. Please set up PostgreSQL manually and update DATABASE_URL in .env"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🗄️  Running database migrations..."
npm run db:push

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your OIDC credentials (CLIENT_ID, ISSUER_URL)"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Or run 'npm run build && npm start' for production"
