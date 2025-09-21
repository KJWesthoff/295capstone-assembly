"""
Scanner Registry
Central registry for managing all available scanners
"""
import os
import logging
from typing import Dict, List, Optional, Type
from enum import Enum

from .base import BaseScanner, ScannerType
from .microservice_scanner import NucleiMicroserviceScanner, ZAPMicroserviceScanner
from .nikto_scanner import NiktoDirectScanner, NiktoMicroserviceScanner


class ScannerRegistry:
    """Central registry for all available scanners"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._scanners: Dict[str, BaseScanner] = {}
        self._scanner_classes: Dict[ScannerType, Type[BaseScanner]] = {}
        self._initialize_scanners()
    
    def _initialize_scanners(self):
        """Initialize all available scanners"""
        scanner_configs = [
            # VentiAPI Scanner (your existing one)
            {
                "enabled": True,
                "class": None,  # Your existing VentiAPI scanner
                "config": {}
            },
            
            # Nuclei Scanner
            {
                "enabled": os.getenv("NUCLEI_ENABLED", "true").lower() == "true",
                "class": NucleiMicroserviceScanner,
                "config": {
                    "service_url": os.getenv("NUCLEI_SERVICE_URL", "http://localhost:8001")
                }
            },
            
            # OWASP ZAP Scanner  
            {
                "enabled": os.getenv("ZAP_ENABLED", "true").lower() == "true",
                "class": ZAPMicroserviceScanner,
                "config": {
                    "service_url": os.getenv("ZAP_SERVICE_URL", "http://localhost:8002")
                }
            },
            
            # Nikto Scanner
            {
                "enabled": os.getenv("NIKTO_ENABLED", "false").lower() == "true",
                "class": NiktoDirectScanner,
                "config": {}
            },
            
            # Nikto Microservice (alternative)
            {
                "enabled": os.getenv("NIKTO_MICROSERVICE_ENABLED", "false").lower() == "true",
                "class": NiktoMicroserviceScanner,
                "config": {
                    "service_url": os.getenv("NIKTO_SERVICE_URL", "http://localhost:8003")
                }
            }
        ]
        
        for config in scanner_configs:
            if config["enabled"] and config["class"]:
                try:
                    scanner = config["class"](**config["config"])
                    self.register_scanner(scanner)
                except Exception as e:
                    self.logger.error(f"Failed to initialize scanner {config['class']}: {e}")
    
    def register_scanner(self, scanner: BaseScanner):
        """Register a scanner instance"""
        scanner_id = self._generate_scanner_id(scanner)
        self._scanners[scanner_id] = scanner
        self._scanner_classes[scanner.scanner_type] = type(scanner)
        self.logger.info(f"Registered scanner: {scanner.name} ({scanner_id})")
    
    def _generate_scanner_id(self, scanner: BaseScanner) -> str:
        """Generate unique ID for scanner"""
        return f"{scanner.scanner_type.value.lower()}_{scanner.name.lower().replace(' ', '_')}"
    
    def get_scanner(self, scanner_id: str) -> Optional[BaseScanner]:
        """Get scanner by ID"""
        return self._scanners.get(scanner_id)
    
    def get_scanner_by_type(self, scanner_type: ScannerType) -> Optional[BaseScanner]:
        """Get first scanner of given type"""
        for scanner in self._scanners.values():
            if scanner.scanner_type == scanner_type:
                return scanner
        return None
    
    def get_all_scanners(self) -> Dict[str, BaseScanner]:
        """Get all registered scanners"""
        return self._scanners.copy()
    
    def get_available_scanners(self) -> List[Dict]:
        """Get list of available scanners with their info"""
        scanners_info = []
        
        for scanner_id, scanner in self._scanners.items():
            try:
                info = scanner.get_scanner_info()
                info["scanner_id"] = scanner_id
                info["enabled"] = True
                scanners_info.append(info)
            except Exception as e:
                self.logger.error(f"Error getting info for scanner {scanner_id}: {e}")
                scanners_info.append({
                    "scanner_id": scanner_id,
                    "name": scanner.name,
                    "type": scanner.scanner_type.value,
                    "status": "error",
                    "error": str(e),
                    "enabled": False
                })
        
        return scanners_info
    
    async def health_check_all(self) -> Dict[str, bool]:
        """Health check all scanners"""
        results = {}
        
        for scanner_id, scanner in self._scanners.items():
            try:
                if hasattr(scanner, 'health_check'):
                    results[scanner_id] = await scanner.health_check()
                else:
                    results[scanner_id] = True  # Assume healthy if no health check
            except Exception as e:
                self.logger.error(f"Health check failed for {scanner_id}: {e}")
                results[scanner_id] = False
        
        return results
    
    def create_scanner_instance(self, scanner_type: ScannerType) -> Optional[BaseScanner]:
        """Create new instance of scanner by type"""
        scanner_class = self._scanner_classes.get(scanner_type)
        if scanner_class:
            try:
                return scanner_class()
            except Exception as e:
                self.logger.error(f"Failed to create scanner instance for {scanner_type}: {e}")
        return None


# Global scanner registry instance
scanner_registry = ScannerRegistry()


# Convenience functions
def get_scanner(scanner_id: str) -> Optional[BaseScanner]:
    """Get scanner by ID"""
    return scanner_registry.get_scanner(scanner_id)


def get_available_scanners() -> List[Dict]:
    """Get list of available scanners"""
    return scanner_registry.get_available_scanners()


def register_custom_scanner(scanner: BaseScanner):
    """Register a custom scanner"""
    scanner_registry.register_scanner(scanner)


async def health_check_scanners() -> Dict[str, bool]:
    """Health check all scanners"""
    return await scanner_registry.health_check_all()