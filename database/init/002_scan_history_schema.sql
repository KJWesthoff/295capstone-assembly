-- Week 2: Scan History Schema
-- PostgreSQL 16+ required
-- Database: ventiapi
--
-- This migration creates tables to store historical scan results,
-- enabling trend analysis, regression detection, and scan comparison.
--
-- IMPORTANT: This script runs against the 'ventiapi' database
-- Make sure to connect with: \c ventiapi

-- Connect to ventiapi database
\c ventiapi

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Table: scans
-- Stores metadata about each security scan
-- ============================================================================

CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id TEXT UNIQUE NOT NULL,
    api_base_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- User tracking (simple for Week 2, enhanced in Week 4 RBAC)
    created_by TEXT,  -- User email or identifier

    -- Scan status
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),

    -- Summary counts (denormalized for performance)
    total_findings INTEGER DEFAULT 0,
    critical_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    medium_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,

    -- Scanner configuration
    scanner_engines TEXT[],  -- ['ventiapi', 'zap', 'nuclei']
    dangerous_mode BOOLEAN DEFAULT false,
    fuzz_auth BOOLEAN DEFAULT false,
    max_requests INTEGER,

    -- Additional metadata
    openapi_spec_path TEXT,
    openapi_spec_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Soft delete support
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_counts CHECK (
        total_findings >= 0 AND
        critical_count >= 0 AND
        high_count >= 0 AND
        medium_count >= 0 AND
        low_count >= 0
    )
);

-- ============================================================================
-- Table: findings
-- Stores individual vulnerability findings from scans
-- ============================================================================

CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Vulnerability identification
    rule TEXT NOT NULL,  -- 'API1', 'API2', etc.
    title TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low', 'Info')),
    score NUMERIC(4, 2),  -- CVSS-like score (0.00 - 10.00)

    -- Affected resource
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,  -- GET, POST, PUT, DELETE, etc.

    -- Vulnerability details
    description TEXT,
    evidence JSONB DEFAULT '{}'::jsonb,

    -- Scanner attribution
    scanner TEXT NOT NULL,  -- 'ventiapi', 'zap', 'nuclei'
    scanner_description TEXT,

    -- CWE/CVE mappings (for future enrichment)
    cwe_ids TEXT[],
    cve_ids TEXT[],

    -- Fingerprint for deduplication across scans
    -- Format: hash(rule + endpoint + method)
    fingerprint TEXT NOT NULL,

    -- Additional metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT valid_score CHECK (score IS NULL OR (score >= 0 AND score <= 10))
);

-- ============================================================================
-- Table: scan_comparisons
-- Caches comparison results between scans for performance
-- ============================================================================

CREATE TABLE IF NOT EXISTS scan_comparisons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    previous_scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Comparison results
    new_findings INTEGER DEFAULT 0,
    resolved_findings INTEGER DEFAULT 0,
    regressed_findings INTEGER DEFAULT 0,
    unchanged_findings INTEGER DEFAULT 0,

    -- New finding IDs
    new_finding_ids UUID[],
    resolved_finding_ids UUID[],
    regressed_finding_ids UUID[],

    -- Cache for quick retrieval
    comparison_data JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT different_scans CHECK (scan_id != previous_scan_id),
    CONSTRAINT valid_comparison_counts CHECK (
        new_findings >= 0 AND
        resolved_findings >= 0 AND
        regressed_findings >= 0 AND
        unchanged_findings >= 0
    )
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Scans table indexes
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_api_base_url ON scans(api_base_url);
CREATE INDEX IF NOT EXISTS idx_scans_created_by ON scans(created_by);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_completed_at ON scans(completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scans_deleted_at ON scans(deleted_at) WHERE deleted_at IS NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scans_api_created ON scans(api_base_url, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_user_created ON scans(created_by, created_at DESC);

-- Findings table indexes
CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_findings_rule ON findings(rule);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_endpoint ON findings(endpoint);
CREATE INDEX IF NOT EXISTS idx_findings_fingerprint ON findings(fingerprint);

-- Composite index for deduplication
CREATE INDEX IF NOT EXISTS idx_findings_scan_fingerprint ON findings(scan_id, fingerprint);

-- GIN indexes for JSONB columns (for advanced queries)
CREATE INDEX IF NOT EXISTS idx_scans_metadata_gin ON scans USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_findings_evidence_gin ON findings USING gin(evidence);

-- Scan comparisons indexes
CREATE INDEX IF NOT EXISTS idx_comparisons_scan_id ON scan_comparisons(scan_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_previous_scan_id ON scan_comparisons(previous_scan_id);

-- Unique constraint for scan comparison pairs
CREATE UNIQUE INDEX IF NOT EXISTS idx_comparisons_unique_pair
    ON scan_comparisons(scan_id, previous_scan_id);

-- ============================================================================
-- Functions for Automatic Timestamp Updates
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for scans table
DROP TRIGGER IF EXISTS update_scans_updated_at ON scans;
CREATE TRIGGER update_scans_updated_at
    BEFORE UPDATE ON scans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Functions for Fingerprint Generation
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_finding_fingerprint(
    p_rule TEXT,
    p_endpoint TEXT,
    p_method TEXT
)
RETURNS TEXT AS $$
BEGIN
    -- Generate a consistent fingerprint for deduplication
    -- Format: MD5(rule + endpoint + method)
    RETURN md5(CONCAT(p_rule, ':', p_endpoint, ':', p_method));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Helper Views
-- ============================================================================

-- View: Recent scans with summary statistics
CREATE OR REPLACE VIEW recent_scans AS
SELECT
    s.id,
    s.scan_id,
    s.api_base_url,
    s.created_at,
    s.completed_at,
    s.created_by,
    s.status,
    s.total_findings,
    s.critical_count,
    s.high_count,
    s.medium_count,
    s.low_count,
    s.scanner_engines,
    EXTRACT(EPOCH FROM (s.completed_at - s.created_at)) AS duration_seconds,
    COUNT(DISTINCT f.rule) AS unique_vulnerability_types,
    COUNT(DISTINCT f.endpoint) AS affected_endpoints
FROM scans s
LEFT JOIN findings f ON f.scan_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.scan_id, s.api_base_url, s.created_at, s.completed_at,
         s.created_by, s.status, s.total_findings, s.critical_count,
         s.high_count, s.medium_count, s.low_count, s.scanner_engines
ORDER BY s.created_at DESC;

-- View: Findings with scan context
CREATE OR REPLACE VIEW findings_with_scan_context AS
SELECT
    f.id,
    f.scan_id,
    s.scan_id AS scan_identifier,
    s.api_base_url,
    s.created_at AS scan_date,
    s.created_by,
    f.rule,
    f.title,
    f.severity,
    f.score,
    f.endpoint,
    f.method,
    f.description,
    f.scanner,
    f.fingerprint,
    f.evidence,
    f.cwe_ids,
    f.cve_ids
FROM findings f
JOIN scans s ON s.id = f.scan_id
WHERE s.deleted_at IS NULL
ORDER BY s.created_at DESC, f.severity DESC;

-- Grant permissions to rag_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rag_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rag_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO rag_user;

-- ============================================================================
-- Sample Queries (Commented - For Reference)
-- ============================================================================

-- List recent scans for a specific API
-- SELECT * FROM recent_scans
-- WHERE api_base_url = 'http://localhost:5002'
-- LIMIT 10;

-- Get all findings for a specific scan
-- SELECT * FROM findings_with_scan_context
-- WHERE scan_identifier = 'abc-123-def-456';

-- Calculate trend over last 30 days
-- SELECT
--     DATE(created_at) AS date,
--     COUNT(*) AS scan_count,
--     AVG(total_findings) AS avg_findings,
--     AVG(critical_count) AS avg_critical
-- FROM scans
-- WHERE created_at >= NOW() - INTERVAL '30 days'
--   AND status = 'completed'
-- GROUP BY DATE(created_at)
-- ORDER BY date DESC;

-- ============================================================================
-- End of Migration
-- ============================================================================
