#!/bin/bash

# PostgreSQL Database Restore Script
# Restores the RAG database from a dump file

set -e

echo "📥 Restoring PostgreSQL database from dump..."

# Configuration
DUMP_DIR="./database/dumps"
LATEST_DUMP="${DUMP_DIR}/rag_db_latest.sql.gz"

# Allow specifying a custom dump file
DUMP_FILE="${1:-$LATEST_DUMP}"

# Check if dump file exists
if [ ! -f "${DUMP_FILE}" ]; then
    echo "❌ Dump file not found: ${DUMP_FILE}"
    echo ""
    echo "Available dumps in ${DUMP_DIR}:"
    ls -lh "${DUMP_DIR}"/*.sql.gz 2>/dev/null || echo "   (none found)"
    echo ""
    echo "Usage:"
    echo "   ./database-restore.sh                           # Restore latest dump"
    echo "   ./database-restore.sh path/to/dump.sql.gz       # Restore specific dump"
    exit 1
fi

# Check if postgres container is running
if ! docker compose ps postgres | grep -q "running"; then
    echo "⚠️  PostgreSQL container is not running. Starting it..."
    docker compose up -d postgres
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 5
fi

# Wait for PostgreSQL to be healthy
echo "🏥 Checking PostgreSQL health..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker compose exec postgres pg_isready -U rag_user -d rag_db > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "   Waiting... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ PostgreSQL failed to become ready in time"
    exit 1
fi

# Decompress and restore
echo "📂 Restoring from: ${DUMP_FILE}"

if [[ "${DUMP_FILE}" == *.gz ]]; then
    # Compressed file - decompress and restore
    echo "🗜️  Decompressing and restoring..."
    gunzip -c "${DUMP_FILE}" | docker compose exec -T postgres psql -U rag_user -d rag_db
else
    # Uncompressed file - restore directly
    echo "📤 Restoring uncompressed dump..."
    cat "${DUMP_FILE}" | docker compose exec -T postgres psql -U rag_user -d rag_db
fi

echo ""
echo "✅ Database restored successfully!"
echo ""
echo "📊 Database Info:"
docker compose exec postgres psql -U rag_user -d rag_db -c "\dt" || true
echo ""
echo "💡 Next steps:"
echo "   - Verify data: docker compose exec postgres psql -U rag_user -d rag_db"
echo "   - Start services: ./start-dev.sh"
