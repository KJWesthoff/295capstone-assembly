# Week 2: Database Setup Guide

**Date**: 2025-11-07
**Feature**: Scan History & Trending
**Priority**: P0 CRITICAL

---

## Overview

Week 2 adds PostgreSQL database integration to store historical scan results, enabling:
- Scan history browsing
- Trend analysis over time
- Scan comparison (new/regressed/resolved findings)
- Persistent storage for reliability

---

## Prerequisites

- Docker Compose (already in project)
- PostgreSQL container (pgvector/pgvector:pg16)
- Python 3.11+ with SQLAlchemy

---

## Quick Start (Docker Compose)

### 1. Database Auto-Init

The PostgreSQL container automatically initializes the database on first startup using scripts in `database/init/`:

```bash
# Start PostgreSQL container
docker compose up -d postgres

# Verify database is running
docker compose logs postgres | grep "database system is ready"
```

**Auto-init scripts** (executed in alphabetical order):
1. `001_create_ventiapi_database.sql` - Creates `ventiapi` database
2. `002_scan_history_schema.sql` - Creates tables, indexes, views, functions

**Connection details**:
- Host: `localhost` (or `postgres` from within Docker network)
- Port: `54320` (external) / `5432` (internal)
- Database: `ventiapi`
- User: `rag_user`
- Password: `rag_pass` (from docker-compose.yml)

---

### 2. Verify Schema

```bash
# Connect to PostgreSQL
docker exec -it $(docker ps -q -f name=postgres) psql -U rag_user -d ventiapi

# List tables
\dt

# Expected output:
#  Schema |        Name        | Type  |   Owner
# --------+--------------------+-------+-----------
#  public | findings           | table | rag_user
#  public | scan_comparisons   | table | rag_user
#  public | scans              | table | rag_user

# Check indexes
\di

# Exit psql
\q
```

---

### 3. Configure Scanner Service

The scanner service uses the `DATABASE_URL` environment variable:

**Option A: Use default (already configured in code)**
```python
# scanner-service/web-api/database.py line 14
DATABASE_URL = "postgresql://rag_user:rag_pass@localhost:54320/ventiapi"
```

**Option B: Override with environment variable**
```bash
# In .env.local or docker-compose.yml
DATABASE_URL=postgresql://rag_user:rag_pass@postgres:5432/ventiapi
```

**Note**: Use `localhost:54320` when running scanner service outside Docker, `postgres:5432` when running inside Docker network.

---

### 4. Test Database Connection

```bash
# Start scanner service
cd scanner-service
uvicorn web-api.main:app --reload --port 8000

# Check health endpoint (includes database status)
curl http://localhost:8000/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-11-07T...",
#   "queue_stats": {...},
#   "database": {
#     "healthy": true,
#     "error": null
#   }
# }
```

---

## Manual Database Setup (Without Docker)

If running PostgreSQL outside Docker:

### 1. Install PostgreSQL 16+

```bash
# macOS
brew install postgresql@16

# Ubuntu/Debian
sudo apt-get install postgresql-16

# Start PostgreSQL
brew services start postgresql@16  # macOS
sudo systemctl start postgresql     # Linux
```

### 2. Create Database and User

```bash
psql postgres

CREATE USER rag_user WITH PASSWORD 'rag_pass';
CREATE DATABASE ventiapi OWNER rag_user ENCODING 'UTF8';
GRANT ALL PRIVILEGES ON DATABASE ventiapi TO rag_user;
\q
```

### 3. Run Migration Script

```bash
psql -U rag_user -d ventiapi -f database/migrations/002_scan_history.sql
```

### 4. Configure Connection

```bash
# Update DATABASE_URL in scanner-service/web-api/database.py
DATABASE_URL = "postgresql://rag_user:rag_pass@localhost:5432/ventiapi"
```

---

## Database Schema

### **Table: scans**
Stores scan metadata and summary statistics.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| scan_id | TEXT | Unique scan identifier (from scanner) |
| api_base_url | TEXT | API being scanned |
| created_at | TIMESTAMP | Scan creation time |
| completed_at | TIMESTAMP | Scan completion time |
| created_by | TEXT | User who initiated scan (simple auth) |
| status | TEXT | pending, running, completed, failed |
| total_findings | INTEGER | Total vulnerability count |
| critical_count | INTEGER | Critical severity count |
| high_count | INTEGER | High severity count |
| medium_count | INTEGER | Medium severity count |
| low_count | INTEGER | Low severity count |
| scanner_engines | TEXT[] | ['ventiapi', 'zap'] |
| dangerous_mode | BOOLEAN | Was dangerous mode enabled |
| fuzz_auth | BOOLEAN | Was auth fuzzing enabled |
| max_requests | INTEGER | Request budget |
| openapi_spec_path | TEXT | Path to OpenAPI spec |
| openapi_spec_url | TEXT | URL of OpenAPI spec |
| metadata | JSONB | Additional config |
| deleted_at | TIMESTAMP | Soft delete timestamp |

**Indexes**:
- `scan_id` (unique)
- `api_base_url`, `created_by`, `status`
- Composite: `(api_base_url, created_at)`, `(created_by, created_at)`

---

### **Table: findings**
Stores individual vulnerability findings.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| scan_id | UUID | Foreign key to scans.id |
| created_at | TIMESTAMP | Finding discovery time |
| rule | TEXT | OWASP API rule (API1-API10) |
| title | TEXT | Vulnerability title |
| severity | TEXT | Critical, High, Medium, Low, Info |
| score | NUMERIC(4,2) | CVSS-like score (0-10) |
| endpoint | TEXT | Affected API endpoint |
| method | TEXT | HTTP method (GET, POST, etc.) |
| description | TEXT | Detailed description |
| evidence | JSONB | Proof-of-concept data |
| scanner | TEXT | Scanner engine attribution |
| scanner_description | TEXT | Scanner details |
| cwe_ids | TEXT[] | CWE identifiers |
| cve_ids | TEXT[] | CVE identifiers |
| fingerprint | TEXT | MD5(rule:endpoint:method) for deduplication |
| metadata | JSONB | Additional context |

**Indexes**:
- `scan_id`, `rule`, `severity`, `endpoint`, `fingerprint`
- Composite: `(scan_id, fingerprint)` for deduplication queries
- GIN index on `evidence` JSONB for advanced queries

---

### **Table: scan_comparisons**
Caches comparison results between scans.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| scan_id | UUID | Current scan |
| previous_scan_id | UUID | Previous scan to compare |
| created_at | TIMESTAMP | Comparison timestamp |
| new_findings | INTEGER | Count of new findings |
| resolved_findings | INTEGER | Count of resolved findings |
| regressed_findings | INTEGER | Count of regressed findings |
| unchanged_findings | INTEGER | Count of unchanged findings |
| new_finding_ids | UUID[] | IDs of new findings |
| resolved_finding_ids | UUID[] | IDs of resolved findings |
| regressed_finding_ids | UUID[] | IDs of regressed findings |
| comparison_data | JSONB | Full comparison details |

**Constraints**:
- Unique: `(scan_id, previous_scan_id)` - prevents duplicate comparisons
- Check: `scan_id != previous_scan_id` - prevents self-comparison

---

## API Endpoints (Week 2)

### **GET /api/scans**
List historical scans with filtering and pagination.

**Query params**:
- `api_base_url` (optional): Filter by API
- `status` (optional): Filter by status (pending, running, completed, failed)
- `limit` (default: 20): Results per page
- `offset` (default: 0): Pagination offset
- `order_by` (default: created_at): Sort field
- `order_direction` (default: desc): asc or desc

**Example**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/scans?limit=10&status=completed"
```

---

### **GET /api/scan/{scan_id}/findings**
Get findings for a specific scan (database-first, file fallback).

**Query params**:
- `severity` (optional): Filter by severity
- `rule` (optional): Filter by OWASP rule
- `endpoint` (optional): Filter by endpoint pattern
- `offset`, `limit`: Pagination

**Example**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/scan/abc123/findings?severity=Critical"
```

**Response includes**:
- `source: "database"` - Found in database
- `source: "files"` - Parsed from result files (fallback)

---

### **GET /api/scan/{scan_id}/compare/{previous_scan_id}**
Compare two scans to detect changes.

**Query params**:
- `use_cache` (default: true): Use cached comparison if available

**Example**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/scan/abc123/compare/def456"
```

**Response**:
```json
{
  "scan_id": "abc123",
  "previous_scan_id": "def456",
  "new_findings": 5,
  "resolved_findings": 3,
  "regressed_findings": 1,
  "unchanged_findings": 20,
  "new_finding_ids": ["uuid1", "uuid2", ...],
  "resolved_finding_ids": ["uuid3", ...],
  "regressed_finding_ids": ["uuid4"],
  "comparison_timestamp": "2025-11-07T..."
}
```

---

### **GET /api/trends/{api_base_url}**
Calculate security trends over time.

**Query params**:
- `days` (default: 30, max: 365): Analysis period

**Example**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/trends/http:%2F%2Flocalhost:5002?days=30"
```

**Response**:
```json
{
  "api_base_url": "http://localhost:5002",
  "days": 30,
  "total_scans": 15,
  "daily_data": [
    {
      "date": "2025-10-08",
      "scan_count": 1,
      "total_findings": 45,
      "critical_count": 8,
      "high_count": 12
    },
    ...
  ],
  "summary": {
    "avg_findings": 42.5,
    "avg_critical": 7.2,
    "avg_high": 11.3,
    "trend_direction": "improving",
    "first_scan_date": "2025-10-08T...",
    "last_scan_date": "2025-11-07T..."
  }
}
```

---

### **GET /api/latest-scan/{api_base_url}**
Get the most recent completed scan for an API.

**Example**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/latest-scan/http:%2F%2Flocalhost:5002"
```

**Use case**: Auto-load latest scan in dashboards.

---

## Testing Checklist

### Database Setup
- [ ] PostgreSQL container starts successfully
- [ ] ventiapi database exists
- [ ] Tables created: scans, findings, scan_comparisons
- [ ] Views created: recent_scans, findings_with_scan_context
- [ ] Functions created: update_updated_at_column, generate_finding_fingerprint

### Scanner Integration
- [ ] Start scanner service: `uvicorn web-api.main:app --reload --port 8000`
- [ ] Health check shows database healthy: `curl http://localhost:8000/health`
- [ ] Run a scan against sample API (e.g., VAmPI)
- [ ] Check scanner logs for "📝 Persisting scan..." message
- [ ] Check database for new scan record: `SELECT * FROM scans ORDER BY created_at DESC LIMIT 1;`
- [ ] Verify findings stored: `SELECT COUNT(*) FROM findings WHERE scan_id = (SELECT id FROM scans ORDER BY created_at DESC LIMIT 1);`

### API Endpoints
- [ ] `/api/scans` returns list of scans
- [ ] `/api/scan/{id}/findings` returns findings from database (check `source: "database"`)
- [ ] Run second scan of same API
- [ ] `/api/scan/{id}/compare/{prev_id}` detects new/resolved findings
- [ ] `/api/trends/{api_url}` returns trend data
- [ ] `/api/latest-scan/{api_url}` returns most recent scan

### Frontend Integration
- [ ] Start Cedar dashboard: `cd cedar-mastra && bun run dev`
- [ ] Navigate to `/executive` dashboard
- [ ] ScanSelector dropdown shows historical scans
- [ ] Load scan → KPIs update correctly
- [ ] Severity counts match database values
- [ ] Navigate to `/dashboard` (analyst)
- [ ] Load same scan → findings table displays correctly
- [ ] Click finding → details drawer shows evidence from database

---

## Troubleshooting

### "Database connection failed"

**Symptom**: Health endpoint shows `database.healthy: false`

**Fix**:
```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check logs for errors
docker compose logs postgres

# Verify port mapping
docker compose ps postgres | grep 54320

# Test connection manually
psql -h localhost -p 54320 -U rag_user -d ventiapi
```

---

### "Scan persisted but no findings in database"

**Symptom**: Scan record exists but `total_findings = 0`

**Possible causes**:
1. Scanner failed to generate findings file
2. File parsing error

**Fix**:
```bash
# Check scanner logs
docker compose logs scanner

# Verify result files exist
docker exec $(docker ps -q -f name=web-api) ls -la /shared/results/{scan_id}/

# Check Python traceback in web-api logs
docker compose logs web-api | grep -A 10 "Persisting scan"
```

---

### "Trend data is empty"

**Symptom**: `/api/trends` returns `total_scans: 0`

**Cause**: Not enough historical data yet (need multiple scans over time)

**Fix**: Run multiple scans with delays:
```bash
# Run 5 scans with 1-minute delay
for i in {1..5}; do
  # Trigger scan via API or frontend
  sleep 60
done
```

---

### "Comparison returns no new/resolved findings"

**Symptom**: All findings marked as "unchanged"

**Cause**: Same scan compared to itself, or identical findings

**Fix**: Modify API and re-scan to create differences:
```bash
# Add a new endpoint to OpenAPI spec
# Or change auth config (e.g., enable fuzz_auth)
# Then run new scan and compare
```

---

## Performance Tuning

### Connection Pooling

Adjust pool size in `scanner-service/web-api/database.py`:

```python
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,           # Increase for high concurrency
    max_overflow=20,        # Extra connections during spikes
    pool_timeout=30,        # Connection wait time
    pool_recycle=3600,      # Recycle connections hourly
)
```

---

### Index Optimization

Add composite indexes for common queries:

```sql
-- If frequently querying by API + status
CREATE INDEX idx_scans_api_status
ON scans(api_base_url, status, created_at DESC);

-- If frequently querying by user + date range
CREATE INDEX idx_scans_user_daterange
ON scans(created_by, created_at DESC)
WHERE deleted_at IS NULL;
```

---

### Query Performance

Check slow queries:

```bash
# Enable query logging in docker-compose.yml
# Add to postgres environment:
POSTGRES_INITDB_ARGS: "-c log_statement=all -c log_duration=on"

# Restart container
docker compose restart postgres

# Analyze query plan
psql -U rag_user -d ventiapi
EXPLAIN ANALYZE SELECT * FROM scans WHERE api_base_url = 'http://localhost:5002';
```

---

## Next Steps

### Week 3: Triage Workflow
- Add `assignee`, `status`, `notes` to findings table
- Implement triage UI in analyst dashboard
- Track SLA compliance per owner

### Week 4: RBAC
- Replace `created_by TEXT` with `user_id UUID` foreign key
- Add `organizations`, `users`, `roles` tables
- Multi-tenant isolation

### Week 6: Exploit Intelligence
- Add `exploit_db_ids`, `cisa_kev_ids` to findings
- Scheduled job to enrich findings with exploit data
- Priority boost for known exploits

---

## Rollback Plan

If Week 2 deployment fails:

```bash
# 1. Stop scanner service
docker compose stop web-api

# 2. Restore pre-Week-2 code
git checkout main

# 3. Rebuild containers
docker compose build web-api

# 4. Restart services
docker compose up -d

# 5. Optional: Drop database
psql -U rag_user -d ventiapi -c "DROP TABLE IF EXISTS scan_comparisons, findings, scans CASCADE;"
```

---

## Support

- Database schema: `database/migrations/002_scan_history.sql`
- ORM models: `scanner-service/web-api/models.py`
- Business logic: `scanner-service/web-api/scan_history.py`
- API integration: `scanner-service/web-api/main.py`
- Frontend integration: `cedar-mastra/src/components/shared/ScanSelector.tsx`

**For issues**: Check `docker compose logs` and `scanner-service/web-api/*.log` files.

---

**END OF DATABASE SETUP GUIDE**
