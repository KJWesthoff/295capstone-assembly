# Multi-Scanner Architecture Design

Planning for multiple scanner services (VentiAPI, OWASP ZAP, Nuclei, custom scanners, etc.)

## 🏗️ Architecture Options

### Option 1: Microservices (Recommended)
**Best for**: Production, multiple scanner types, team development

```
Frontend → API Gateway → Scanner Services
    ↓         ↓              ↓
   Nginx ← Redis Queue → Results Storage
```

**Pros**:
- ✅ Independent scanner deployment
- ✅ Language/technology flexibility per scanner  
- ✅ Easy to add new scanners
- ✅ Fault isolation
- ✅ Independent scaling

**Cons**:
- ❌ More complex deployment
- ❌ Higher resource usage
- ❌ Network communication overhead

### Option 2: Plugin Architecture
**Best for**: Same-language scanners, rapid development

```
Core API → Plugin Manager → Scanner Plugins
    ↓           ↓               ↓
  Redis ← Job Scheduler → [Plugin1, Plugin2, PluginN]
```

**Pros**:
- ✅ Single deployment
- ✅ Shared infrastructure
- ✅ Easy plugin discovery
- ✅ Lower resource usage

**Cons**:
- ❌ All scanners must use same language/runtime
- ❌ Shared failure points
- ❌ Complex plugin system

## 🚀 Deployment Strategies

### Local Development
```bash
# docker-compose.yml with multiple scanner services
services:
  nginx:          # Load balancer/proxy
  frontend:       # React app
  api-gateway:    # Main API coordinator
  redis:          # Job queue
  scanner-venti:  # VentiAPI scanner
  scanner-zap:    # OWASP ZAP scanner
  scanner-nuclei: # Nuclei scanner
```

### Railway Cloud
```bash
# Option A: Multi-service (expensive but clean)
- frontend service
- api-gateway service  
- redis service
- scanner-venti service
- scanner-zap service

# Option B: Monolith with scanner modules (cost-effective)
- single service with all scanners bundled
```

### Production (Docker/Kubernetes)
```yaml
# Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: scanner-venti
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: venti-scanner
        image: venti-scanner:latest
---
# Separate deployment for each scanner type
```

## 📋 Implementation Phases

### Phase 1: Prepare Current Architecture
- ✅ Abstract scanner interface
- ✅ Message queue for scan requests
- ✅ Standardized result format
- ✅ Plugin discovery system

### Phase 2: Add Second Scanner
- ✅ OWASP ZAP integration
- ✅ Unified API endpoints
- ✅ Scanner selection UI
- ✅ Result comparison

### Phase 3: Scale Out
- ✅ Kubernetes deployment
- ✅ Auto-scaling scanners
- ✅ Load balancing
- ✅ Monitoring/observability

## 🔧 Technical Decisions

### Scanner Communication
```python
# Standardized scanner interface
class Scanner:
    def scan(self, target: str, config: dict) -> ScanResult:
        pass
    
    def get_capabilities(self) -> list:
        pass
    
    def validate_target(self, target: str) -> bool:
        pass
```

### Message Format
```json
{
  "scan_id": "uuid",
  "scanner_type": "venti|zap|nuclei|custom",
  "target": "https://api.example.com",
  "config": {...},
  "priority": 1,
  "callback_url": "/results/webhook"
}
```

### Result Format
```json
{
  "scan_id": "uuid",
  "scanner": "venti-api",
  "status": "completed|failed|running",
  "findings": [...],
  "metadata": {
    "duration": 120,
    "requests_made": 45,
    "coverage": 0.85
  }
}
```

## 🎯 Recommendations

### For Railway Deployment
**Use Plugin Architecture** (single service):
- Bundle multiple scanner engines in one container
- Cost-effective for cloud deployment
- Easier to manage secrets/environment
- Good for prototyping multiple scanners

### For Production Deployment  
**Use Microservices Architecture**:
- Independent scanner services
- Kubernetes for orchestration
- Better fault tolerance
- Team can work on scanners independently

### Hybrid Approach
- **Development/Railway**: Plugin architecture in single container
- **Production**: Microservices with Kubernetes
- **Migration path**: Abstract interfaces allow easy transition

## 🔄 Migration Strategy

1. **Refactor current VentiAPI scanner** into plugin
2. **Create scanner interface** and plugin manager
3. **Add second scanner** (OWASP ZAP) as plugin
4. **Test unified system** with 2+ scanners
5. **Migrate to microservices** when ready for production scale

---

**Next Steps**: Which scanner would you like to add next? OWASP ZAP, Nuclei, or a custom scanner?