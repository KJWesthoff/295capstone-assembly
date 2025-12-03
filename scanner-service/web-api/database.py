"""
Database module for VentiAPI Scanner
Provides async PostgreSQL database operations using databases library
"""
import os
import json
from typing import Optional, List, Dict, Any
from databases import Database
import logging

logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://rag_user:rag_pass@postgres:5432/rag_db")

# Global database connection
database = Database(DATABASE_URL)


async def connect_db():
    """Connect to the database"""
    try:
        await database.connect()
        logger.info("✅ Database connection established")

        # Test connection
        result = await database.fetch_val("SELECT 1")
        logger.info(f"✅ Database connection test: {result}")
    except Exception as e:
        logger.error(f"❌ Failed to connect to database: {e}")
        # Don't crash the app, continue without database


async def disconnect_db():
    """Disconnect from the database"""
    try:
        await database.disconnect()
        logger.info("✅ Database connection closed")
    except Exception as e:
        logger.error(f"❌ Failed to disconnect from database: {e}")


async def create_scan(
    scan_id: str,
    server_url: str,
    spec_url: Optional[str],
    scanners: list,
    dangerous: bool,
    fuzz_auth: bool,
    rps: float,
    max_requests: int,
    user_id: Optional[str]
):
    """Create a new scan record in the database"""
    try:
        query = """
            INSERT INTO scans (
                scan_id, status, server_url, spec_url, scanners,
                dangerous, fuzz_auth, rps, max_requests, user_id,
                progress, parallel_mode, total_chunks, completed_chunks
            )
            VALUES (:scan_id, :status, :server_url, :spec_url, :scanners,
                    :dangerous, :fuzz_auth, :rps, :max_requests, :user_id,
                    :progress, :parallel_mode, :total_chunks, :completed_chunks)
        """

        values = {
            "scan_id": scan_id,
            "status": "pending",
            "server_url": server_url,
            "spec_url": spec_url,
            "scanners": scanners,
            "dangerous": dangerous,
            "fuzz_auth": fuzz_auth,
            "rps": rps,
            "max_requests": max_requests,
            "user_id": user_id,
            "progress": 0,
            "parallel_mode": True,
            "total_chunks": len(scanners),
            "completed_chunks": 0
        }

        await database.execute(query=query, values=values)
        logger.info(f"✅ Created scan record in database: {scan_id}")
    except Exception as e:
        logger.error(f"❌ Failed to create scan in database: {e}")
        import traceback
        logger.error(traceback.format_exc())


async def get_scan(scan_id: str) -> Optional[Dict[str, Any]]:
    """Get a scan record from the database"""
    try:
        query = """
            SELECT scan_id, status, progress, current_phase, current_probe,
                   findings_count, total_chunks, completed_chunks, parallel_mode,
                   error, created_at, completed_at, server_url, spec_url,
                   scanners, dangerous, fuzz_auth, rps, max_requests, user_id
            FROM scans
            WHERE scan_id = :scan_id
        """

        row = await database.fetch_one(query=query, values={"scan_id": scan_id})

        if row:
            return dict(row)
        return None
    except Exception as e:
        logger.error(f"❌ Failed to get scan from database: {e}")
        return None


async def update_scan_status(
    scan_id: str,
    status: str,
    progress: Optional[int] = None,
    current_phase: Optional[str] = None,
    current_probe: Optional[str] = None,
    findings_count: Optional[int] = None,
    completed_chunks: Optional[int] = None,
    total_chunks: Optional[int] = None,
    parallel_mode: Optional[bool] = None,
    error: Optional[str] = None
):
    """Update scan status in the database"""
    try:
        # Build dynamic UPDATE query based on provided parameters
        updates = []
        values = {"scan_id": scan_id}

        if status:
            updates.append("status = :status")
            values["status"] = status

        if progress is not None:
            updates.append("progress = :progress")
            values["progress"] = progress

        if current_phase:
            updates.append("current_phase = :current_phase")
            values["current_phase"] = current_phase

        if current_probe:
            updates.append("current_probe = :current_probe")
            values["current_probe"] = current_probe

        if findings_count is not None:
            updates.append("findings_count = :findings_count")
            values["findings_count"] = findings_count

        if completed_chunks is not None:
            updates.append("completed_chunks = :completed_chunks")
            values["completed_chunks"] = completed_chunks

        if total_chunks is not None:
            updates.append("total_chunks = :total_chunks")
            values["total_chunks"] = total_chunks

        if parallel_mode is not None:
            updates.append("parallel_mode = :parallel_mode")
            values["parallel_mode"] = parallel_mode

        if error:
            updates.append("error = :error")
            values["error"] = error

        # Mark as completed if status is completed or failed
        if status in ["completed", "failed"]:
            updates.append("completed_at = NOW()")

        # Always update updated_at
        updates.append("updated_at = NOW()")

        if not updates:
            return

        query = f"""
            UPDATE scans
            SET {', '.join(updates)}
            WHERE scan_id = :scan_id
        """

        await database.execute(query=query, values=values)
        logger.info(f"✅ Updated scan status in database: {scan_id} -> {status}")
    except Exception as e:
        logger.error(f"❌ Failed to update scan status: {e}")
        import traceback
        logger.error(traceback.format_exc())


async def insert_findings(scan_id: str, findings: list) -> Optional[int]:
    """Insert findings into the database"""
    if not findings:
        return 0

    try:
        inserted_count = 0
        query = """
            INSERT INTO findings (
                scan_id, scanner, scanner_description, rule, title,
                severity, score, endpoint, method, description, evidence
            )
            VALUES (:scan_id, :scanner, :scanner_description, :rule, :title,
                    :severity, :score, :endpoint, :method, :description, :evidence)
        """

        for finding in findings:
            values = {
                "scan_id": scan_id,
                "scanner": finding.get("scanner", "ventiapi"),
                "scanner_description": finding.get("scanner_description"),
                "rule": finding.get("rule", ""),
                "title": finding.get("title", ""),
                "severity": finding.get("severity", "Informational"),
                "score": finding.get("score", 0),
                "endpoint": finding.get("endpoint", ""),
                "method": finding.get("method", "GET"),
                "description": finding.get("description", ""),
                "evidence": json.dumps(finding.get("evidence", {}))
            }

            await database.execute(query=query, values=values)
            inserted_count += 1

        logger.info(f"✅ Inserted {inserted_count} findings into database for scan {scan_id}")
        return inserted_count
    except Exception as e:
        logger.error(f"❌ Failed to insert findings: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None


async def get_findings(scan_id: str, severity: Optional[str] = None, offset: int = 0, limit: int = 1000) -> List[Dict[str, Any]]:
    """Get findings for a scan from the database with pagination"""
    try:
        if severity:
            query = """
                SELECT id, scanner, scanner_description, rule, title, severity, score,
                       endpoint, method, description, evidence, created_at
                FROM findings
                WHERE scan_id = :scan_id AND severity = :severity
                ORDER BY score DESC, severity DESC
                LIMIT :limit OFFSET :offset
            """
            values = {"scan_id": scan_id, "severity": severity, "limit": limit, "offset": offset}
        else:
            query = """
                SELECT id, scanner, scanner_description, rule, title, severity, score,
                       endpoint, method, description, evidence, created_at
                FROM findings
                WHERE scan_id = :scan_id
                ORDER BY score DESC, severity DESC
                LIMIT :limit OFFSET :offset
            """
            values = {"scan_id": scan_id, "limit": limit, "offset": offset}

        rows = await database.fetch_all(query=query, values=values)

        findings = []
        for row in rows:
            finding = dict(row)
            # Parse evidence JSON if it's a string, otherwise keep as-is
            if finding.get("evidence"):
                try:
                    if isinstance(finding["evidence"], str):
                        finding["evidence"] = json.loads(finding["evidence"])
                    elif not isinstance(finding["evidence"], dict):
                        # If it's not a string or dict, try to convert
                        finding["evidence"] = {}
                except (json.JSONDecodeError, TypeError) as e:
                    logger.warning(f"Failed to parse evidence for finding {finding.get('id')}: {e}")
                    finding["evidence"] = {}
            else:
                finding["evidence"] = {}
            findings.append(finding)

        return findings
    except Exception as e:
        logger.error(f"❌ Failed to get findings: {e}")
        return []


async def get_findings_count(scan_id: str) -> int:
    """Get count of findings for a scan"""
    try:
        query = "SELECT COUNT(*) FROM findings WHERE scan_id = :scan_id"
        count = await database.fetch_val(query=query, values={"scan_id": scan_id})
        return count or 0
    except Exception as e:
        logger.error(f"❌ Failed to get findings count: {e}")
        return 0


async def upsert_chunk_status(
    scan_id: str,
    chunk_id: int,
    scanner: str,
    status: str,
    progress: int,
    endpoints_count: int,
    total_endpoints: int
):
    """Create or update chunk status in the database"""
    try:
        # Try to insert first
        query = """
            INSERT INTO chunk_status (
                scan_id, chunk_id, scanner, status, progress,
                endpoints_count, total_endpoints
            )
            VALUES (:scan_id, :chunk_id, :scanner, :status, :progress,
                    :endpoints_count, :total_endpoints)
            ON CONFLICT (scan_id, chunk_id)
            DO UPDATE SET
                status = EXCLUDED.status,
                progress = EXCLUDED.progress,
                endpoints_count = EXCLUDED.endpoints_count,
                total_endpoints = EXCLUDED.total_endpoints,
                updated_at = NOW()
        """

        values = {
            "scan_id": scan_id,
            "chunk_id": chunk_id,
            "scanner": scanner,
            "status": status,
            "progress": progress,
            "endpoints_count": endpoints_count,
            "total_endpoints": total_endpoints
        }

        await database.execute(query=query, values=values)
        logger.debug(f"✅ Upserted chunk status for scan {scan_id}, chunk {chunk_id}")
    except Exception as e:
        logger.error(f"❌ Failed to upsert chunk status: {e}")


async def get_chunk_status(scan_id: str) -> List[Dict[str, Any]]:
    """Get chunk status for a scan"""
    try:
        query = """
            SELECT chunk_id, scanner, status, progress,
                   endpoints_count, total_endpoints, created_at, updated_at
            FROM chunk_status
            WHERE scan_id = :scan_id
            ORDER BY chunk_id
        """

        rows = await database.fetch_all(query=query, values={"scan_id": scan_id})
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"❌ Failed to get chunk status: {e}")
        return []


async def get_scan_summary(scan_id: str) -> Optional[Dict[str, Any]]:
    """Get a complete summary of a scan including findings and chunk status"""
    try:
        scan = await get_scan(scan_id)
        if not scan:
            return None

        findings_count = await get_findings_count(scan_id)
        chunk_status = await get_chunk_status(scan_id)

        return {
            "scan": scan,
            "findings_count": findings_count,
            "chunk_status": chunk_status
        }
    except Exception as e:
        logger.error(f"❌ Failed to get scan summary: {e}")
        return None


async def get_exploit_status_for_rules(rules: List[str]) -> Dict[str, bool]:
    """
    Check if there are public exploits for the given OWASP rules.
    Returns a dictionary mapping rule -> boolean (true if exploit exists).
    """
    if not rules:
        return {}

    # Static mapping of OWASP API Security Top 10 to primary CWEs
    # We focus on CWEs that are likely to have exploits in our DB
    owasp_to_cwe = {
        "API1": ["CWE-639", "CWE-285"],       # BOLA
        "API2": ["CWE-287", "CWE-306"],       # Broken Auth
        "API3": ["CWE-200", "CWE-770"],       # Excessive Data Exposure
        "API4": ["CWE-770", "CWE-400"],       # Rate Limiting
        "API5": ["CWE-285", "CWE-862"],       # BFLA
        "API6": ["CWE-799", "CWE-862"],       # Mass Assignment / Business Flows
        "API7": ["CWE-918", "CWE-16"],        # SSRF / Misconfig
        "API8": ["CWE-89", "CWE-77", "CWE-78", "CWE-94"], # Injection (SQLi, Command, Code)
        "API9": ["CWE-1059", "CWE-200"],      # Improper Assets
        "API10": ["CWE-20", "CWE-778"],       # Unsafe Consumption / Logging
    }

    # Flatten the list of relevant CWEs based on the requested rules
    relevant_cwes = set()
    rule_to_cwe_map = {}

    for rule in rules:
        # Handle "API1:2023" or just "API1"
        base_rule = rule.split(':')[0]
        if base_rule in owasp_to_cwe:
            cwes = owasp_to_cwe[base_rule]
            relevant_cwes.update(cwes)
            rule_to_cwe_map[rule] = cwes

    if not relevant_cwes:
        return {rule: False for rule in rules}

    try:
        # Query to find which CWEs have exploits
        # We join exploit_database with cwe_cve_mapping
        query = """
            SELECT DISTINCT m.cwe_id
            FROM exploit_database e
            JOIN cwe_cve_mapping m ON m.cve_id = ANY(e.cve_ids)
            WHERE m.cwe_id = ANY(:cwes)
        """
        
        rows = await database.fetch_all(query=query, values={"cwes": list(relevant_cwes)})
        exploitable_cwes = {row["cwe_id"] for row in rows}
        
        # Map back to rules
        result = {}
        for rule in rules:
            is_exploitable = False
            if rule in rule_to_cwe_map:
                # If any of the CWEs for this rule are in the exploitable set
                if any(cwe in exploitable_cwes for cwe in rule_to_cwe_map[rule]):
                    is_exploitable = True
            result[rule] = is_exploitable
            
        return result

    except Exception as e:
        logger.error(f"❌ Failed to check exploit status: {e}")
        return {rule: False for rule in rules}
