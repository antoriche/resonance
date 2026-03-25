#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Stop and remove existing container if it exists
echo "Stopping existing container (if any)..."
docker stop resonance-postgres 2>/dev/null
docker rm resonance-postgres 2>/dev/null

# Start new PostgreSQL container with pgvector support
echo "Starting PostgreSQL container with pgvector..."
docker run --name resonance-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=resonance \
  -p 5432:5432 \
  -d pgvector/pgvector:pg16

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Create vector extension
echo "Creating vector extension..."
docker exec -it resonance-postgres psql -U postgres -d resonance -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run database migrations
echo "Running database migrations..."
npm run db:migrate

echo ""
echo "✅ PostgreSQL with pgvector is ready and migrations are complete!"
echo "Connection string: $DATABASE_URL"
