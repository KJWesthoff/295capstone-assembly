# Database Distribution Guide

This guide explains how to package, distribute, and deploy the PostgreSQL database that contains pre-ingested data for the VentiAPI Scanner project.

## Overview

The project uses PostgreSQL for the Cedar/Mastra RAG system, which stores security knowledge embeddings and other data that took days to ingest. This guide ensures your team can quickly get started without re-ingesting all that data.

## Quick Start for Team Members

If you're a new team member who just cloned the repo:

```bash
# 1. Ensure you have the database dump file in the right location
#    (Download from your team's shared storage if not in git)
ls -lh database/dumps/rag_db_latest.sql.gz

# 2. Start the development environment
./start-dev.sh

# 3. Restore the database (first time only)
./database-restore.sh
```

That's it! After the first restore, your database will persist across restarts.

## For Database Maintainers

### Creating a Database Dump

When you've updated the database and want to share it with the team:

```bash
# Create a compressed dump of the current database
./database-dump.sh
```

This creates:
- Timestamped dump: `database/dumps/rag_db_dump_YYYYMMDD_HHMMSS.sql.gz`
- Symlink to latest: `database/dumps/rag_db_latest.sql.gz`

### Distribution Methods

Choose one of these methods to share the database dump:

#### Option 1: Git LFS (Recommended for files < 2GB)

Best for version-controlled database dumps that the whole team needs.

```bash
# First time setup (once per repo)
git lfs install
git lfs track "database/dumps/*.sql.gz"
git add .gitattributes

# Add and commit the dump
git add database/dumps/rag_db_latest.sql.gz
git commit -m "Update database dump with latest security knowledge"
git push
```

**Team members will automatically download it when they clone/pull.**

#### Option 2: Cloud Storage (Recommended for files > 2GB)

Best for large databases or when you don't want dumps in git history.

**AWS S3:**
```bash
# Upload to S3
aws s3 cp database/dumps/rag_db_latest.sql.gz \
  s3://your-company-bucket/ventiapi-scanner/database/

# Team members download
aws s3 cp s3://your-company-bucket/ventiapi-scanner/database/rag_db_latest.sql.gz \
  database/dumps/
```

**Google Cloud Storage:**
```bash
# Upload to GCS
gsutil cp database/dumps/rag_db_latest.sql.gz \
  gs://your-company-bucket/ventiapi-scanner/database/

# Team members download
gsutil cp gs://your-company-bucket/ventiapi-scanner/database/rag_db_latest.sql.gz \
  database/dumps/
```

**Google Drive / Dropbox:**
1. Upload `database/dumps/rag_db_latest.sql.gz` to shared folder
2. Share link with team
3. Team members download and place in `database/dumps/`

#### Option 3: Internal File Server

Best for teams with existing internal file sharing infrastructure.

```bash
# Copy to shared network location
cp database/dumps/rag_db_latest.sql.gz /mnt/company-share/ventiapi-scanner/

# Team members copy from shared location
cp /mnt/company-share/ventiapi-scanner/rag_db_latest.sql.gz database/dumps/
```

## Manual Database Operations

### Restoring the Database

**Important:** The database restore does NOT happen automatically. You must run it manually after starting services.

```bash
# Step 1: Start services first
./start-dev.sh

# Step 2: Restore from latest dump (first time setup)
./database-restore.sh

# OR: Restore from a specific dump file
./database-restore.sh database/dumps/rag_db_dump_20250112_143022.sql.gz
```

**Why manual restore?**
- Prevents overwriting development changes on every restart
- Faster startup time (186MB restore takes time)
- Only needed once - data persists in Docker volume
- Gives you control over when to refresh data

### Accessing the Database Directly

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U rag_user -d rag_db

# List tables
\dt

# Query data
SELECT COUNT(*) FROM embeddings;

# Exit
\q
```

### Checking Database Size

```bash
# Size of dump file
ls -lh database/dumps/rag_db_latest.sql.gz

# Size in PostgreSQL
docker compose exec postgres psql -U rag_user -d rag_db -c "
  SELECT pg_size_pretty(pg_database_size('rag_db')) AS db_size;
"
```

### Creating a Fresh Database

If you want to start with an empty database:

```bash
# Remove existing dumps
rm -rf database/dumps/*

# Stop and remove database volume
docker compose down
docker volume rm 295capstone-assembly_postgres-data

# Start fresh
./start-dev.sh
```

## Automated Workflows

### CI/CD Integration

For automated deployments, you can add database restoration to your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Restore Database
  run: |
    # Download dump from artifact storage
    aws s3 cp s3://your-bucket/rag_db_latest.sql.gz database/dumps/

    # Start services and restore
    ./start-dev.sh
```

### Scheduled Backups

Set up automated backups using cron:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/project && ./database-dump.sh

# Add weekly upload to S3
0 3 * * 0 cd /path/to/project && \
  aws s3 cp database/dumps/rag_db_latest.sql.gz \
  s3://your-bucket/backups/$(date +\%Y-\%m-\%d)_rag_db.sql.gz
```

## Database Schema

The PostgreSQL database contains:

- **Embeddings Table**: Vector embeddings for security knowledge (OWASP, CVE, MITRE)
- **Documents Table**: Source documents and metadata
- **Chat History**: Mastra agent conversation history
- **User Preferences**: Cedar OS state and user settings

## Troubleshooting

### Database Restore Fails

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres

# Try manual restore
docker compose up -d postgres
sleep 10
gunzip -c database/dumps/rag_db_latest.sql.gz | \
  docker compose exec -T postgres psql -U rag_user -d rag_db
```

### Dump File Not Found

```bash
# List available dumps
ls -lh database/dumps/

# If no dumps exist, check distribution method
# - Git LFS: git lfs pull
# - Cloud: Download from S3/GCS
# - Network: Copy from shared location
```

### Out of Disk Space

```bash
# Check Docker volumes
docker system df

# Clean up old volumes
docker volume prune

# Remove old dump files
find database/dumps -name "*.sql.gz" -mtime +30 -delete  # Keep last 30 days
```

### Database Connection Errors

```bash
# Check DATABASE_URL in cedar-mastra/.env
cat cedar-mastra/.env | grep DATABASE_URL

# Should be: postgresql://rag_user:rag_pass@localhost:54320/rag_db (local dev)
# Or: postgresql://rag_user:rag_pass@postgres:5432/rag_db (docker compose)

# Test connection
docker compose exec postgres pg_isready -U rag_user -d rag_db
```

## Security Notes

- **Never commit unencrypted database dumps containing sensitive data**
- Use Git LFS for dumps, which stores files outside main git history
- Consider encrypting dumps before uploading to cloud storage:
  ```bash
  # Encrypt before upload
  gpg -c database/dumps/rag_db_latest.sql.gz

  # Decrypt after download
  gpg database/dumps/rag_db_latest.sql.gz.gpg
  ```
- Rotate database credentials regularly
- Use environment variables for credentials (never hardcode)

## Performance Tips

- Compressed dumps are typically 10-20% of uncompressed size
- Large databases (>5GB) benefit from parallel dump/restore:
  ```bash
  # Parallel dump (faster)
  docker compose exec postgres pg_dump -U rag_user -d rag_db \
    --jobs=4 --format=directory --file=/dumps/parallel/

  # Parallel restore (faster)
  docker compose exec postgres pg_restore -U rag_user -d rag_db \
    --jobs=4 /dumps/parallel/
  ```
- Use pgvector-specific optimizations for embeddings tables

## Additional Resources

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [Git LFS Documentation](https://git-lfs.github.com/)
- [pgvector Best Practices](https://github.com/pgvector/pgvector)
- Project-specific docs: `CLAUDE.md`, `QUICKSTART_CEDAR.md`
