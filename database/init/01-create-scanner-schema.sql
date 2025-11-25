-- Scanner Service Database Schema
-- This schema stores scan results, findings, and scanner metadata

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Scans table: stores scan metadata and status
CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    server_url VARCHAR(2048) NOT NULL,
    spec_url VARCHAR(2048),
    scanners TEXT[] NOT NULL DEFAULT ARRAY['ventiapi'],
    dangerous BOOLEAN DEFAULT FALSE,
    fuzz_auth BOOLEAN DEFAULT FALSE,
    rps FLOAT DEFAULT 1.0,
    max_requests INTEGER DEFAULT 100,
    progress INTEGER DEFAULT 0,
    current_probe VARCHAR(255),
    current_phase VARCHAR(255),
    findings_count INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    completed_chunks INTEGER DEFAULT 0,
    parallel_mode BOOLEAN DEFAULT FALSE,
    error TEXT,
    user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Create index for scan_id lookups
CREATE INDEX IF NOT EXISTS idx_scans_scan_id ON scans(scan_id);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);

-- Findings table: stores vulnerability findings from scans
CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id VARCHAR(255) NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
    scanner VARCHAR(50) NOT NULL,
    scanner_description VARCHAR(255),
    rule VARCHAR(255) NOT NULL,
    title VARCHAR(512) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low', 'Informational')),
    score INTEGER NOT NULL,
    endpoint VARCHAR(2048) NOT NULL,
    method VARCHAR(10) NOT NULL,
    description TEXT,
    evidence JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for findings queries
CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_scanner ON findings(scanner);
CREATE INDEX IF NOT EXISTS idx_findings_endpoint ON findings(endpoint);

-- Chunk status table: stores progress of parallel scanner containers
CREATE TABLE IF NOT EXISTS chunk_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id VARCHAR(255) NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
    chunk_id INTEGER NOT NULL,
    scanner VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('preparing', 'starting', 'running', 'completed', 'failed')),
    endpoints_count INTEGER DEFAULT 0,
    total_endpoints INTEGER DEFAULT 0,
    endpoints TEXT[],
    scanned_endpoints TEXT[],
    current_endpoint VARCHAR(2048),
    progress INTEGER DEFAULT 0,
    scan_type VARCHAR(50),
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(scan_id, chunk_id)
);

-- Create index for chunk status lookups
CREATE INDEX IF NOT EXISTS idx_chunk_status_scan_id ON chunk_status(scan_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at on scans table
CREATE TRIGGER update_scans_updated_at BEFORE UPDATE ON scans
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at on chunk_status table
CREATE TRIGGER update_chunk_status_updated_at BEFORE UPDATE ON chunk_status
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for scan summary with findings count by severity
CREATE OR REPLACE VIEW scan_summary AS
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
GROUP BY s.scan_id, s.status, s.server_url, s.scanners, s.progress, s.created_at, s.completed_at;
