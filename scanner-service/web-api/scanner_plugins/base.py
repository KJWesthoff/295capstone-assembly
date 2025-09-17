"""
Base scanner interface for plugin architecture
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from enum import Enum
from dataclasses import dataclass
from datetime import datetime


class ScannerType(Enum):
    """Types of security scanners"""
    VENTI_API = "venti-api"
    OWASP_ZAP = "owasp-zap"
    NUCLEI = "nuclei"
    CUSTOM = "custom"


class SeverityLevel(Enum):
    """Security finding severity levels"""
    CRITICAL = "critical"
    HIGH = "high" 
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class ScanTarget:
    """Represents a scan target"""
    url: str
    spec_file: Optional[str] = None
    target_type: str = "api"  # api, web, network
    authentication: Optional[Dict[str, Any]] = None
    headers: Optional[Dict[str, str]] = None


@dataclass
class ScanConfig:
    """Scanner configuration parameters"""
    max_requests: int = 100
    requests_per_second: float = 1.0
    timeout: int = 600  # seconds
    dangerous_mode: bool = False
    fuzz_auth: bool = False
    parallel_chunks: int = 1
    custom_params: Optional[Dict[str, Any]] = None


@dataclass
class SecurityFinding:
    """Represents a security finding"""
    id: str
    title: str
    description: str
    severity: SeverityLevel
    category: str  # e.g., "injection", "auth", "crypto"
    endpoint: str
    method: str
    evidence: Optional[Dict[str, Any]] = None
    remediation: Optional[str] = None
    references: Optional[List[str]] = None
    cvss_score: Optional[float] = None
    cwe_id: Optional[str] = None


@dataclass
class ScanResult:
    """Complete scan result"""
    scan_id: str
    scanner_type: ScannerType
    status: str  # "completed", "failed", "running", "pending"
    target: ScanTarget
    config: ScanConfig
    findings: List[SecurityFinding]
    metadata: Dict[str, Any]
    started_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class ScannerCapability:
    """Describes what a scanner can do"""
    def __init__(
        self,
        name: str,
        description: str,
        supported_targets: List[str],
        supported_formats: List[str],
        parallel_capable: bool = False,
        auth_capable: bool = False,
        custom_headers: bool = False
    ):
        self.name = name
        self.description = description
        self.supported_targets = supported_targets  # ["api", "web", "network"]
        self.supported_formats = supported_formats  # ["openapi", "swagger", "postman"]
        self.parallel_capable = parallel_capable
        self.auth_capable = auth_capable
        self.custom_headers = custom_headers


class BaseScanner(ABC):
    """Abstract base class for all security scanners"""
    
    def __init__(self, scanner_type: ScannerType, name: str):
        self.scanner_type = scanner_type
        self.name = name
        self._capabilities = None
    
    @abstractmethod
    def get_capabilities(self) -> ScannerCapability:
        """Return scanner capabilities"""
        pass
    
    @abstractmethod
    def validate_target(self, target: ScanTarget) -> bool:
        """Validate if this scanner can scan the given target"""
        pass
    
    @abstractmethod
    def validate_config(self, config: ScanConfig) -> bool:
        """Validate if the scan configuration is supported"""
        pass
    
    @abstractmethod
    async def scan(
        self,
        scan_id: str,
        target: ScanTarget,
        config: ScanConfig,
        progress_callback: Optional[callable] = None
    ) -> ScanResult:
        """
        Execute the security scan
        
        Args:
            scan_id: Unique scan identifier
            target: Target to scan
            config: Scan configuration
            progress_callback: Optional callback for progress updates
            
        Returns:
            ScanResult with findings and metadata
        """
        pass
    
    @abstractmethod
    async def stop_scan(self, scan_id: str) -> bool:
        """Stop a running scan"""
        pass
    
    def get_scanner_info(self) -> Dict[str, Any]:
        """Get basic scanner information"""
        capabilities = self.get_capabilities()
        return {
            "type": self.scanner_type.value,
            "name": self.name,
            "capabilities": {
                "description": capabilities.description,
                "supported_targets": capabilities.supported_targets,
                "supported_formats": capabilities.supported_formats,
                "parallel_capable": capabilities.parallel_capable,
                "auth_capable": capabilities.auth_capable,
                "custom_headers": capabilities.custom_headers
            }
        }
    
    def normalize_findings(self, raw_findings: List[Dict]) -> List[SecurityFinding]:
        """Convert scanner-specific findings to standardized format"""
        normalized = []
        for finding in raw_findings:
            try:
                normalized_finding = self._normalize_single_finding(finding)
                if normalized_finding:
                    normalized.append(normalized_finding)
            except Exception as e:
                print(f"Error normalizing finding: {e}")
                continue
        return normalized
    
    @abstractmethod
    def _normalize_single_finding(self, raw_finding: Dict) -> Optional[SecurityFinding]:
        """Convert a single raw finding to SecurityFinding format"""
        pass
    
    def get_default_config(self) -> ScanConfig:
        """Get default configuration for this scanner"""
        return ScanConfig()
    
    async def health_check(self) -> bool:
        """Check if the scanner is available and working"""
        try:
            # Basic health check - can be overridden by specific scanners
            return True
        except Exception:
            return False