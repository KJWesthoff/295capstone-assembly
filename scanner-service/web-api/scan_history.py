"""
Scan history management for VentiAPI.

This module handles:
- Storing scan results to PostgreSQL
- Retrieving historical scans with filtering
- Comparing scans to detect new/regressed/resolved findings
- Calculating trends from historical data

Week 2: Scan History & Trending
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID, uuid4
from collections import defaultdict

from sqlalchemy import and_, or_, func, desc
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from models import Scan, Finding, ScanComparison

logger = logging.getLogger(__name__)


# ============================================================================
# Scan Storage Functions
# ============================================================================

async def store_scan_result(
    db: Session,
    scan_id: str,
    api_base_url: str,
    findings: List[Dict[str, Any]],
    scanner_config: Dict[str, Any],
    created_by: Optional[str] = None,
    status: str = "completed"
) -> Scan:
    """
    Store a completed scan and its findings to the database.

    Args:
        db: Database session
        scan_id: Unique scan identifier
        api_base_url: Base URL of the API that was scanned
        findings: List of vulnerability findings
        scanner_config: Scanner configuration (engines, dangerous_mode, etc.)
        created_by: User who initiated the scan
        status: Scan status (pending, running, completed, failed)

    Returns:
        Scan: The created scan record

    Raises:
        IntegrityError: If scan_id already exists
    """
    try:
        # Calculate summary counts
        severity_counts = {
            "Critical": 0,
            "High": 0,
            "Medium": 0,
            "Low": 0,
        }
        for finding in findings:
            severity = finding.get("severity", "Low")
            if severity in severity_counts:
                severity_counts[severity] += 1

        # Create scan record
        scan = Scan(
            id=uuid4(),
            scan_id=scan_id,
            api_base_url=api_base_url,
            created_by=created_by,
            status=status,
            total_findings=len(findings),
            critical_count=severity_counts["Critical"],
            high_count=severity_counts["High"],
            medium_count=severity_counts["Medium"],
            low_count=severity_counts["Low"],
            scanner_engines=scanner_config.get("engines", ["ventiapi"]),
            dangerous_mode=scanner_config.get("dangerous_mode", False),
            fuzz_auth=scanner_config.get("fuzz_auth", False),
            max_requests=scanner_config.get("max_requests"),
            openapi_spec_path=scanner_config.get("openapi_spec_path"),
            openapi_spec_url=scanner_config.get("openapi_spec_url"),
            metadata=scanner_config.get("metadata", {}),
            completed_at=datetime.utcnow() if status == "completed" else None,
        )

        db.add(scan)
        db.flush()  # Get scan.id for findings

        # Store findings
        for finding_data in findings:
            # Calculate fingerprint for deduplication
            fingerprint = Finding.calculate_fingerprint(
                rule=finding_data.get("rule", "UNKNOWN"),
                endpoint=finding_data.get("endpoint", ""),
                method=finding_data.get("method", "GET")
            )

            finding = Finding(
                id=uuid4(),
                scan_id=scan.id,
                rule=finding_data.get("rule", "UNKNOWN"),
                title=finding_data.get("title", "Untitled Vulnerability"),
                severity=finding_data.get("severity", "Low"),
                score=finding_data.get("score"),
                endpoint=finding_data.get("endpoint", ""),
                method=finding_data.get("method", "GET"),
                description=finding_data.get("description"),
                evidence=finding_data.get("evidence", {}),
                scanner=finding_data.get("scanner", "ventiapi"),
                scanner_description=finding_data.get("scanner_description"),
                cwe_ids=finding_data.get("cwe_ids"),
                cve_ids=finding_data.get("cve_ids"),
                fingerprint=fingerprint,
                metadata=finding_data.get("metadata", {}),
            )
            db.add(finding)

        db.commit()
        db.refresh(scan)

        logger.info(f"Stored scan {scan_id} with {len(findings)} findings")
        return scan

    except IntegrityError as e:
        db.rollback()
        logger.error(f"Scan {scan_id} already exists: {e}")
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to store scan {scan_id}: {e}")
        raise


async def update_scan_status(
    db: Session,
    scan_id: str,
    status: str,
    completed_at: Optional[datetime] = None
) -> Optional[Scan]:
    """
    Update the status of a scan.

    Args:
        db: Database session
        scan_id: Unique scan identifier
        status: New status (pending, running, completed, failed)
        completed_at: Completion timestamp (for completed/failed scans)

    Returns:
        Scan: Updated scan record, or None if not found
    """
    try:
        scan = db.query(Scan).filter(Scan.scan_id == scan_id).first()
        if not scan:
            logger.warning(f"Scan {scan_id} not found for status update")
            return None

        scan.status = status
        if completed_at:
            scan.completed_at = completed_at

        db.commit()
        db.refresh(scan)

        logger.info(f"Updated scan {scan_id} status to {status}")
        return scan

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update scan {scan_id} status: {e}")
        raise


# ============================================================================
# Scan Retrieval Functions
# ============================================================================

async def get_scan_by_id(
    db: Session,
    scan_id: str,
    include_findings: bool = False
) -> Optional[Scan]:
    """
    Retrieve a scan by its ID.

    Args:
        db: Database session
        scan_id: Unique scan identifier
        include_findings: Whether to include findings in the result

    Returns:
        Scan: The scan record, or None if not found
    """
    try:
        query = db.query(Scan).filter(
            and_(
                Scan.scan_id == scan_id,
                Scan.deleted_at.is_(None)
            )
        )

        scan = query.first()

        if scan and include_findings:
            # Eagerly load findings to avoid N+1 queries
            _ = scan.findings  # Access relationship to trigger load

        return scan

    except Exception as e:
        logger.error(f"Failed to retrieve scan {scan_id}: {e}")
        raise


async def list_scans(
    db: Session,
    api_base_url: Optional[str] = None,
    created_by: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    order_by: str = "created_at",
    order_direction: str = "desc"
) -> Tuple[List[Scan], int]:
    """
    List scans with filtering and pagination.

    Args:
        db: Database session
        api_base_url: Filter by API base URL
        created_by: Filter by user who created the scan
        status: Filter by scan status
        limit: Maximum number of results
        offset: Number of results to skip
        order_by: Field to order by (created_at, completed_at)
        order_direction: Order direction (asc, desc)

    Returns:
        Tuple[List[Scan], int]: List of scans and total count
    """
    try:
        # Build query with filters
        query = db.query(Scan).filter(Scan.deleted_at.is_(None))

        if api_base_url:
            query = query.filter(Scan.api_base_url == api_base_url)

        if created_by:
            query = query.filter(Scan.created_by == created_by)

        if status:
            query = query.filter(Scan.status == status)

        # Get total count before pagination
        total_count = query.count()

        # Apply ordering
        order_field = getattr(Scan, order_by, Scan.created_at)
        if order_direction == "desc":
            query = query.order_by(desc(order_field))
        else:
            query = query.order_by(order_field)

        # Apply pagination
        scans = query.limit(limit).offset(offset).all()

        return scans, total_count

    except Exception as e:
        logger.error(f"Failed to list scans: {e}")
        raise


async def get_scan_findings(
    db: Session,
    scan_id: str,
    severity: Optional[str] = None,
    rule: Optional[str] = None,
    endpoint: Optional[str] = None
) -> List[Finding]:
    """
    Retrieve findings for a specific scan with optional filtering.

    Args:
        db: Database session
        scan_id: Unique scan identifier
        severity: Filter by severity level
        rule: Filter by OWASP API rule
        endpoint: Filter by endpoint pattern

    Returns:
        List[Finding]: List of findings
    """
    try:
        # Get scan internal ID
        scan = await get_scan_by_id(db, scan_id)
        if not scan:
            logger.warning(f"Scan {scan_id} not found")
            return []

        # Build query with filters
        query = db.query(Finding).filter(Finding.scan_id == scan.id)

        if severity:
            query = query.filter(Finding.severity == severity)

        if rule:
            query = query.filter(Finding.rule == rule)

        if endpoint:
            query = query.filter(Finding.endpoint.like(f"%{endpoint}%"))

        findings = query.order_by(Finding.severity.desc(), Finding.score.desc()).all()

        return findings

    except Exception as e:
        logger.error(f"Failed to retrieve findings for scan {scan_id}: {e}")
        raise


# ============================================================================
# Scan Comparison Functions
# ============================================================================

async def compare_scans(
    db: Session,
    scan_id: str,
    previous_scan_id: str,
    cache_result: bool = True
) -> Dict[str, Any]:
    """
    Compare two scans to detect new, resolved, and regressed findings.

    Args:
        db: Database session
        scan_id: Current scan ID
        previous_scan_id: Previous scan ID to compare against
        cache_result: Whether to cache the comparison result

    Returns:
        Dict: Comparison results with counts and finding IDs
    """
    try:
        # Get both scans
        current_scan = await get_scan_by_id(db, scan_id)
        previous_scan = await get_scan_by_id(db, previous_scan_id)

        if not current_scan or not previous_scan:
            raise ValueError("One or both scans not found")

        # Get findings for both scans
        current_findings = await get_scan_findings(db, scan_id)
        previous_findings = await get_scan_findings(db, previous_scan_id)

        # Build fingerprint sets for comparison
        current_fingerprints = {f.fingerprint: f for f in current_findings}
        previous_fingerprints = {f.fingerprint: f for f in previous_findings}

        # Calculate differences
        new_fingerprints = set(current_fingerprints.keys()) - set(previous_fingerprints.keys())
        resolved_fingerprints = set(previous_fingerprints.keys()) - set(current_fingerprints.keys())
        unchanged_fingerprints = set(current_fingerprints.keys()) & set(previous_fingerprints.keys())

        # Detect regressions (same fingerprint but severity increased)
        regressed_fingerprints = set()
        severity_order = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1, "Info": 0}

        for fp in unchanged_fingerprints:
            current_severity = severity_order.get(current_fingerprints[fp].severity, 0)
            previous_severity = severity_order.get(previous_fingerprints[fp].severity, 0)
            if current_severity > previous_severity:
                regressed_fingerprints.add(fp)

        # Get finding IDs
        new_finding_ids = [current_fingerprints[fp].id for fp in new_fingerprints]
        resolved_finding_ids = [previous_fingerprints[fp].id for fp in resolved_fingerprints]
        regressed_finding_ids = [current_fingerprints[fp].id for fp in regressed_fingerprints]

        comparison_data = {
            "scan_id": scan_id,
            "previous_scan_id": previous_scan_id,
            "new_findings": len(new_finding_ids),
            "resolved_findings": len(resolved_finding_ids),
            "regressed_findings": len(regressed_finding_ids),
            "unchanged_findings": len(unchanged_fingerprints) - len(regressed_fingerprints),
            "new_finding_ids": [str(fid) for fid in new_finding_ids],
            "resolved_finding_ids": [str(fid) for fid in resolved_finding_ids],
            "regressed_finding_ids": [str(fid) for fid in regressed_finding_ids],
            "comparison_timestamp": datetime.utcnow().isoformat(),
        }

        # Cache comparison result
        if cache_result:
            try:
                comparison = ScanComparison(
                    id=uuid4(),
                    scan_id=current_scan.id,
                    previous_scan_id=previous_scan.id,
                    new_findings=len(new_finding_ids),
                    resolved_findings=len(resolved_finding_ids),
                    regressed_findings=len(regressed_finding_ids),
                    unchanged_findings=len(unchanged_fingerprints) - len(regressed_fingerprints),
                    new_finding_ids=new_finding_ids,
                    resolved_finding_ids=resolved_finding_ids,
                    regressed_finding_ids=regressed_finding_ids,
                    comparison_data=comparison_data,
                )
                db.add(comparison)
                db.commit()
            except IntegrityError:
                # Comparison already exists (unique constraint on scan_id + previous_scan_id)
                db.rollback()
                logger.info(f"Comparison {scan_id} vs {previous_scan_id} already cached")

        logger.info(f"Compared scans: {scan_id} vs {previous_scan_id} - "
                   f"{len(new_finding_ids)} new, {len(resolved_finding_ids)} resolved, "
                   f"{len(regressed_finding_ids)} regressed")

        return comparison_data

    except Exception as e:
        logger.error(f"Failed to compare scans {scan_id} vs {previous_scan_id}: {e}")
        raise


async def get_cached_comparison(
    db: Session,
    scan_id: str,
    previous_scan_id: str
) -> Optional[Dict[str, Any]]:
    """
    Retrieve a cached scan comparison.

    Args:
        db: Database session
        scan_id: Current scan ID
        previous_scan_id: Previous scan ID

    Returns:
        Dict: Cached comparison data, or None if not found
    """
    try:
        # Get scan internal IDs
        current_scan = await get_scan_by_id(db, scan_id)
        previous_scan = await get_scan_by_id(db, previous_scan_id)

        if not current_scan or not previous_scan:
            return None

        comparison = db.query(ScanComparison).filter(
            and_(
                ScanComparison.scan_id == current_scan.id,
                ScanComparison.previous_scan_id == previous_scan.id
            )
        ).first()

        if comparison:
            return comparison.to_dict()

        return None

    except Exception as e:
        logger.error(f"Failed to retrieve cached comparison: {e}")
        raise


# ============================================================================
# Trend Analysis Functions
# ============================================================================

async def calculate_trends(
    db: Session,
    api_base_url: str,
    days: int = 30,
    created_by: Optional[str] = None
) -> Dict[str, Any]:
    """
    Calculate security trends over time for a specific API.

    Args:
        db: Database session
        api_base_url: API base URL to analyze
        days: Number of days to analyze (default: 30)
        created_by: Filter by user who created scans

    Returns:
        Dict: Trend data with daily/weekly aggregations
    """
    try:
        # Get scans within date range
        start_date = datetime.utcnow() - timedelta(days=days)

        query = db.query(Scan).filter(
            and_(
                Scan.api_base_url == api_base_url,
                Scan.created_at >= start_date,
                Scan.status == "completed",
                Scan.deleted_at.is_(None)
            )
        )

        if created_by:
            query = query.filter(Scan.created_by == created_by)

        scans = query.order_by(Scan.created_at.asc()).all()

        if not scans:
            logger.warning(f"No scans found for {api_base_url} in last {days} days")
            return {
                "api_base_url": api_base_url,
                "days": days,
                "total_scans": 0,
                "daily_data": [],
                "summary": {
                    "avg_findings": 0,
                    "avg_critical": 0,
                    "avg_high": 0,
                    "trend_direction": "stable",
                },
            }

        # Aggregate by day
        daily_data = defaultdict(lambda: {
            "scan_count": 0,
            "total_findings": 0,
            "critical_count": 0,
            "high_count": 0,
            "medium_count": 0,
            "low_count": 0,
        })

        for scan in scans:
            date_key = scan.created_at.date().isoformat()
            daily_data[date_key]["scan_count"] += 1
            daily_data[date_key]["total_findings"] += scan.total_findings
            daily_data[date_key]["critical_count"] += scan.critical_count
            daily_data[date_key]["high_count"] += scan.high_count
            daily_data[date_key]["medium_count"] += scan.medium_count
            daily_data[date_key]["low_count"] += scan.low_count

        # Calculate averages
        avg_findings = sum(s.total_findings for s in scans) / len(scans)
        avg_critical = sum(s.critical_count for s in scans) / len(scans)
        avg_high = sum(s.high_count for s in scans) / len(scans)

        # Detect trend direction (simple linear regression)
        # Compare first half vs second half of period
        midpoint = len(scans) // 2
        first_half_avg = sum(s.total_findings for s in scans[:midpoint]) / max(1, midpoint)
        second_half_avg = sum(s.total_findings for s in scans[midpoint:]) / max(1, len(scans) - midpoint)

        if second_half_avg < first_half_avg * 0.9:
            trend_direction = "improving"
        elif second_half_avg > first_half_avg * 1.1:
            trend_direction = "worsening"
        else:
            trend_direction = "stable"

        return {
            "api_base_url": api_base_url,
            "days": days,
            "total_scans": len(scans),
            "daily_data": [
                {"date": date, **data}
                for date, data in sorted(daily_data.items())
            ],
            "summary": {
                "avg_findings": round(avg_findings, 2),
                "avg_critical": round(avg_critical, 2),
                "avg_high": round(avg_high, 2),
                "trend_direction": trend_direction,
                "first_scan_date": scans[0].created_at.isoformat(),
                "last_scan_date": scans[-1].created_at.isoformat(),
            },
        }

    except Exception as e:
        logger.error(f"Failed to calculate trends for {api_base_url}: {e}")
        raise


async def get_latest_scan_for_api(
    db: Session,
    api_base_url: str,
    created_by: Optional[str] = None
) -> Optional[Scan]:
    """
    Get the most recent completed scan for an API.

    Args:
        db: Database session
        api_base_url: API base URL
        created_by: Filter by user who created the scan

    Returns:
        Scan: The most recent scan, or None if not found
    """
    try:
        query = db.query(Scan).filter(
            and_(
                Scan.api_base_url == api_base_url,
                Scan.status == "completed",
                Scan.deleted_at.is_(None)
            )
        )

        if created_by:
            query = query.filter(Scan.created_by == created_by)

        scan = query.order_by(desc(Scan.completed_at)).first()

        return scan

    except Exception as e:
        logger.error(f"Failed to get latest scan for {api_base_url}: {e}")
        raise


# ============================================================================
# Soft Delete Function
# ============================================================================

async def soft_delete_scan(
    db: Session,
    scan_id: str
) -> bool:
    """
    Soft delete a scan (mark as deleted without removing from database).

    Args:
        db: Database session
        scan_id: Unique scan identifier

    Returns:
        bool: True if scan was deleted, False if not found
    """
    try:
        scan = await get_scan_by_id(db, scan_id)
        if not scan:
            logger.warning(f"Scan {scan_id} not found for deletion")
            return False

        scan.deleted_at = datetime.utcnow()
        db.commit()

        logger.info(f"Soft deleted scan {scan_id}")
        return True

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete scan {scan_id}: {e}")
        raise
