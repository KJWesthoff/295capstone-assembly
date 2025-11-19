"""
Database connection and operations for scanner service
Stores scan results, findings, and scanner metadata in PostgreSQL
"""

import os
from typing import List, Dict, Optional, Any
from datetime import datetime
from databases import Database
import asyncpg

# Database connection URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://rag_user:rag_pass@postgres:5432/rag_db"
)

# Global database instance
database = Database(DATABASE_URL)


async def connect_db():
    """Connect to database on startup"""
    try:
        await database.connect()
        print(f"✅ Connected to PostgreSQL database")
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        print(f"   Connection string: {DATABASE_URL}")
        raise


async def disconnect_db():
    """Disconnect from database on shutdown"""
    try:
        await database.disconnect()
        print("✅ Disconnected from database")
    except Exception as e:
        print(f"⚠️ Error disconnecting from database: {e}")


# ============================================================================
# Scan Operations
# ============================================================================

async def create_scan(
    scan_id: str,
    server_url: str,
    spec_url: Optional[str],
    scanners: List[str],
    dangerous: bool = False,
    fuzz_auth: bool = False,
    rps: float = 1.0,
    max_requests: int = 100,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """Create a new scan record"""
    query = """
        INSERT INTO scans (
            scan_id, status, server_url, spec_url, scanners,
            dangerous, fuzz_auth, rps, max_requests, user_id
        ) VALUES (
            :scan_id, 'pending', :server_url, :spec_url, :scanners,
            :dangerous, :fuzz_auth, :rps, :max_requests, :user_id
        ) RETURNING *
    """
    values = {
        "scan_id": scan_id,
        "server_url": server_url,
        "spec_url": spec_url,
        "scanners": scanners,
        "dangerous": dangerous,
        "fuzz_auth": fuzz_auth,
        "rps": rps,
        "max_requests": max_requests,
        "user_id": user_id
    }

    result = await database.fetch_one(query=query, values=values)
    return dict(result) if result else {}


async def get_scan(scan_id: str) -> Optional[Dict[str, Any]]:
    """Get scan by scan_id"""
    query = "SELECT * FROM scans WHERE scan_id = :scan_id"
    result = await database.fetch_one(query=query, values={"scan_id": scan_id})
    return dict(result) if result else None


async def update_scan_status(
    scan_id: str,
    status: str,
    progress: Optional[int] = None,
    current_probe: Optional[str] = None,
    current_phase: Optional[str] = None,
    findings_count: Optional[int] = None,
    error: Optional[str] = None,
    total_chunks: Optional[int] = None,
    completed_chunks: Optional[int] = None,
    parallel_mode: Optional[bool] = None
) -> bool:
    """Update scan status and progress"""

    # Build dynamic update query based on provided fields
    updates = ["status = :status", "updated_at = NOW()"]
    values = {"scan_id": scan_id, "status": status}

    if progress is not None:
        updates.append("progress = :progress")
        values["progress"] = progress

    if current_probe is not None:
        updates.append("current_probe = :current_probe")
        values["current_probe"] = current_probe

    if current_phase is not None:
        updates.append("current_phase = :current_phase")
        values["current_phase"] = current_phase

    if findings_count is not None:
        updates.append("findings_count = :findings_count")
        values["findings_count"] = findings_count

    if error is not None:
        updates.append("error = :error")
        values["error"] = error

    if total_chunks is not None:
        updates.append("total_chunks = :total_chunks")
        values["total_chunks"] = total_chunks

    if completed_chunks is not None:
        updates.append("completed_chunks = :completed_chunks")
        values["completed_chunks"] = completed_chunks

    if parallel_mode is not None:
        updates.append("parallel_mode = :parallel_mode")
        values["parallel_mode"] = parallel_mode

    if status == "completed":
        updates.append("completed_at = NOW()")

    query = f"UPDATE scans SET {', '.join(updates)} WHERE scan_id = :scan_id"

    try:
        await database.execute(query=query, values=values)
        return True
    except Exception as e:
        print(f"❌ Error updating scan status: {e}")
        return False


# ============================================================================
# Findings Operations
# ============================================================================

async def insert_findings(scan_id: str, findings: List[Dict[str, Any]]) -> int:
    """Bulk insert findings for a scan"""
    if not findings:
        return 0

    query = """
        INSERT INTO findings (
            scan_id, scanner, scanner_description, rule, title,
            severity, score, endpoint, method, description, evidence
        ) VALUES (
            :scan_id, :scanner, :scanner_description, :rule, :title,
            :severity, :score, :endpoint, :method, :description, :evidence
        )
    """

    values_list = []
    for finding in findings:
        values_list.append({
            "scan_id": scan_id,
            "scanner": finding.get("scanner", "unknown"),
            "scanner_description": finding.get("scanner_description", ""),
            "rule": finding.get("rule", ""),
            "title": finding.get("title", ""),
            "severity": finding.get("severity", "Low"),
            "score": finding.get("score", 0),
            "endpoint": finding.get("endpoint", "/"),
            "method": finding.get("method", "GET"),
            "description": finding.get("description", ""),
            "evidence": finding.get("evidence", {})
        })

    try:
        await database.execute_many(query=query, values=values_list)
        print(f"✅ Inserted {len(findings)} findings for scan {scan_id}")
        return len(findings)
    except Exception as e:
        print(f"❌ Error inserting findings: {e}")
        return 0


async def get_findings(
    scan_id: str,
    offset: int = 0,
    limit: int = 50,
    severity: Optional[str] = None,
    scanner: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get findings for a scan with pagination and filters"""

    conditions = ["scan_id = :scan_id"]
    values: Dict[str, Any] = {"scan_id": scan_id, "offset": offset, "limit": limit}

    if severity:
        conditions.append("severity = :severity")
        values["severity"] = severity

    if scanner:
        conditions.append("scanner = :scanner")
        values["scanner"] = scanner

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT
            id, scan_id, scanner, scanner_description, rule, title,
            severity, score, endpoint, method, description, evidence,
            created_at
        FROM findings
        WHERE {where_clause}
        ORDER BY
            CASE severity
                WHEN 'Critical' THEN 1
                WHEN 'High' THEN 2
                WHEN 'Medium' THEN 3
                WHEN 'Low' THEN 4
                ELSE 5
            END,
            score DESC,
            created_at DESC
        OFFSET :offset LIMIT :limit
    """

    results = await database.fetch_all(query=query, values=values)
    return [dict(row) for row in results]


async def get_findings_count(scan_id: str) -> int:
    """Get total count of findings for a scan"""
    query = "SELECT COUNT(*) as count FROM findings WHERE scan_id = :scan_id"
    result = await database.fetch_one(query=query, values={"scan_id": scan_id})
    return result["count"] if result else 0


# ============================================================================
# Chunk Status Operations
# ============================================================================

async def upsert_chunk_status(
    scan_id: str,
    chunk_id: int,
    scanner: str,
    status: str,
    endpoints_count: int = 0,
    total_endpoints: int = 0,
    endpoints: Optional[List[str]] = None,
    scanned_endpoints: Optional[List[str]] = None,
    current_endpoint: Optional[str] = None,
    progress: int = 0,
    scan_type: Optional[str] = None,
    error: Optional[str] = None
) -> bool:
    """Insert or update chunk status"""

    query = """
        INSERT INTO chunk_status (
            scan_id, chunk_id, scanner, status, endpoints_count, total_endpoints,
            endpoints, scanned_endpoints, current_endpoint, progress, scan_type, error
        ) VALUES (
            :scan_id, :chunk_id, :scanner, :status, :endpoints_count, :total_endpoints,
            :endpoints, :scanned_endpoints, :current_endpoint, :progress, :scan_type, :error
        )
        ON CONFLICT (scan_id, chunk_id)
        DO UPDATE SET
            status = :status,
            endpoints_count = :endpoints_count,
            total_endpoints = :total_endpoints,
            endpoints = :endpoints,
            scanned_endpoints = :scanned_endpoints,
            current_endpoint = :current_endpoint,
            progress = :progress,
            scan_type = :scan_type,
            error = :error,
            updated_at = NOW()
    """

    values = {
        "scan_id": scan_id,
        "chunk_id": chunk_id,
        "scanner": scanner,
        "status": status,
        "endpoints_count": endpoints_count,
        "total_endpoints": total_endpoints,
        "endpoints": endpoints or [],
        "scanned_endpoints": scanned_endpoints or [],
        "current_endpoint": current_endpoint,
        "progress": progress,
        "scan_type": scan_type,
        "error": error
    }

    try:
        await database.execute(query=query, values=values)
        return True
    except Exception as e:
        print(f"❌ Error upserting chunk status: {e}")
        return False


async def get_chunk_status(scan_id: str) -> List[Dict[str, Any]]:
    """Get all chunk statuses for a scan"""
    query = """
        SELECT * FROM chunk_status
        WHERE scan_id = :scan_id
        ORDER BY chunk_id
    """
    results = await database.fetch_all(query=query, values={"scan_id": scan_id})
    return [dict(row) for row in results]


# ============================================================================
# Utility Operations
# ============================================================================

async def get_scan_summary(scan_id: str) -> Optional[Dict[str, Any]]:
    """Get scan summary with findings breakdown"""
    query = "SELECT * FROM scan_summary WHERE scan_id = :scan_id"
    result = await database.fetch_one(query=query, values={"scan_id": scan_id})
    return dict(result) if result else None


async def list_recent_scans(limit: int = 20) -> List[Dict[str, Any]]:
    """List recent scans with summary"""
    query = """
        SELECT * FROM scan_summary
        ORDER BY created_at DESC
        LIMIT :limit
    """
    results = await database.fetch_all(query=query, values={"limit": limit})
    return [dict(row) for row in results]
