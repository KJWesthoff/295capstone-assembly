"""
Container Scanner Manager
Automatically discovers and manages containerized scanners
"""
import os
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging

from .base import ScannerType
try:
    from .container_scanner import ContainerScanner
    CONTAINER_SCANNER_AVAILABLE = True
except ImportError as e:
    CONTAINER_SCANNER_AVAILABLE = False
    ContainerScanner = None


class ContainerScannerManager:
    """Manages containerized scanner discovery and registration"""
    
    def __init__(self, manifest_dir: str = "/app/scanner-manifests"):
        # Handle different environments
        if not Path(manifest_dir).exists():
            # Try relative path for development
            fallback_dir = Path(__file__).parent.parent / "scanner-manifests"
            if fallback_dir.exists():
                manifest_dir = str(fallback_dir)
            else:
                # Create directory if it doesn't exist
                Path(manifest_dir).mkdir(parents=True, exist_ok=True)
        self.manifest_dir = Path(manifest_dir)
        self.scanners: Dict[str, ContainerScanner] = {}
        self.logger = logging.getLogger(__name__)
        
        # Create manifest directory if it doesn't exist
        self.manifest_dir.mkdir(parents=True, exist_ok=True)
        
        # Auto-discover scanners
        self._discover_scanners()
    
    def _discover_scanners(self):
        """Automatically discover scanner manifests"""
        self.logger.info(f"Discovering scanners in {self.manifest_dir}")
        
        if not self.manifest_dir.exists():
            self.logger.warning(f"Scanner manifest directory {self.manifest_dir} does not exist")
            return
        
        # Look for manifest files
        for manifest_file in self.manifest_dir.glob("*.yaml"):
            try:
                self._register_scanner_from_manifest(manifest_file)
            except Exception as e:
                self.logger.error(f"Failed to register scanner from {manifest_file}: {e}")
        
        # Also look for yml extension
        for manifest_file in self.manifest_dir.glob("*.yml"):
            try:
                self._register_scanner_from_manifest(manifest_file)
            except Exception as e:
                self.logger.error(f"Failed to register scanner from {manifest_file}: {e}")
        
        self.logger.info(f"Discovered {len(self.scanners)} containerized scanners")
    
    def _register_scanner_from_manifest(self, manifest_path: Path):
        """Register a scanner from its manifest file"""
        if not CONTAINER_SCANNER_AVAILABLE:
            self.logger.warning(f"Container scanner not available, skipping {manifest_path}")
            return
            
        try:
            with open(manifest_path, 'r') as f:
                manifest = yaml.safe_load(f)
            
            scanner_name = manifest.get("name", manifest_path.stem)
            scanner_type_str = manifest.get("type", manifest_path.stem.replace("-", "_"))
            
            # Map scanner type
            try:
                scanner_type = ScannerType(scanner_type_str)
            except ValueError:
                # Create a custom scanner type if not in enum
                scanner_type = ScannerType.CUSTOM
            
            # Create container scanner
            scanner = ContainerScanner(scanner_type, str(manifest_path))
            
            # Register scanner
            self.scanners[scanner_name.lower().replace(" ", "_")] = scanner
            
            self.logger.info(f"Registered containerized scanner: {scanner_name}")
            
        except Exception as e:
            self.logger.error(f"Error registering scanner from {manifest_path}: {e}")
            raise
    
    def get_scanner(self, scanner_name: str) -> Optional[ContainerScanner]:
        """Get a specific containerized scanner"""
        return self.scanners.get(scanner_name.lower().replace(" ", "_"))
    
    def get_all_scanners(self) -> Dict[str, ContainerScanner]:
        """Get all registered containerized scanners"""
        return self.scanners.copy()
    
    def list_scanner_info(self) -> List[Dict[str, Any]]:
        """Get information about all registered scanners"""
        scanner_info = []
        
        for name, scanner in self.scanners.items():
            try:
                capabilities = scanner.get_capabilities()
                info = {
                    "name": name,
                    "display_name": scanner.name,
                    "type": scanner.scanner_type.value,
                    "image": scanner.manifest["image"],
                    "version": scanner.manifest.get("version", "unknown"),
                    "description": capabilities.description,
                    "capabilities": {
                        "supported_targets": capabilities.supported_targets,
                        "supported_formats": capabilities.supported_formats,
                        "parallel_capable": capabilities.parallel_capable,
                        "auth_capable": capabilities.auth_capable,
                        "custom_headers": capabilities.custom_headers
                    },
                    "resources": scanner.manifest.get("resources", {}),
                    "containerized": True
                }
                scanner_info.append(info)
            except Exception as e:
                self.logger.error(f"Error getting info for scanner {name}: {e}")
        
        return scanner_info
    
    async def health_check_all(self) -> Dict[str, bool]:
        """Check health of all containerized scanners"""
        health_status = {}
        
        for name, scanner in self.scanners.items():
            try:
                health_status[name] = await scanner.health_check()
            except Exception as e:
                self.logger.error(f"Health check failed for {name}: {e}")
                health_status[name] = False
        
        return health_status
    
    def add_scanner_manifest(self, scanner_name: str, manifest_data: Dict):
        """Add a new scanner manifest programmatically"""
        manifest_file = self.manifest_dir / f"{scanner_name}.yaml"
        
        try:
            with open(manifest_file, 'w') as f:
                yaml.dump(manifest_data, f, default_flow_style=False)
            
            # Register the new scanner
            self._register_scanner_from_manifest(manifest_file)
            
            self.logger.info(f"Added new scanner manifest: {scanner_name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error adding scanner manifest {scanner_name}: {e}")
            return False
    
    def remove_scanner(self, scanner_name: str) -> bool:
        """Remove a scanner and its manifest"""
        scanner_key = scanner_name.lower().replace(" ", "_")
        
        if scanner_key not in self.scanners:
            return False
        
        try:
            # Remove from memory
            del self.scanners[scanner_key]
            
            # Remove manifest file
            manifest_file = self.manifest_dir / f"{scanner_name}.yaml"
            if manifest_file.exists():
                manifest_file.unlink()
            
            # Also check for .yml extension
            manifest_file_yml = self.manifest_dir / f"{scanner_name}.yml"
            if manifest_file_yml.exists():
                manifest_file_yml.unlink()
            
            self.logger.info(f"Removed scanner: {scanner_name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error removing scanner {scanner_name}: {e}")
            return False
    
    def reload_scanners(self):
        """Reload all scanner manifests"""
        self.scanners.clear()
        self._discover_scanners()
    
    def get_scanner_stats(self) -> Dict[str, Any]:
        """Get statistics about containerized scanners"""
        stats = {
            "total_scanners": len(self.scanners),
            "scanner_types": {},
            "images": {},
            "capabilities": {
                "parallel_capable": 0,
                "auth_capable": 0,
                "multi_target": 0
            }
        }
        
        for name, scanner in self.scanners.items():
            # Count by type
            scanner_type = scanner.scanner_type.value
            stats["scanner_types"][scanner_type] = stats["scanner_types"].get(scanner_type, 0) + 1
            
            # Count by image
            image = scanner.manifest["image"]
            stats["images"][image] = stats["images"].get(image, 0) + 1
            
            # Count capabilities
            capabilities = scanner.get_capabilities()
            if capabilities.parallel_capable:
                stats["capabilities"]["parallel_capable"] += 1
            if capabilities.auth_capable:
                stats["capabilities"]["auth_capable"] += 1
            if len(capabilities.supported_targets) > 1:
                stats["capabilities"]["multi_target"] += 1
        
        return stats


def create_example_manifests(manifest_dir: Path):
    """Create example scanner manifests for testing"""
    
    # VentiAPI Scanner Manifest
    venti_manifest = {
        "name": "VentiAPI Scanner",
        "version": "2.0.0",
        "type": "venti-api",
        "image": "ventiapi-scanner:latest",
        "description": "Comprehensive API security scanner with OpenAPI support",
        "capabilities": {
            "targets": ["api"],
            "formats": ["openapi", "swagger"],
            "parallel": True,
            "auth": True,
            "headers": True
        },
        "resources": {
            "memory": "512Mi",
            "cpu": "500m",
            "timeout": 600
        },
        "volumes": [
            "/shared/specs:/input:ro",
            "/shared/results:/output:rw"
        ],
        "environment": [
            "PYTHONUNBUFFERED=1",
            "SCANNER_MODE=container"
        ],
        "healthcheck": {
            "command": ["--health-check"],
            "interval": 30
        }
    }
    
    # OWASP ZAP Scanner Manifest
    zap_manifest = {
        "name": "OWASP ZAP Scanner",
        "version": "2.14.0",
        "type": "owasp-zap",
        "image": "zap-scanner:latest",
        "description": "Web application security scanner with comprehensive vulnerability detection",
        "capabilities": {
            "targets": ["web", "api"],
            "formats": ["openapi", "url"],
            "parallel": False,
            "auth": True,
            "headers": True
        },
        "resources": {
            "memory": "1Gi",
            "cpu": "1000m",
            "timeout": 1800
        },
        "volumes": [
            "/shared/specs:/input:ro",
            "/shared/results:/output:rw"
        ],
        "environment": [
            "ZAP_PORT=8080",
            "ZAP_PROXY_PORT=8090"
        ],
        "healthcheck": {
            "command": ["--health-check"],
            "interval": 60
        }
    }
    
    # Nuclei Scanner Manifest
    nuclei_manifest = {
        "name": "Nuclei Scanner",
        "version": "3.0.0",
        "type": "nuclei",
        "image": "nuclei-scanner:latest",
        "description": "Fast vulnerability scanner based on community templates",
        "capabilities": {
            "targets": ["web", "api"],
            "formats": ["url"],
            "parallel": True,
            "auth": False,
            "headers": True
        },
        "resources": {
            "memory": "256Mi",
            "cpu": "500m",
            "timeout": 300
        },
        "volumes": [
            "/shared/specs:/input:ro",
            "/shared/results:/output:rw"
        ],
        "environment": [
            "NUCLEI_CONFIG=/app/nuclei.yaml"
        ],
        "healthcheck": {
            "command": ["--health-check"],
            "interval": 30
        }
    }
    
    # Write manifest files
    manifest_dir.mkdir(parents=True, exist_ok=True)
    
    with open(manifest_dir / "venti-scanner.yaml", 'w') as f:
        yaml.dump(venti_manifest, f, default_flow_style=False)
    
    with open(manifest_dir / "zap-scanner.yaml", 'w') as f:
        yaml.dump(zap_manifest, f, default_flow_style=False)
    
    with open(manifest_dir / "nuclei-scanner.yaml", 'w') as f:
        yaml.dump(nuclei_manifest, f, default_flow_style=False)


# Global container scanner manager
container_manager = ContainerScannerManager()

# Create example manifests if directory is empty
if not any(container_manager.manifest_dir.glob("*.yaml")) and not any(container_manager.manifest_dir.glob("*.yml")):
    create_example_manifests(container_manager.manifest_dir)
    container_manager.reload_scanners()