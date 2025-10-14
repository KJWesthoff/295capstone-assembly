# Quick Start Guide

Get up and running with the VentiAPI Scanner in 5 minutes.

## Prerequisites

- Docker and Docker Compose installed
- Git (if cloning the repo)
- 2GB free disk space

## First Time Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd 295capstone-assembly
```

### 2. Get the Database Dump (if needed)

If your team is using the pre-ingested database, download it:

```bash
# Option A: From Git LFS (if enabled)
git lfs pull

# Option B: From AWS S3
aws s3 cp s3://your-bucket/database/rag_db_latest.sql.gz database/dumps/

# Option C: From Google Drive or shared storage
# Download manually and place in: database/dumps/rag_db_latest.sql.gz
```

### 3. Start the Services

```bash
./start-dev.sh
```

This will:
- Create environment file from example
- Build scanner images
- Start all containers (PostgreSQL, Redis, API, Frontend)
- Run health checks

### 4. Restore the Database (First Time Only)

```bash
./database-restore.sh
```

This restores the pre-ingested security knowledge database (186MB). Only needed once - data persists after this!

### 5. Access the Application

- **Main Application**: http://localhost:3000
- **API Docs**: http://localhost:3000/api/docs
- **Cedar Dashboard**: http://localhost:3001
- **Mastra Backend**: http://localhost:4111

Login credentials are in `.env.local` file.

## Daily Development Workflow

After initial setup, just:

```bash
# Start services
./start-dev.sh

# View logs
docker compose logs -f

# Stop when done
docker compose down
```

**No need to restore the database again!** It persists in the Docker volume.

## Common Tasks

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f web-api
docker compose logs -f postgres
```

### Restart a Service

```bash
docker compose restart web-api
docker compose restart postgres
```

### Access Database

```bash
docker compose exec postgres psql -U rag_user -d rag_db
```

### Backup Database

```bash
./database-dump.sh
```

### Restore from Different Dump

```bash
./database-restore.sh database/dumps/specific_dump.sql.gz
```

## Troubleshooting

### Services won't start

```bash
# Clean restart
docker compose down
docker compose up --build -d
```

### Database connection errors

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check logs
docker compose logs postgres

# Restart PostgreSQL
docker compose restart postgres
```

### Port conflicts

Check if ports are already in use:
```bash
lsof -i :3000  # Frontend
lsof -i :8000  # API
lsof -i :54320 # PostgreSQL
```

### Out of disk space

```bash
# Clean up Docker
docker system prune -a
docker volume prune
```

## Next Steps

- **Run a Security Scan**: See `scanner-service/README.md`
- **Use Cedar Dashboard**: See `QUICKSTART_CEDAR.md`
- **Database Management**: See `DATABASE_DISTRIBUTION.md`
- **Architecture Details**: See `CLAUDE.md`

## Need Help?

- Check logs: `docker compose logs -f`
- View container status: `docker compose ps`
- Restart everything: `docker compose down && ./start-dev.sh`
- See full documentation: `README.md`
