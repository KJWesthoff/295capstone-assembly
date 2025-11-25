# Database Initialization Scripts

This directory contains SQL scripts that run automatically when the PostgreSQL container starts for the **first time**.

## How It Works

PostgreSQL's official Docker image automatically executes scripts in `/docker-entrypoint-initdb.d/` on first startup. This directory is mapped to that location in our `docker-compose.yml`.

## Usage

### Running Scripts on First Startup

1. Place your `.sql` files in this directory
2. Start the containers: `./start-dev.sh`
3. Scripts execute in alphabetical order
4. Scripts only run if the database is empty (first startup)

### Naming Convention

Use prefixes to control execution order:

```
01-create-extensions.sql
02-create-schema.sql
03-create-tables.sql
04-insert-seed-data.sql
```

## Example Scripts

### Enable Extensions

`01-create-extensions.sql`:
```sql
-- Enable pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Create Initial Schema

`02-create-schema.sql`:
```sql
-- Create embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS embeddings_embedding_idx
ON embeddings USING ivfflat (embedding vector_cosine_ops);
```

## Important Notes

- **First time only**: Scripts only run when the database is completely empty
- **Idempotent**: Use `IF NOT EXISTS` to make scripts safe to re-run
- **Order matters**: Name files to control execution order
- **Not for updates**: For existing databases, use migrations instead

## Resetting the Database

To run init scripts again:

```bash
# Stop containers
docker compose down

# Remove database volume
docker volume rm 295capstone-assembly_postgres-data

# Start fresh (init scripts will run)
./start-dev.sh
```

## Alternative: Database Dumps

For pre-populated databases (like our RAG system), using database dumps is usually better:

- Faster than running init scripts
- Preserves exact data state
- Easier to distribute
- See `DATABASE_DISTRIBUTION.md` for dump/restore workflow

Use init scripts for:
- Extension installation
- Basic schema creation
- Development seed data
- Empty database setup

Use database dumps for:
- Large datasets
- Production-like data
- ML embeddings
- Data that took hours/days to ingest
