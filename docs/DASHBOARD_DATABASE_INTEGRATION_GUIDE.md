# Dashboard Database Integration Guide

## Executive Summary

This document provides a complete knowledge transfer for replacing mock data with real database-backed scan results across all three dashboards (Developer, Security Analyst, and Executive).

---

## Table of Contents

1. [Changes Made to Developer Dashboard](#changes-made-to-developer-dashboard)
2. [Current State of Other Dashboards](#current-state-of-other-dashboards)
3. [Database Integration Patterns](#database-integration-patterns)
4. [EC2 Deployment Workflow](#ec2-deployment-workflow)
5. [Docker Management (Preserving PostgreSQL)](#docker-management-preserving-postgresql)
6. [Agent Prompt for Completing Dashboard Updates](#agent-prompt-for-completing-dashboard-updates)

---

## Changes Made to Developer Dashboard

### Overview
The Developer Dashboard (`cedar-mastra/src/components/developer/DeveloperView.tsx`) was successfully migrated from mock data to real-time database-backed scan results.

### Key Changes Enumerated

#### 1. **Added Scan Selector UI** (Lines 118-137)
```typescript
{scans.length > 0 && (
  <div className="bg-card border border-border rounded-lg p-4">
    <label htmlFor="scan-select" className="block text-sm font-medium text-foreground mb-2">
      Select Scan
    </label>
    <select
      id="scan-select"
      value={selectedScanId || ''}
      onChange={(e) => setSelectedScanId(e.target.value)}
      className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
    >
      {scans.map((scan) => (
        <option key={scan.scan_id} value={scan.scan_id}>
          {new Date(scan.created_at).toLocaleString()} - {scan.server_url} ({scan.status}) - {scan.findings_count} findings
        </option>
      ))}
    </select>
  </div>
)}
```

**Purpose**: Allows users to select which scan's findings to view from the database.

#### 2. **Added State Management** (Lines 20-23)
```typescript
const [scans, setScans] = useState<any[]>([]);
const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
const [scanFindings, setScanFindings] = useState<any[]>([]);
const [isLoading, setIsLoading] = useState(true);
```

**Purpose**: Manages scan list, selected scan, findings data, and loading state.

#### 3. **Added Scan List Fetching** (Lines 26-45)
```typescript
useEffect(() => {
  const fetchScans = async () => {
    try {
      const response = await scannerApi.listScans(10, 0);
      setScans(response.scans);

      // Auto-select the most recent completed scan
      const mostRecent = response.scans.find(s => s.status === 'completed');
      if (mostRecent) {
        setSelectedScanId(mostRecent.scan_id);
      }
    } catch (error) {
      console.error('Error fetching scans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  fetchScans();
}, []);
```

**Purpose**: Fetches recent scans on component mount and auto-selects most recent completed scan.

#### 4. **Added Findings Fetching** (Lines 48-62)
```typescript
useEffect(() => {
  if (!selectedScanId) return;

  const fetchFindings = async () => {
    try {
      const response = await scannerApi.getFindings(selectedScanId);
      setScanFindings(response.findings || []);
    } catch (error) {
      console.error('Error fetching findings:', error);
      setScanFindings([]);
    }
  };

  fetchFindings();
}, [selectedScanId]);
```

**Purpose**: Fetches findings whenever the selected scan changes.

#### 5. **Added Data Transformation** (Lines 64-106)
```typescript
const actualFindings: Finding[] = useMemo(() => {
  if (!scanFindings || scanFindings.length === 0) return [];

  return scanFindings.map((f: any) => ({
    id: f.id || `${f.endpoint}-${f.rule}`,
    title: f.title,
    severity: f.severity as 'Critical' | 'High' | 'Medium' | 'Low',
    endpoint: {
      method: f.method || 'GET',
      path: f.endpoint || '/',
      service: f.scanner || 'unknown',
    },
    description: f.description,
    recommendation: f.recommendation || 'No recommendation available',
    impact: f.impact || f.description,
    scanner: f.scanner || 'unknown',
    evidence: f.evidence || {},
    // Add default values for missing fields
    cvss: f.score || 0,
    exploitSignal: 0,
    exploitPresent: false,
    owasp: f.rule || '',
    cwe: [],
    cve: [],
    scanners: [f.scanner || 'unknown'],
    status: 'New' as const,
    evidenceId: f.id || '',
    exposure: 0,
    recencyTrend: 0,
    blastRadius: 0,
    priorityScore: 0,
    firstSeen: f.created_at || new Date().toISOString(),
    lastSeen: f.created_at || new Date().toISOString(),
    owner: '',
    slaDue: '',
    flags: {
      isNew: true,
      isRegressed: false,
      isResolved: false,
    },
  }));
}, [scanFindings]);
```

**Purpose**: Transforms raw database findings into the `Finding` TypeScript interface expected by the UI components.

**Key Mapping**:
- Database `score` → Frontend `cvss`
- Database `rule` → Frontend `owasp`
- Database flat `endpoint` + `method` → Frontend nested `endpoint: {method, path, service}`
- Database `scanner` → Frontend `endpoint.service`
- Adds default values for optional developer-workflow fields

#### 6. **Fixed Table Display** (DeveloperFindingsTable.tsx Line 412)
**Before**:
```typescript
{finding.endpoint.service} · {finding.repo || "N/A"}
```

**After**:
```typescript
{finding.title || finding.owasp || "No Title"}
```

**Purpose**: Display the actual finding title (e.g., "Broken Authentication") instead of the non-existent `repo` field.

### Files Modified

1. **`cedar-mastra/src/components/developer/DeveloperView.tsx`**
   - Added scan selection state management
   - Added API integration for fetching scans and findings
   - Added data transformation logic
   - Replaced mock data imports with database queries

2. **`cedar-mastra/src/components/developer/DeveloperFindingsTable.tsx`**
   - Fixed title display to show `finding.title` instead of `finding.repo`

3. **`cedar-mastra/src/hooks/useScanResultsPolling.ts`** (Created)
   - Polling hook for real-time scan status updates
   - Handles scan completion and failure callbacks
   - Auto-fetches findings when scan completes

---

## Current State of Other Dashboards

### Security Analyst Dashboard

**Current State**: ✅ **ALREADY USING REAL DATA**

**File**: `cedar-mastra/src/components/analyst/SecurityAnalystView.tsx`

**Implementation** (Lines 24-31):
```typescript
// Get actual scan results from Cedar state
const { scanResults } = useScanResultsState();

// Transform scanner results to Finding type for display
// If no scan results, show empty array (no mock data)
const actualFindings: Finding[] = scanResults?.findings
  ? transformVulnerabilityFindings(scanResults.findings)
  : [];
```

**Key Observations**:
- Uses `useScanResultsState()` hook to get scan results from Cedar state
- Uses `transformVulnerabilityFindings()` helper to transform data
- Shows empty array when no scans available (no mock data fallback)
- **No changes needed for this dashboard**

### Executive Dashboard

**Current State**: ❌ **STILL USING MOCK DATA**

**File**: `cedar-mastra/src/components/executive/ExecutiveView.tsx`

**Mock Data Usage** (Lines 18-23):
```typescript
import {
  mockExecSummary,
  mockExecTrend,
  mockExecTopRisks,
  mockExecCompliance,
  mockExecSlaOwners,
} from "@/data/mockExecutiveData";
```

**Mock Data References** (Lines 29-36):
```typescript
const { risks, owners } = useRegisterExecutiveData(mockExecTopRisks, mockExecSlaOwners);

const { addCardToReport, setReportMeta, reportItems, reportMeta } = useExecutiveReportBridge({
  kpis: mockExecSummary,
  topRiskCards: risks,
  complianceSnapshot: mockExecCompliance,
  ownershipRows: owners
});
```

**Components Using Mock Data**:
1. `ExecutiveKPICards` - summary (Line 51)
2. `ExecutiveTrendChart` - trend data (Lines 55, 58)
3. `ExecutiveTopRisks` - risks (Line 64)
4. `ExecutiveComplianceSnapshot` - compliance (Line 67)
5. `ExecutiveOwnershipTable` - owners (Line 71)

**Required Changes**: Replace all 5 mock data sources with database-backed data

---

## Database Integration Patterns

### Database Schema

**Scans Table**:
```sql
CREATE TABLE scans (
  scan_id VARCHAR PRIMARY KEY,
  status VARCHAR,
  progress INT,
  current_phase VARCHAR,
  current_probe VARCHAR,
  findings_count INT,
  server_url VARCHAR,
  spec_url VARCHAR,
  scanners VARCHAR[],
  dangerous BOOLEAN,
  fuzz_auth BOOLEAN,
  rps FLOAT,
  max_requests INT,
  user_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Findings Table**:
```sql
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id VARCHAR REFERENCES scans(scan_id),
  scanner VARCHAR,
  scanner_description VARCHAR,
  rule VARCHAR,  -- OWASP API category (e.g., "API2")
  title VARCHAR,
  severity VARCHAR,
  score FLOAT,  -- Maps to CVSS in frontend
  endpoint VARCHAR,
  method VARCHAR,
  description TEXT,
  evidence JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Available API Endpoints

**Backend API** (`scanner-service/web-api/main.py`):

1. **`GET /api/scans`** - List scans
   ```python
   # Returns recent scans with pagination
   params: limit (int), offset (int)
   returns: {scans: [...], total: int}
   ```

2. **`GET /api/scan/{scan_id}/status`** - Get scan status
   ```python
   returns: {
     scan_id: str,
     status: str,  # "pending" | "running" | "completed" | "failed"
     progress: int,  # 0-100
     findings_count: int,
     ...
   }
   ```

3. **`GET /api/scan/{scan_id}/findings`** - Get scan findings
   ```python
   params: offset (int), limit (int), severity (str)
   returns: {
     scan_id: str,
     total: int,
     findings: [
       {
         id: str,
         scanner: str,
         title: str,
         severity: str,
         score: float,
         endpoint: str,
         method: str,
         description: str,
         evidence: dict,
         ...
       }
     ]
   }
   ```

### Frontend API Client

**File**: `cedar-mastra/src/lib/scannerApi.ts`

**Usage**:
```typescript
import { scannerApi } from '@/lib/scannerApi';

// List scans
const { scans, total } = await scannerApi.listScans(limit, offset);

// Get scan status
const status = await scannerApi.getScanStatus(scanId);

// Get findings
const { findings, total } = await scannerApi.getFindings(scanId);
```

**Authentication**: Automatically handled via `ensureScannerAuth()` - stores JWT token in localStorage

### Data Transformation Pattern

**Database → Frontend Mapping**:
```typescript
// Database finding structure:
{
  id: string,
  scanner: string,
  rule: string,        // e.g., "API2"
  title: string,
  severity: string,
  score: float,        // CVSS score
  endpoint: string,
  method: string,
  description: string,
  evidence: object,
  created_at: timestamp
}

// Frontend Finding interface:
{
  id: string,
  title: string,
  severity: "Critical" | "High" | "Medium" | "Low",
  cvss: number,        // from database 'score'
  owasp: string,       // from database 'rule'
  endpoint: {
    method: string,
    path: string,      // from database 'endpoint'
    service: string,   // from database 'scanner'
  },
  description: string,
  scanner: string,
  evidence: object,
  // ... other fields with defaults
}
```

---

## EC2 Deployment Workflow

### Server Information
- **IP**: `52.9.231.2`
- **User**: `ec2-user`
- **Key**: `~/.ssh/ventiapi-key.pem`
- **Project Directory**: `/opt/ventiapi`
- **AWS Profile**: `ventiapi`

### Standard Deployment Steps

#### 1. Copy Modified Files to EC2

```bash
# Single file
AWS_PROFILE=ventiapi scp -i ~/.ssh/ventiapi-key.pem \
  cedar-mastra/src/components/developer/DeveloperView.tsx \
  ec2-user@52.9.231.2:/opt/ventiapi/cedar-mastra/src/components/developer/DeveloperView.tsx

# Multiple files (example)
AWS_PROFILE=ventiapi scp -i ~/.ssh/ventiapi-key.pem \
  cedar-mastra/src/components/developer/DeveloperView.tsx \
  cedar-mastra/src/components/developer/DeveloperFindingsTable.tsx \
  ec2-user@52.9.231.2:/opt/ventiapi/cedar-mastra/src/components/developer/
```

#### 2. SSH into Server

```bash
AWS_PROFILE=ventiapi ssh -i ~/.ssh/ventiapi-key.pem ec2-user@52.9.231.2
cd /opt/ventiapi
```

#### 3. Rebuild and Restart Service

```bash
# For frontend changes (Next.js)
docker-compose build cedar-frontend && docker-compose up -d cedar-frontend

# For backend changes (FastAPI)
docker-compose build web-api && docker-compose up -d web-api

# For both
docker-compose build cedar-frontend web-api && docker-compose up -d cedar-frontend web-api
```

#### 4. Verify Services

```bash
# Check running containers
docker ps

# Check specific service logs
docker logs cedar-frontend --tail 50
docker logs ventiapi-web-api --tail 50

# Follow logs in real-time
docker logs -f cedar-frontend
```

### Quick Deploy Script Pattern

```bash
# Local development workflow
# 1. Make changes locally
# 2. Test locally with: cd cedar-mastra && bun run dev
# 3. Deploy to EC2:

AWS_PROFILE=ventiapi scp -i ~/.ssh/ventiapi-key.pem \
  path/to/modified/file.tsx \
  ec2-user@52.9.231.2:/opt/ventiapi/path/to/modified/file.tsx

AWS_PROFILE=ventiapi ssh -i ~/.ssh/ventiapi-key.pem ec2-user@52.9.231.2 \
  "cd /opt/ventiapi && docker-compose build cedar-frontend && docker-compose up -d cedar-frontend"
```

---

## Docker Management (Preserving PostgreSQL)

### Critical: Preserving Database During Cleanup

**NEVER run**: `docker system prune -af --volumes` - This will delete the PostgreSQL data!

### Safe Docker Cleanup Procedure

#### Step 1: Stop Non-Essential Services

```bash
# On EC2 server
cd /opt/ventiapi

# Stop services but keep postgres running
docker-compose stop web-api cedar-frontend redis cedar-mastra
```

#### Step 2: Verify PostgreSQL is Running

```bash
# Check postgres is still running
docker ps | grep postgres

# Should see:
# ventiapi-postgres   Up XX hours (healthy)   54320->5432/tcp
```

#### Step 3: Clean Docker Resources (SAFE)

```bash
# Remove stopped containers
docker container prune -f

# Remove unused images (safe - will rebuild if needed)
docker image prune -af

# Remove build cache
docker builder prune -af

# Check disk space freed
df -h /
```

#### Step 4: Verify PostgreSQL Data Volume Exists

```bash
# List volumes
docker volume ls | grep postgres

# Should see:
# ventiapi_postgres-data

# Verify volume is attached to postgres container
docker inspect ventiapi-postgres | grep -A 5 "Mounts"
```

#### Step 5: Rebuild Scanner Image (CRITICAL)

The scanner image is ephemeral (spawned on-demand) so Docker cleanup removes it. You MUST rebuild it after cleanup:

```bash
cd /opt/ventiapi

# Rebuild scanner image
docker-compose --profile build-only build scanner

# Verify scanner image exists
docker images | grep scanner

# Should see:
# ventiapi-scanner    latest    <image-id>    <timestamp>    298MB
```

#### Step 6: Restart Services

```bash
# Start all services
docker-compose up -d

# Verify all containers running
docker ps
```

### PostgreSQL Backup (Recommended Before Cleanup)

```bash
# On EC2 server
# Backup database to file
docker exec ventiapi-postgres pg_dump -U rag_user rag_db > /tmp/rag_db_backup_$(date +%Y%m%d).sql

# Copy backup to local machine
AWS_PROFILE=ventiapi scp -i ~/.ssh/ventiapi-key.pem \
  ec2-user@52.9.231.2:/tmp/rag_db_backup_*.sql \
  ~/backups/

# Restore from backup (if needed)
docker exec -i ventiapi-postgres psql -U rag_user rag_db < /tmp/rag_db_backup_YYYYMMDD.sql
```

### Disk Space Monitoring

```bash
# Check overall disk usage
df -h /

# Check Docker disk usage
docker system df

# Check specific volume sizes
docker system df -v | grep postgres
```

### Emergency: If PostgreSQL Data is Lost

If you accidentally deleted the PostgreSQL volume:

1. **Check if any scans exist in database**:
```bash
docker exec ventiapi-postgres psql -U rag_user -d rag_db -c "SELECT COUNT(*) FROM scans;"
```

2. **If count is 0**, database is empty. You'll need to:
   - Run new scans to repopulate
   - Restore from backup if available
   - Check if raw scan result files exist in volumes: `/shared/results/`

3. **Prevent future loss**:
   - Always verify `docker volume ls | grep postgres` before cleanup
   - Create regular backups
   - Consider volume snapshots on AWS EBS

---

## Agent Prompt for Completing Dashboard Updates

### Context for Agent

You are tasked with replacing mock data with real database-backed scan results in the **Executive Dashboard** of a security scanning application. The **Developer Dashboard** has already been successfully migrated and serves as a reference implementation. The **Security Analyst Dashboard** is already using real data.

### Reference Implementation

**Developer Dashboard Migration** (COMPLETED ✅):
- File: `cedar-mastra/src/components/developer/DeveloperView.tsx`
- Added scan list fetching with `scannerApi.listScans()`
- Added findings fetching with `scannerApi.getFindings(scanId)`
- Added scan selector UI component
- Transformed database findings to match TypeScript `Finding` interface
- Fixed table display to show actual titles

**Security Analyst Dashboard** (ALREADY COMPLETE ✅):
- File: `cedar-mastra/src/components/analyst/SecurityAnalystView.tsx`
- Already uses `useScanResultsState()` hook for real data
- No changes needed

### Task: Migrate Executive Dashboard

**Target File**: `cedar-mastra/src/components/executive/ExecutiveView.tsx`

**Current Mock Data Imports** (Lines 18-23):
```typescript
import {
  mockExecSummary,    // KPI cards data
  mockExecTrend,      // Trend chart data
  mockExecTopRisks,   // Top risks cards
  mockExecCompliance, // Compliance snapshot
  mockExecSlaOwners,  // SLA ownership table
} from "@/data/mockExecutiveData";
```

### Requirements

#### 1. Data Fetching

Add the following data fetching logic similar to Developer Dashboard:

```typescript
const [scans, setScans] = useState<any[]>([]);
const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
const [scanFindings, setScanFindings] = useState<any[]>([]);
const [isLoading, setIsLoading] = useState(true);

// Fetch recent scans on mount
useEffect(() => {
  const fetchScans = async () => {
    try {
      const response = await scannerApi.listScans(10, 0);
      setScans(response.scans);

      // Auto-select most recent completed scan
      const mostRecent = response.scans.find(s => s.status === 'completed');
      if (mostRecent) {
        setSelectedScanId(mostRecent.scan_id);
      }
    } catch (error) {
      console.error('Error fetching scans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  fetchScans();
}, []);

// Fetch findings when selected scan changes
useEffect(() => {
  if (!selectedScanId) return;

  const fetchFindings = async () => {
    try {
      const response = await scannerApi.getFindings(selectedScanId);
      setScanFindings(response.findings || []);
    } catch (error) {
      console.error('Error fetching findings:', error);
      setScanFindings([]);
    }
  };

  fetchFindings();
}, [selectedScanId]);
```

#### 2. Data Transformation

Transform the database findings into executive-level metrics:

**KPI Summary** (`mockExecSummary` replacement):
```typescript
const execSummary = useMemo(() => {
  if (!scanFindings || scanFindings.length === 0) {
    return {
      totalFindings: 0,
      criticalFindings: 0,
      highFindings: 0,
      mediumFindings: 0,
      lowFindings: 0,
    };
  }

  return {
    totalFindings: scanFindings.length,
    criticalFindings: scanFindings.filter(f => f.severity === 'Critical').length,
    highFindings: scanFindings.filter(f => f.severity === 'High').length,
    mediumFindings: scanFindings.filter(f => f.severity === 'Medium').length,
    lowFindings: scanFindings.filter(f => f.severity === 'Low').length,
  };
}, [scanFindings]);
```

**Top Risks** (`mockExecTopRisks` replacement):
```typescript
const topRisks = useMemo(() => {
  if (!scanFindings || scanFindings.length === 0) return [];

  // Sort by severity and score, take top 5
  return scanFindings
    .sort((a, b) => {
      const severityOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return (b.score || 0) - (a.score || 0);
    })
    .slice(0, 5)
    .map(f => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      score: f.score || 0,
      owasp: f.rule || '',
      affectedEndpoints: 1, // Could aggregate if multiple findings share same title
      businessImpact: f.description,
    }));
}, [scanFindings]);
```

**Compliance Snapshot** (`mockExecCompliance` replacement):
```typescript
const complianceSnapshot = useMemo(() => {
  if (!scanFindings || scanFindings.length === 0) {
    return {
      owasp: { covered: 0, total: 10, percentage: 0 },
      // Add other compliance frameworks as needed
    };
  }

  // Count unique OWASP categories found
  const uniqueOwasp = new Set(scanFindings.map(f => f.rule).filter(Boolean));

  return {
    owasp: {
      covered: uniqueOwasp.size,
      total: 10,
      percentage: (uniqueOwasp.size / 10) * 100,
    },
  };
}, [scanFindings]);
```

**Trend Data** (`mockExecTrend` replacement):
```typescript
const trendData = useMemo(() => {
  // For now, create a simple trend based on current scan
  // In future, aggregate multiple scans by date
  if (!scans || scans.length === 0) return [];

  return scans.slice(0, 7).reverse().map(scan => ({
    date: new Date(scan.created_at).toLocaleDateString(),
    critical: scan.findings?.filter(f => f.severity === 'Critical').length || 0,
    high: scan.findings?.filter(f => f.severity === 'High').length || 0,
    medium: scan.findings?.filter(f => f.severity === 'Medium').length || 0,
    low: scan.findings?.filter(f => f.severity === 'Low').length || 0,
  }));
}, [scans]);
```

**SLA Owners** (`mockExecSlaOwners` replacement):
```typescript
const slaOwners = useMemo(() => {
  if (!scanFindings || scanFindings.length === 0) return [];

  // Group findings by endpoint/service
  const byService = scanFindings.reduce((acc, f) => {
    const service = f.scanner || 'unknown';
    if (!acc[service]) {
      acc[service] = {
        name: service,
        totalFindings: 0,
        criticalFindings: 0,
        overdueSLA: 0,
      };
    }
    acc[service].totalFindings++;
    if (f.severity === 'Critical') acc[service].criticalFindings++;
    return acc;
  }, {} as Record<string, any>);

  return Object.values(byService);
}, [scanFindings]);
```

#### 3. UI Updates

Add scan selector dropdown (similar to Developer Dashboard):

```typescript
{scans.length > 0 && (
  <div className="bg-card border border-border rounded-lg p-4 mb-6">
    <label htmlFor="scan-select" className="block text-sm font-medium text-foreground mb-2">
      Select Scan
    </label>
    <select
      id="scan-select"
      value={selectedScanId || ''}
      onChange={(e) => setSelectedScanId(e.target.value)}
      className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {scans.map((scan) => (
        <option key={scan.scan_id} value={scan.scan_id}>
          {new Date(scan.created_at).toLocaleString()} - {scan.server_url} ({scan.status}) - {scan.findings_count} findings
        </option>
      ))}
    </select>
  </div>
)}
```

Add loading state:

```typescript
{isLoading && (
  <div className="text-center py-8 text-muted-foreground">
    Loading scans...
  </div>
)}
```

#### 4. Remove Mock Data

Replace all mock data references:

**Before**:
```typescript
<ExecutiveKPICards summary={mockExecSummary} onAddToReport={addCardToReport} />
<ExecutiveTrendChart trend={mockExecTrend} />
<ExecutiveTopRisks risks={mockExecTopRisks} onAddToReport={addCardToReport} />
<ExecutiveComplianceSnapshot compliance={mockExecCompliance} onAddToReport={addCardToReport} />
<ExecutiveOwnershipTable owners={mockExecSlaOwners} onAddToReport={addCardToReport} />
```

**After**:
```typescript
<ExecutiveKPICards summary={execSummary} onAddToReport={addCardToReport} />
<ExecutiveTrendChart trend={trendData} />
<ExecutiveTopRisks risks={topRisks} onAddToReport={addCardToReport} />
<ExecutiveComplianceSnapshot compliance={complianceSnapshot} onAddToReport={addCardToReport} />
<ExecutiveOwnershipTable owners={slaOwners} onAddToReport={addCardToReport} />
```

### Implementation Steps

1. **Read and understand** the Developer Dashboard implementation in `cedar-mastra/src/components/developer/DeveloperView.tsx`
2. **Import required dependencies**:
   ```typescript
   import { useState, useEffect, useMemo } from "react";
   import { scannerApi } from "@/lib/scannerApi";
   ```
3. **Add state management** for scans, selectedScanId, scanFindings, isLoading
4. **Add useEffect hooks** for fetching scans and findings
5. **Add useMemo hooks** for data transformation (execSummary, topRisks, complianceSnapshot, trendData, slaOwners)
6. **Add scan selector UI** component
7. **Replace all mock data references** with computed values
8. **Remove mock data imports** from the file
9. **Test locally** with `cd cedar-mastra && bun run dev`

### Deployment Instructions

After completing the changes locally:

1. **Copy file to EC2**:
```bash
AWS_PROFILE=ventiapi scp -i ~/.ssh/ventiapi-key.pem \
  cedar-mastra/src/components/executive/ExecutiveView.tsx \
  ec2-user@52.9.231.2:/opt/ventiapi/cedar-mastra/src/components/executive/ExecutiveView.tsx
```

2. **Rebuild and restart frontend**:
```bash
AWS_PROFILE=ventiapi ssh -i ~/.ssh/ventiapi-key.pem ec2-user@52.9.231.2 \
  "cd /opt/ventiapi && docker-compose build cedar-frontend && docker-compose up -d cedar-frontend"
```

3. **Verify deployment**:
```bash
# Check logs
AWS_PROFILE=ventiapi ssh -i ~/.ssh/ventiapi-key.pem ec2-user@52.9.231.2 \
  "docker logs cedar-frontend --tail 50"

# Check service is running
AWS_PROFILE=ventiapi ssh -i ~/.ssh/ventiapi-key.pem ec2-user@52.9.231.2 \
  "docker ps | grep cedar-frontend"
```

### Testing Checklist

- [ ] Executive dashboard loads without errors
- [ ] Scan selector dropdown appears with recent scans
- [ ] Selecting a scan populates all components with data
- [ ] KPI cards show correct counts from database findings
- [ ] Top risks show actual findings sorted by severity/score
- [ ] Compliance snapshot reflects OWASP categories found
- [ ] Trend chart shows historical data (or current scan data)
- [ ] SLA ownership table groups by service
- [ ] No mock data references remain in code
- [ ] Page gracefully handles empty scan state (no crashes)

### Edge Cases to Handle

1. **No scans available**: Show empty state message
2. **Scan has 0 findings**: Show "No findings found" instead of errors
3. **Scan failed**: Display error message appropriately
4. **Multiple scans**: Allow switching between them via dropdown
5. **Loading state**: Show spinner while fetching data

### Success Criteria

✅ Executive dashboard displays real scan data from PostgreSQL database
✅ All mock data imports removed
✅ Scan selector allows switching between historical scans
✅ KPI cards reflect actual finding counts and severity distribution
✅ Top risks show real vulnerabilities sorted by severity and score
✅ Compliance snapshot calculates coverage based on actual OWASP categories found
✅ SLA ownership table groups findings by scanner/service
✅ Page loads without errors when no scans exist
✅ Successfully deployed and running on EC2 at http://52.9.231.2:3001

---

## Additional Resources

### Database Schema Reference

See `scanner-service/web-api/database.py` for complete database schema and query functions:
- `create_scan()` - Insert new scan
- `get_scan()` - Get scan by ID
- `update_scan_status()` - Update scan progress/status
- `insert_findings()` - Bulk insert findings
- `get_findings()` - Query findings with pagination
- `get_findings_count()` - Count total findings for a scan

### API Documentation

See `scanner-service/web-api/main.py` for available endpoints:
- Line 604: `GET /api/scan/{scan_id}/findings` - Get findings with pagination
- Line 558: `GET /api/scan/{scan_id}/status` - Get scan status and progress
- Line 490: `GET /api/scans` - List recent scans
- Line 369: `POST /api/scan/start` - Start new scan

### Frontend API Client

See `cedar-mastra/src/lib/scannerApi.ts` for TypeScript API client:
- `scannerApi.listScans(limit, offset)` - List scans
- `scannerApi.getScanStatus(scanId)` - Get scan status
- `scannerApi.getFindings(scanId)` - Get findings
- `ensureScannerAuth()` - Handle authentication automatically

### Type Definitions

See `cedar-mastra/src/types/finding.ts` for complete `Finding` interface with all required and optional fields.

---

## Troubleshooting

### Common Issues

**Issue**: "Cannot read properties of undefined (reading 'title')"
- **Cause**: Missing data transformation or null checking
- **Fix**: Add optional chaining (`finding.title || 'No Title'`) and ensure data transformation creates all required fields

**Issue**: "Scan not found (404)"
- **Cause**: Scanner image was deleted during Docker cleanup
- **Fix**: Rebuild scanner image with `docker-compose --profile build-only build scanner`

**Issue**: "Failed to fetch findings"
- **Cause**: Authentication token expired or missing
- **Fix**: Check `localStorage` for scanner JWT token, re-authenticate if needed

**Issue**: "Database connection failed"
- **Cause**: PostgreSQL container not running
- **Fix**: `docker-compose up -d postgres` and verify with `docker ps | grep postgres`

**Issue**: "Empty findings array even though database has data"
- **Cause**: Incorrect scan_id or findings not inserted properly
- **Fix**: Verify findings in database: `docker exec ventiapi-postgres psql -U rag_user -d rag_db -c "SELECT * FROM findings LIMIT 5;"`

---

## Maintenance Notes

### Regular Database Backups

Schedule weekly backups:
```bash
# Add to crontab on EC2
0 2 * * 0 docker exec ventiapi-postgres pg_dump -U rag_user rag_db > /backup/rag_db_$(date +\%Y\%m\%d).sql
```

### Monitoring Disk Space

Set up alerts when disk usage exceeds 80%:
```bash
df -h / | awk 'NR==2 {print $5}' | sed 's/%//' | (read usage; [ $usage -gt 80 ] && echo "WARNING: Disk usage at ${usage}%")
```

### Log Rotation

Docker logs can grow large. Configure log rotation in `docker-compose.yml`:
```yaml
services:
  cedar-frontend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

**Document Version**: 1.0
**Last Updated**: 2025-01-19
**Author**: VentiAPI Security Team
**Status**: Production Ready
