#!/bin/bash

# PostgreSQL Database Dump Script
# Creates a compressed dump of the RAG database for distribution

set -e

echo "📦 Creating PostgreSQL database dump..."

# Configuration
DUMP_DIR="./database/dumps"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${DUMP_DIR}/rag_db_dump_${TIMESTAMP}.sql"
LATEST_LINK="${DUMP_DIR}/rag_db_latest.sql"

# Ensure dump directory exists
mkdir -p "${DUMP_DIR}"

# Check if postgres container is running
if ! docker compose ps postgres | grep -q "running"; then
    echo "❌ PostgreSQL container is not running!"
    echo "   Start it with: docker compose up -d postgres"
    exit 1
fi

# Create the dump
echo "📤 Dumping database from container..."
docker compose exec -T postgres pg_dump \
    -U rag_user \
    -d rag_db \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    > "${DUMP_FILE}"

# Create symlink to latest dump
ln -sf "$(basename ${DUMP_FILE})" "${LATEST_LINK}"

# Compress the dump
echo "🗜️  Compressing dump file..."
gzip -f "${DUMP_FILE}"
DUMP_FILE_GZ="${DUMP_FILE}.gz"

# Update latest link to compressed file
ln -sf "$(basename ${DUMP_FILE_GZ})" "${LATEST_LINK}.gz"

# Get file size
FILE_SIZE=$(du -h "${DUMP_FILE_GZ}" | cut -f1)

echo ""
echo "✅ Database dump created successfully!"
echo ""
echo "📊 Dump Details:"
echo "   📁 File: ${DUMP_FILE_GZ}"
echo "   📏 Size: ${FILE_SIZE}"
echo "   🔗 Latest: ${LATEST_LINK}.gz"
echo ""
echo "📤 Distribution Options:"
echo ""
echo "   1. Add to Git LFS (recommended for large files):"
echo "      git lfs track '*.sql.gz'"
echo "      git add .gitattributes ${DUMP_FILE_GZ}"
echo "      git commit -m 'Add database dump'"
echo ""
echo "   2. Upload to cloud storage:"
echo "      aws s3 cp ${DUMP_FILE_GZ} s3://your-bucket/database-dumps/"
echo "      # Or use Google Drive, Dropbox, etc."
echo ""
echo "   3. Share via internal file server:"
echo "      cp ${DUMP_FILE_GZ} /path/to/shared/storage/"
echo ""
echo "💡 Team members can restore with: ./database-restore.sh"
