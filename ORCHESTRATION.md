# Parallel Scanning Orchestration

The VentiAPI Scanner automatically orchestrates parallel scanning to achieve 2-4x performance improvements on large APIs.

## How It Works

### 1. **Automatic Chunking**
- Large API specs are split into 2-4 endpoint chunks
- Each chunk gets its own scanner container (local) or subprocess (cloud)
- Example: 12 endpoints → 3-6 parallel scanners

### 2. **Parallel Execution**
```
API Spec (12 endpoints)
├── Chunk 1: endpoints 1-4  → Scanner 1
├── Chunk 2: endpoints 5-8  → Scanner 2
└── Chunk 3: endpoints 9-12 → Scanner 3
```

### 3. **Real-Time Progress**
- Individual progress tracking per scanner
- Overall progress calculated from all chunks
- Live updates every 2 seconds in the UI

### 4. **Result Merging**
- Findings from all scanners are automatically combined
- No duplication - each endpoint vulnerability preserved
- Generates unified HTML and JSON reports

## Configuration

### Environment Variables
```bash
# Local Development
SCANNER_MAX_PARALLEL_CONTAINERS=5    # Max concurrent scanners
SCANNER_CONTAINER_MEMORY_LIMIT=512m  # Memory per scanner

# Railway Cloud
railway variables --set "SCANNER_MAX_PARALLEL_CONTAINERS=3"
```

### Performance Examples
| API Size | Parallel Scanners | Speed Improvement |
|----------|-------------------|-------------------|
| 8 endpoints | 2-4 scanners | ~2x faster |
| 16 endpoints | 4-8 scanners | ~3x faster |
| 32 endpoints | 8-16 scanners | ~4x faster |

## Execution Modes

### **Local Development** (Docker)
- Uses Docker containers for isolation
- Full parallel container orchestration
- Higher resource usage, maximum security

### **Railway Cloud** (Subprocess)
- Uses direct subprocess execution
- Railway-compatible (no Docker-in-Docker)
- Lower resource usage, cloud-optimized

## Error Handling

- **Partial Success**: Scan succeeds if any chunk completes
- **Timeout Protection**: 8 minutes per chunk, 30 minutes total
- **Graceful Degradation**: Failed chunks don't stop the scan
- **Progress Recovery**: Real-time updates continue during failures

## Monitoring

```bash
# Check scan progress
curl /api/scan/{scan_id}/status

# View parallel container status
docker ps --filter name=scanner_

# Railway logs
railway logs
```

---

**Result**: Large APIs scan 2-4x faster with automatic parallel processing and intelligent chunk distribution.