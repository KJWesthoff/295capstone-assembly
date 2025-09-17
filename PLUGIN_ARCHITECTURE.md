# Scanner Plugin Architecture

The VentiAPI Scanner now supports a plugin architecture that allows multiple security scanners to be integrated and managed through a unified interface.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  Main API       │    │ Plugin Manager  │
│   (React)       │────│  (FastAPI)      │────│                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                         ┌──────────────────────────────┼──────────────────────────────┐
                         │                              │                              │
                ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
                │   VentiAPI      │            │   OWASP ZAP     │            │   Nuclei        │
                │   Scanner       │            │   Scanner       │            │   Scanner       │
                │   Plugin        │            │   Plugin        │            │   Plugin        │
                └─────────────────┘            └─────────────────┘            └─────────────────┘
```

## 📁 Project Structure

```
scanner-service/web-api/
├── scanner_plugins/
│   ├── __init__.py
│   ├── base.py              # Base scanner interface
│   ├── manager.py           # Plugin manager
│   ├── venti_scanner.py     # VentiAPI scanner plugin
│   └── zap_scanner.py       # OWASP ZAP scanner plugin (example)
├── scanner_integration.py   # Legacy API integration
├── plugin_api.py           # New plugin-based API endpoints
└── main.py                 # Main API with legacy endpoints
```

## 🔌 Plugin System Components

### 1. Base Scanner Interface (`base.py`)

All scanner plugins inherit from `BaseScanner` and implement these methods:

```python
class BaseScanner(ABC):
    @abstractmethod
    def get_capabilities(self) -> ScannerCapability:
        """Return scanner capabilities"""
        
    @abstractmethod
    def validate_target(self, target: ScanTarget) -> bool:
        """Validate if scanner can scan the target"""
        
    @abstractmethod
    async def scan(self, scan_id: str, target: ScanTarget, 
                   config: ScanConfig) -> ScanResult:
        """Execute the security scan"""
        
    @abstractmethod
    async def stop_scan(self, scan_id: str) -> bool:
        """Stop a running scan"""
```

### 2. Scanner Manager (`manager.py`)

The `ScannerManager` coordinates all plugins:

- **Scanner Registration**: Automatically discovers and registers plugins
- **Target Routing**: Selects the best scanner for each target
- **Parallel Execution**: Manages multiple concurrent scans
- **Result Aggregation**: Combines findings from multiple scanners

### 3. Standard Data Models

All scanners use standardized data models:

```python
@dataclass
class ScanTarget:
    url: str
    spec_file: Optional[str] = None
    target_type: str = "api"
    authentication: Optional[Dict] = None

@dataclass
class SecurityFinding:
    id: str
    title: str
    severity: SeverityLevel
    category: str
    endpoint: str
    method: str
    evidence: Optional[Dict] = None
```

## 🚀 Using the Plugin System

### Available API Endpoints

#### Get Available Scanners
```bash
GET /api/v2/scanners
```

Response:
```json
{
  "scanners": [
    {
      "type": "venti-api",
      "name": "VentiAPI Scanner",
      "capabilities": {
        "description": "Comprehensive API security scanner",
        "supported_targets": ["api"],
        "supported_formats": ["openapi", "swagger"],
        "parallel_capable": true,
        "healthy": true
      }
    }
  ],
  "total_count": 1
}
```

#### Start a Scan
```bash
POST /api/v2/scan/start
Content-Type: multipart/form-data

target_url=https://api.example.com
scanner_type=venti-api
max_requests=100
dangerous_mode=false
```

#### Get Scan Status
```bash
GET /api/v2/scan/{scan_id}/status
```

#### Get Scan Findings
```bash
GET /api/v2/scan/{scan_id}/findings?offset=0&limit=50
```

## 🔧 Adding New Scanner Plugins

### Step 1: Create Scanner Class

```python
# scanner_plugins/my_scanner.py
from .base import BaseScanner, ScannerType, ScannerCapability

class MyCustomScanner(BaseScanner):
    def __init__(self):
        super().__init__(ScannerType.CUSTOM, "My Custom Scanner")
    
    def get_capabilities(self) -> ScannerCapability:
        return ScannerCapability(
            name="My Custom Scanner",
            description="Description of what it does",
            supported_targets=["api", "web"],
            supported_formats=["openapi"],
            parallel_capable=False,
            auth_capable=True
        )
    
    def validate_target(self, target: ScanTarget) -> bool:
        # Validate if this scanner can handle the target
        return target.target_type in ["api", "web"]
    
    async def scan(self, scan_id: str, target: ScanTarget, 
                   config: ScanConfig) -> ScanResult:
        # Implement your scanning logic here
        pass
    
    def _normalize_single_finding(self, raw_finding: Dict) -> SecurityFinding:
        # Convert your scanner's output to standard format
        pass
```

### Step 2: Register Scanner

Add to `manager.py`:

```python
def _register_scanners(self):
    # Existing scanners...
    
    # Add new scanner
    from .my_scanner import MyCustomScanner
    my_scanner = MyCustomScanner()
    self.scanners[ScannerType.CUSTOM] = my_scanner
```

### Step 3: Add Scanner Type

Add to `base.py`:

```python
class ScannerType(Enum):
    VENTI_API = "venti-api"
    OWASP_ZAP = "owasp-zap"
    NUCLEI = "nuclei"
    MY_CUSTOM = "my-custom"  # Add new type
```

## 🔄 Migration Strategy

The plugin architecture is designed for gradual migration:

### Phase 1: Dual Operation (Current)
- Legacy API endpoints continue to work
- New plugin-based endpoints available at `/api/v2/`
- VentiAPI scanner wrapped as a plugin

### Phase 2: Frontend Integration
- Update frontend to use new plugin endpoints
- Add scanner selection UI
- Maintain backward compatibility

### Phase 3: Full Migration
- Deprecate legacy endpoints
- All scans use plugin system
- Remove legacy code

## 📊 Benefits

### For Users
- **Scanner Choice**: Select the best scanner for each target
- **Unified Interface**: Same API for all scanners
- **Combined Results**: Aggregate findings from multiple tools

### for Developers
- **Easy Extension**: Add new scanners with minimal code
- **Standardized Output**: All scanners return same format
- **Reusable Components**: Common functionality shared across plugins

### For Operations
- **Better Resource Management**: Individual scanner health monitoring
- **Parallel Execution**: Run multiple scanners simultaneously
- **Flexible Deployment**: Enable/disable scanners as needed

## 🛠️ Current Implementation Status

✅ **Completed**:
- Base scanner interface
- Plugin manager
- VentiAPI scanner plugin  
- Legacy API integration
- New plugin-based API endpoints
- OWASP ZAP scanner example

🚧 **In Progress**:
- Frontend integration
- Additional scanner plugins

📋 **Planned**:
- Nuclei scanner plugin
- Custom scanner examples
- Multi-scanner orchestration
- Advanced result correlation

## 🔍 Example: Running Multiple Scanners

```python
# Future capability: Run multiple scanners on same target
scanners = ["venti-api", "owasp-zap", "nuclei"]
results = []

for scanner_type in scanners:
    result = await scanner_manager.start_scan(
        scan_id=f"{base_scan_id}_{scanner_type}",
        target=target,
        config=config,
        scanner_type=ScannerType(scanner_type)
    )
    results.append(result)

# Aggregate findings from all scanners
all_findings = scanner_manager.aggregate_findings(results)
```

This architecture provides a solid foundation for building a comprehensive security scanning platform that can integrate multiple security tools while maintaining a consistent user experience.