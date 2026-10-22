#!/bin/bash
# Database migration script for deployment

echo "🗄️  Database Migration Script"
echo "================================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "   Usage: DATABASE_URL='postgresql://user:password@host:port/db' ./scripts/deploy-db.sh"
    exit 1
fi

echo "📊 Database URL detected"
echo ""

# Navigate to db directory
cd "$(dirname "$0")/../lib/db"

echo "🔄 Running Drizzle migration..."
echo ""

# Run the migration
DATABASE_URL="$DATABASE_URL" pnpm exec drizzle-kit push --config ./drizzle.config.ts

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Verify tables in your database dashboard"
    echo "   2. Update your application environment variables"
    echo "   3. Restart your application"
else
    echo ""
    echo "❌ Migration failed. Please check the error above."
    exit 1
fi
