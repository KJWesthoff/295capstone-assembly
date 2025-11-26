"""
SQLAlchemy models for VentiAPI scan history.

These models map to the PostgreSQL schema defined in
database/init/002_scan_history_schema.sql

Week 2: Scan History & Trending
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    Column, String, Integer, Boolean, TIMESTAMP, ForeignKey, ARRAY,
    CheckConstraint, Text, DECIMAL, Index
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database_orm import Base, generate_fingerprint


# ============================================================================
# Model: Scan
# ============================================================================

class Scan(Base):
    """
    Represents a security scan of an API.

    Stores metadata about scan configuration, status, and summary statistics.
    """
    __tablename__ = "scans"

    # Primary key
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    scan_id = Column(String, unique=True, nullable=False, index=True)

    # Scan target
    api_base_url = Column(String, nullable=False, index=True)

    # Timestamps
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # User tracking
    created_by = Column(String, nullable=True, index=True)

    # Scan status
    status = Column(
        String,
        nullable=False,
        default='pending',
        index=True
    )

    # Summary counts (denormalized for performance)
    total_findings = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    high_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)
    low_count = Column(Integer, default=0)

    # Scanner configuration
    scanner_engines = Column(ARRAY(String), nullable=True)
    dangerous_mode = Column(Boolean, default=False)
    fuzz_auth = Column(Boolean, default=False)
    max_requests = Column(Integer, nullable=True)

    # Additional metadata
    openapi_spec_path = Column(String, nullable=True)
    openapi_spec_url = Column(String, nullable=True)
    metadata = Column(JSONB, default={})

    # Soft delete
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # Relationships
    findings = relationship("Finding", back_populates="scan", cascade="all, delete-orphan")
    comparisons_as_current = relationship(
        "ScanComparison",
        foreign_keys="ScanComparison.scan_id",
        back_populates="scan"
    )
    comparisons_as_previous = relationship(
        "ScanComparison",
        foreign_keys="ScanComparison.previous_scan_id",
        back_populates="previous_scan"
    )

    # Table constraints
    __table_args__ = (
        CheckConstraint('total_findings >= 0', name='valid_total_findings'),
        CheckConstraint('critical_count >= 0', name='valid_critical_count'),
        CheckConstraint('high_count >= 0', name='valid_high_count'),
        CheckConstraint('medium_count >= 0', name='valid_medium_count'),
        CheckConstraint('low_count >= 0', name='valid_low_count'),
        CheckConstraint(
            "status IN ('pending', 'running', 'completed', 'failed')",
            name='valid_status'
        ),
        Index('idx_scans_api_created', 'api_base_url', 'created_at'),
        Index('idx_scans_user_created', 'created_by', 'created_at'),
    )

    def __repr__(self):
        return f"<Scan(id={self.id}, scan_id={self.scan_id}, status={self.status})>"

    def to_dict(self) -> dict:
        """Convert scan to dictionary for API responses."""
        return {
            "id": str(self.id),
            "scan_id": self.scan_id,
            "api_base_url": self.api_base_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_by": self.created_by,
            "status": self.status,
            "total_findings": self.total_findings,
            "critical_count": self.critical_count,
            "high_count": self.high_count,
            "medium_count": self.medium_count,
            "low_count": self.low_count,
            "scanner_engines": self.scanner_engines,
            "dangerous_mode": self.dangerous_mode,
            "fuzz_auth": self.fuzz_auth,
            "max_requests": self.max_requests,
            "openapi_spec_path": self.openapi_spec_path,
            "openapi_spec_url": self.openapi_spec_url,
            "metadata": self.metadata,
        }


# ============================================================================
# Model: Finding
# ============================================================================

class Finding(Base):
    """
    Represents a security vulnerability finding from a scan.

    Stores detailed information about each discovered vulnerability.
    """
    __tablename__ = "findings"

    # Primary key
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    scan_id = Column(PG_UUID(as_uuid=True), ForeignKey('scans.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Vulnerability identification
    rule = Column(String, nullable=False, index=True)  # 'API1', 'API2', etc.
    title = Column(String, nullable=False)
    severity = Column(String, nullable=False, index=True)
    score = Column(DECIMAL(4, 2), nullable=True)  # 0.00 - 10.00

    # Affected resource
    endpoint = Column(String, nullable=False, index=True)
    method = Column(String, nullable=False)

    # Vulnerability details
    description = Column(Text, nullable=True)
    evidence = Column(JSONB, default={})

    # Scanner attribution
    scanner = Column(String, nullable=False)
    scanner_description = Column(Text, nullable=True)

    # CWE/CVE mappings
    cwe_ids = Column(ARRAY(String), nullable=True)
    cve_ids = Column(ARRAY(String), nullable=True)

    # Fingerprint for deduplication
    fingerprint = Column(String, nullable=False, index=True)

    # Additional metadata
    metadata = Column(JSONB, default={})

    # Relationships
    scan = relationship("Scan", back_populates="findings")

    # Table constraints
    __table_args__ = (
        CheckConstraint(
            "severity IN ('Critical', 'High', 'Medium', 'Low', 'Info')",
            name='valid_severity'
        ),
        CheckConstraint(
            "score IS NULL OR (score >= 0 AND score <= 10)",
            name='valid_score'
        ),
        Index('idx_findings_scan_fingerprint', 'scan_id', 'fingerprint'),
    )

    def __repr__(self):
        return f"<Finding(id={self.id}, rule={self.rule}, endpoint={self.endpoint})>"

    def to_dict(self) -> dict:
        """Convert finding to dictionary for API responses."""
        return {
            "id": str(self.id),
            "scan_id": str(self.scan_id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "rule": self.rule,
            "title": self.title,
            "severity": self.severity,
            "score": float(self.score) if self.score else None,
            "endpoint": self.endpoint,
            "method": self.method,
            "description": self.description,
            "evidence": self.evidence,
            "scanner": self.scanner,
            "scanner_description": self.scanner_description,
            "cwe_ids": self.cwe_ids,
            "cve_ids": self.cve_ids,
            "fingerprint": self.fingerprint,
            "metadata": self.metadata,
        }

    @staticmethod
    def calculate_fingerprint(rule: str, endpoint: str, method: str) -> str:
        """
        Calculate fingerprint for this finding.

        Args:
            rule: OWASP API rule
            endpoint: API endpoint
            method: HTTP method

        Returns:
            str: Fingerprint hash
        """
        return generate_fingerprint(rule, endpoint, method)


# ============================================================================
# Model: ScanComparison
# ============================================================================

class ScanComparison(Base):
    """
    Represents a comparison between two scans.

    Caches comparison results for performance (new/resolved/regressed findings).
    """
    __tablename__ = "scan_comparisons"

    # Primary key
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    scan_id = Column(PG_UUID(as_uuid=True), ForeignKey('scans.id', ondelete='CASCADE'), nullable=False)
    previous_scan_id = Column(PG_UUID(as_uuid=True), ForeignKey('scans.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Comparison results
    new_findings = Column(Integer, default=0)
    resolved_findings = Column(Integer, default=0)
    regressed_findings = Column(Integer, default=0)
    unchanged_findings = Column(Integer, default=0)

    # Finding IDs
    new_finding_ids = Column(ARRAY(PG_UUID(as_uuid=True)), default=[])
    resolved_finding_ids = Column(ARRAY(PG_UUID(as_uuid=True)), default=[])
    regressed_finding_ids = Column(ARRAY(PG_UUID(as_uuid=True)), default=[])

    # Cache
    comparison_data = Column(JSONB, default={})

    # Relationships
    scan = relationship("Scan", foreign_keys=[scan_id], back_populates="comparisons_as_current")
    previous_scan = relationship("Scan", foreign_keys=[previous_scan_id], back_populates="comparisons_as_previous")

    # Table constraints
    __table_args__ = (
        CheckConstraint('scan_id != previous_scan_id', name='different_scans'),
        CheckConstraint('new_findings >= 0', name='valid_new_findings'),
        CheckConstraint('resolved_findings >= 0', name='valid_resolved_findings'),
        CheckConstraint('regressed_findings >= 0', name='valid_regressed_findings'),
        CheckConstraint('unchanged_findings >= 0', name='valid_unchanged_findings'),
        Index('idx_comparisons_unique_pair', 'scan_id', 'previous_scan_id', unique=True),
    )

    def __repr__(self):
        return f"<ScanComparison(scan_id={self.scan_id}, previous_scan_id={self.previous_scan_id})>"

    def to_dict(self) -> dict:
        """Convert comparison to dictionary for API responses."""
        return {
            "id": str(self.id),
            "scan_id": str(self.scan_id),
            "previous_scan_id": str(self.previous_scan_id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "new_findings": self.new_findings,
            "resolved_findings": self.resolved_findings,
            "regressed_findings": self.regressed_findings,
            "unchanged_findings": self.unchanged_findings,
            "new_finding_ids": [str(fid) for fid in self.new_finding_ids] if self.new_finding_ids else [],
            "resolved_finding_ids": [str(fid) for fid in self.resolved_finding_ids] if self.resolved_finding_ids else [],
            "regressed_finding_ids": [str(fid) for fid in self.regressed_finding_ids] if self.regressed_finding_ids else [],
            "comparison_data": self.comparison_data,
        }
