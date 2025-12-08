# Database Implementation for Scan Results Persistence

## Overview

The scanner service now uses PostgreSQL for persistent storage of scan results, findings, and scanner metadata. This replaces the previous in-memory storage system that lost data on backend restarts.

## Benefits

1. **Persistence Across Restarts**: Scan results survive backend/container restarts
2. **Fixes Timing Issues**: Findings are atomically available (no more retry loops)
3. **Historical Analysis**: Track vulnerabilities over time
4. **Better Performance**: Database queries are faster than file parsing
5. **Concurrent Access**: Multiple clients can query results safely

## Database Schema

### Tables

#### `scans`
Stores scan metadata and status.

```sql
- id (UUID): Primary key
- scan_id (VARCHAR): Unique scan identifier
- status (VARCHAR): pending | running | completed | failed
- server_url (VARCHAR): Target server URL
- spec_url (VARCHAR): OpenAPI spec URL or file path
- scanners (TEXT[]): Array of scanner engines used
- dangerous (BOOLEAN): Dangerous mode flag
- fuzz_auth (BOOLEAN): Auth fuzzing flag
- rps (FLOAT): Requests per second limit
- max_requests (INTEGER): Maximum requests budget
- progress (INTEGER): 0-100 progress percentage
- current_probe (VARCHAR): Currently running probe
- current_phase (VARCHAR): Human-readable phase description
- findings_count (INTEGER): Total findings count
- total_chunks (INTEGER): Number of scanner containers
- completed_chunks (INTEGER): Completed scanner containers
- parallel_mode (BOOLEAN): Multi-scanner mode flag
- error (TEXT): Error message if failed
- user_id (VARCHAR): User who initiated scan
- created_at (TIMESTAMP): Scan creation time
- updated_at (TIMESTAMP): Last update time
- completed_at (TIMESTAMP): Completion time
```

#### `findings`
Stores vulnerability findings from scans.

```sql
- id (UUID): Primary key
- scan_id (VARCHAR): Foreign key to scans.scan_id
- scanner (VARCHAR): Scanner engine (ventiapi, zap)
- scanner_description (VARCHAR): Human-readable scanner name
- rule (VARCHAR): Vulnerability rule/plugin ID
- title (VARCHAR): Vulnerability title
- severity (VARCHAR): Critical | High | Medium | Low | Informational
- score (INTEGER): Numeric severity score
- endpoint (VARCHAR): API endpoint affected
- method (VARCHAR): HTTP method (GET, POST, etc.)
- description (TEXT): Detailed description
- evidence (JSONB): Evidence and technical details
- created_at (TIMESTAMP): Finding creation time
```

#### `chunk_status`
Stores progress of parallel scanner containers.

```sql
- id (UUID): Primary key
- scan_id (VARCHAR): Foreign key to scans.scan_id
- chunk_id (INTEGER): Container/chunk identifier
- scanner (VARCHAR): Scanner engine name
- status (VARCHAR): preparing | starting | running | completed | failed
- endpoints_count (INTEGER): Endpoints assigned to this chunk
- total_endpoints (INTEGER): Total endpoints for this chunk
- endpoints (TEXT[]): List of endpoints
- scanned_endpoints (TEXT[]): Completed endpoints
- current_endpoint (VARCHAR): Currently scanning endpoint
- progress (INTEGER): 0-100 progress percentage
- scan_type (VARCHAR): Scan type identifier
- error (TEXT): Error message if failed
- created_at (TIMESTAMP): Creation time
- updated_at (TIMESTAMP): Last update time
```

### Views

#### `scan_summary`
Aggregates scan results with findings breakdown by severity.

```sql
SELECT
    s.scan_id,
    s.status,
    s.server_url,
    s.scanners,
    s.progress,
    s.created_at,
    s.completed_at,
    COUNT(f.id) as total_findings,
    COUNT(f.id) FILTER (WHERE f.severity = 'Critical') as critical_count,
    COUNT(f.id) FILTER (WHERE f.severity = 'High') as high_count,
    COUNT(f.id) FILTER (WHERE f.severity = 'Medium') as medium_count,
    COUNT(f.id) FILTER (WHERE f.severity = 'Low') as low_count
FROM scans s
LEFT JOIN findings f ON s.scan_id = f.scan_id
GROUP BY s.scan_id, ...
```

## Implementation Details

### Database Module (`scanner-service/web-api/database.py`)

Provides async database operations:

- `create_scan()`: Create new scan record
- `get_scan()`: Retrieve scan by ID
- `update_scan_status()`: Update scan progress and status
- `insert_findings()`: Bulk insert findings
- `get_findings()`: Query findings with pagination and filters
- `get_findings_count()`: Get total findings count
- `upsert_chunk_status()`: Update scanner container status
- `get_chunk_status()`: Get all chunk statuses for a scan
- `get_scan_summary()`: Get scan summary with severity breakdown

### Integration Points

#### Scan Creation (`main.py:291-347`)
When a scan is created:
1. Create scan record in database
2. Initialize chunk_status records for each scanner
3. Update scan status to "pending"
4. Keep legacy in-memory store for backward compatibility

#### Scan Execution (`main.py:1163-1203`)
When a scan completes:
1. Parse findings from scanner output files
2. Insert findings into database (bulk insert)
3. Update chunk_status for each scanner container
4. Update scan status with findings count

#### Status Endpoint (`main.py:541-607`)
Returns scan status from database with fallback to in-memory store for backward compatibility.

#### Findings Endpoint (`main.py:609-693`)
Returns findings from database with fallback to file parsing for backward compatibility.

## Migration Strategy

The implementation uses a **dual-write, database-first read** pattern:

1. **Writes**: Data written to both database AND in-memory store
2. **Reads**: Try database first, fallback to in-memory/files
3. **Backward Compatibility**: Legacy endpoints still work

This allows gradual migration without breaking existing functionality.

## Setup Instructions

### 1. Database Initialization

The database schema is automatically created when PostgreSQL starts for the first time:

```bash
# The init script runs automatically
database/init/01-create-scanner-schema.sql
```

### 2. Install Dependencies

Add database libraries to scanner service:

```bash
cd scanner-service/web-api
pip install -r requirements.txt  # Includes asyncpg and databases
```

### 3. Configure Environment

Update `.env.local`:

```bash
# PostgreSQL Database (for scan results persistence)
DATABASE_URL=postgresql://rag_user:rag_pass@postgres:5432/rag_db
```

### 4. Start Services

```bash
./start-dev.sh
```

The database will be automatically initialized on first startup.

### 5. Verify Database Connection

Check backend logs:

```bash
docker compose logs web-api | grep "Connected to PostgreSQL"
```

You should see: `✅ Connected to PostgreSQL database`

## Testing Database Persistence

### Test 1: Run a Scan and Check Database

```bash
# Run a scan via the UI or API
# Then query the database directly

docker compose exec postgres psql -U rag_user -d rag_db -c "SELECT scan_id, status, findings_count FROM scans;"
```

### Test 2: Restart Backend

```bash
# Run a scan
# Restart the backend
docker compose restart web-api

# Verify scan results still visible in UI
# Check database
docker compose exec postgres psql -U rag_user -d rag_db -c "SELECT COUNT(*) FROM findings;"
```

### Test 3: Multi-Scanner Results

```bash
# Run scan with both VentiAPI and ZAP
# Check findings are attributed to correct scanner

docker compose exec postgres psql -U rag_user -d rag_db -c "SELECT scanner, COUNT(*) FROM findings GROUP BY scanner;"
```

## Database Queries

### List Recent Scans

```sql
SELECT scan_id, status, server_url, findings_count, created_at
FROM scans
ORDER BY created_at DESC
LIMIT 10;
```

### View Scan Summary

```sql
SELECT * FROM scan_summary WHERE scan_id = 'your-scan-id';
```

### Findings by Severity

```sql
SELECT severity, COUNT(*)
FROM findings
WHERE scan_id = 'your-scan-id'
GROUP BY severity
ORDER BY CASE severity
    WHEN 'Critical' THEN 1
    WHEN 'High' THEN 2
    WHEN 'Medium' THEN 3
    WHEN 'Low' THEN 4
    ELSE 5
END;
```

### Findings by Scanner

```sql
SELECT scanner, scanner_description, COUNT(*)
FROM findings
WHERE scan_id = 'your-scan-id'
GROUP BY scanner, scanner_description;
```

### Recent High-Severity Findings

```sql
SELECT f.scan_id, f.title, f.severity, f.endpoint, f.method, s.server_url
FROM findings f
JOIN scans s ON f.scan_id = s.scan_id
WHERE f.severity IN ('Critical', 'High')
ORDER BY f.created_at DESC
LIMIT 20;
```

## Troubleshooting

### Database Connection Errors

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check connection string
docker compose exec web-api env | grep DATABASE_URL

# Test connection from web-api container
docker compose exec web-api python3 -c "import asyncpg; import asyncio; asyncio.run(asyncpg.connect('postgresql://rag_user:rag_pass@postgres:5432/rag_db'))"
```

### Schema Not Created

```bash
# Check if init script ran
docker compose logs postgres | grep "01-create-scanner-schema.sql"

# If database already exists, manually run schema
docker compose exec postgres psql -U rag_user -d rag_db -f /docker-entrypoint-initdb.d/01-create-scanner-schema.sql
```

### Findings Not Appearing

```bash
# Check scan status
docker compose exec postgres psql -U rag_user -d rag_db -c "SELECT scan_id, status, findings_count FROM scans ORDER BY created_at DESC LIMIT 5;"

# Check findings count
docker compose exec postgres psql -U rag_user -d rag_db -c "SELECT scan_id, COUNT(*) FROM findings GROUP BY scan_id;"

# Check backend logs
docker compose logs web-api | grep "Inserted.*findings"
```

## Future Enhancements

1. **Historical Trend Analysis**: Track vulnerability trends over time
2. **Baseline Comparisons**: Compare scans to establish security posture
3. **Remediation Tracking**: Track when findings are fixed
4. **API Endpoint Metadata**: Store endpoint schemas and metadata
5. **Scan Templates**: Save and reuse scan configurations
6. **Export/Import**: Export findings to various formats (SARIF, CSV, etc.)

## Files Modified

### New Files
- `database/init/01-create-scanner-schema.sql` - Database schema
- `scanner-service/web-api/database.py` - Database operations module
- `docs/DATABASE_IMPLEMENTATION.md` - This documentation

### Modified Files
- `scanner-service/web-api/requirements.txt` - Added asyncpg and databases
- `scanner-service/web-api/main.py` - Integrated database operations
- `.env.local.example` - Added DATABASE_URL
- `.env.local` - Added DATABASE_URL configuration

## Performance Considerations

1. **Indexes**: The schema includes indexes on frequently queried columns (scan_id, severity, scanner)
2. **Pagination**: Findings endpoint supports offset/limit for large result sets
3. **Bulk Inserts**: Findings are inserted in bulk using `execute_many()`
4. **Connection Pooling**: The `databases` library handles connection pooling automatically

## Security Considerations

1. **SQL Injection**: All queries use parameterized queries via the `databases` library
2. **Access Control**: Endpoints require JWT authentication
3. **Data Isolation**: Findings are scoped to scan_id
4. **Sensitive Data**: Evidence JSONB field may contain sensitive request/response data - consider encryption at rest for production
