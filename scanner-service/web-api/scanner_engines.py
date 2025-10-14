"""
Multi-Scanner Engine Interface
Supports multiple scanning engines (VentiAPI, ZAP, etc.) running in parallel
"""

import asyncio
import json
import subprocess
import uuid
import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Shared results directory (mounted from Docker volume)
SHARED_RESULTS = Path("/shared/results")
ZAP_RESULTS_DIR = SHARED_RESULTS / "zap"

class ScannerEngine(ABC):
    """Abstract base class for scanner engines"""
    
    def __init__(self, name: str):
        self.name = name
        self.engine_id = str(uuid.uuid4())[:8]
    
    @abstractmethod
    async def scan(self, scan_id: str, spec_path: str, target_url: str, 
                   options: Dict[str, Any]) -> Dict[str, Any]:
        """Execute scan and return results"""
        pass
    
    @abstractmethod
    def get_docker_command(self, scan_id: str, spec_path: str, target_url: str, 
                          options: Dict[str, Any]) -> List[str]:
        """Get Docker command for this scanner"""
        pass
    
    def get_result_path(self, scan_id: str) -> str:
        """Get results path for this scanner"""
        return f"/shared/results/{scan_id}_{self.name}"

class VentiAPIScanner(ScannerEngine):
    """VentiAPI Scanner Engine"""
    
    def __init__(self):
        super().__init__("ventiapi")
        self.image = "ventiapi-scanner"
    
    def get_docker_command(self, scan_id: str, spec_path: str, target_url: str,
                          options: Dict[str, Any]) -> List[str]:
        """Generate VentiAPI scanner Docker command"""
        volume_prefix = options.get('volume_prefix', '295capstone-assembly')
        
        # Handle None spec_path by using target_url/openapi.json as fallback
        spec_to_use = spec_path or f"{target_url}/openapi.json"
        
        cmd = [
            'docker', 'run', '--rm',
            '--network', 'host',
            '--memory', '512m',
            '--cpus', '0.5',
            '--tmpfs', '/tmp:noexec,nosuid,size=100m',
            '--security-opt', 'no-new-privileges',
            '-v', f'{volume_prefix}_shared-results:/shared/results',
            '-v', f'{volume_prefix}_shared-specs:/shared/specs',
            f'--name', f'ventiapi-scanner-{scan_id}',
            f'--label', f'scan_id={scan_id}',
            f'--label', 'app=ventiapi-scanner',
            self.image,
            '--spec', spec_to_use,
            '--server', target_url,
            '--out', self.get_result_path(scan_id),
            '--rps', str(options.get('rps', 1.0) or 1.0),
            '--max-requests', str(options.get('max_requests', 100) or 100)
        ]
        
        if options.get('dangerous', False):
            cmd.append('--dangerous')
        if options.get('fuzz_auth', False):
            cmd.append('--fuzz-auth')
            
        return cmd
    
    async def scan(self, scan_id: str, spec_path: str, target_url: str, 
                   options: Dict[str, Any]) -> Dict[str, Any]:
        """Execute VentiAPI scan"""
        cmd = self.get_docker_command(scan_id, spec_path, target_url, options)
        
        try:
            # Debug: Print command elements to find None values
            print(f"Debug VentiAPI command elements: {cmd}")
            for i, element in enumerate(cmd):
                if element is None:
                    print(f"Found None at position {i}")
            
            logger.info(f"🔍 Starting VentiAPI scan: {' '.join(cmd)}")
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            return {
                "engine": self.name,
                "scan_id": scan_id,
                "status": "completed" if process.returncode == 0 else "failed",
                "return_code": process.returncode,
                "stdout": stdout.decode() if stdout else "",
                "stderr": stderr.decode() if stderr else "",
                "result_path": self.get_result_path(scan_id)
            }
            
        except Exception as e:
            logger.error(f"VentiAPI scan failed: {e}")
            return {
                "engine": self.name,
                "scan_id": scan_id,
                "status": "failed",
                "error": str(e)
            }

class ZAPScanner(ScannerEngine):
    """OWASP ZAP Scanner Engine"""
    
    def __init__(self):
        super().__init__("zap")
        self.image = "ventiapi-zap"  # Use locally built image
    
    def get_docker_command(self, scan_id: str, spec_path: str, target_url: str,
                          options: Dict[str, Any]) -> List[str]:
        """Generate ZAP scanner Docker command"""
        volume_prefix = options.get('volume_prefix', '295capstone-assembly')

        # ZAP result paths - just filenames since we set working directory with -w
        zap_json_path = f'{scan_id}_zap.json'
        zap_html_path = f'{scan_id}_zap.html'

        # Mount shared-results to /shared/results (same as VentiAPI scanner)
        zap_volume_mount = f'{volume_prefix}_shared-results:/shared/results:rw'

        # For now, always use baseline scan (API scan mode has issues with our OpenAPI specs)
        # TODO: Fix ZAP API scan mode to work with OpenAPI specs
        if False:  # Disabled API scan mode
            # Convert spec path from /shared/specs/... to /zap/specs/... for ZAP container
            zap_spec_path = spec_path.replace('/shared/specs/', '/zap/specs/')

            cmd = [
                'docker', 'run', '--rm',
                '--network', 'host',
                '--memory', '1g',
                '--cpus', '1.0',
                '--security-opt', 'no-new-privileges',
                '-v', zap_volume_mount,
                '-v', f'{volume_prefix}_shared-specs:/zap/specs:ro',
                f'--name', f'zap-scanner-{scan_id}',
                f'--label', f'scan_id={scan_id}',
                f'--label', 'app=zap-scanner',
                '--entrypoint', 'zap-api-scan.py',
                self.image,
                '-t', zap_spec_path,
                '-f', 'openapi',
                '-O', target_url,  # Override server URL in OpenAPI spec
                '-J', zap_json_path,
                '-r', zap_html_path
            ]
        else:
            cmd = [
                'docker', 'run', '--rm',
                '--network', 'host',
                '--memory', '1g',
                '--cpus', '1.0',
                '--security-opt', 'no-new-privileges',
                '-v', zap_volume_mount,
                '-w', '/shared/results/zap',  # Set working directory to ZAP subdirectory
                f'--name', f'zap-scanner-{scan_id}',
                f'--label', f'scan_id={scan_id}',
                f'--label', 'app=zap-scanner',
                '--entrypoint', 'zap-baseline.py',
                self.image,
                '-t', target_url,
                '-J', zap_json_path,
                '-r', zap_html_path
            ]
        
        # Add ZAP-specific options
        if options.get('debug', False):
            cmd.extend(['-d'])  # Debug mode
            
        if options.get('timeout', None):
            cmd.extend(['-T', str(options['timeout'])])  # Max time in minutes
            
        return cmd
    
    async def scan(self, scan_id: str, spec_path: str, target_url: str,
                   options: Dict[str, Any]) -> Dict[str, Any]:
        """Execute ZAP scan"""
        try:
            # Create dedicated ZAP directory with world-writable permissions
            # This allows ZAP (running as UID 1000) to write results
            ZAP_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
            os.chmod(ZAP_RESULTS_DIR, 0o777)
            logger.info(f"✓ Created ZAP results directory: {ZAP_RESULTS_DIR}")

            cmd = self.get_docker_command(scan_id, spec_path, target_url, options)
            logger.info(f"🕷️  Starting ZAP scan: {' '.join(cmd)}")

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            # ZAP baseline scanner exit codes:
            # 0: No alerts found
            # 1: Low risk alerts found
            # 2: Medium risk alerts found
            # 3: High risk alerts found
            # Any other code is a real failure
            zap_success = process.returncode in [0, 1, 2, 3]

            # ZAP reports are written to the zap subdirectory
            zap_result_dir = "/shared/results/zap"
            return {
                "engine": self.name,
                "scan_id": scan_id,
                "status": "completed" if zap_success else "failed",
                "return_code": process.returncode,
                "stdout": stdout.decode() if stdout else "",
                "stderr": stderr.decode() if stderr else "",
                "result_path": f"{zap_result_dir}/{scan_id}_zap",
                "json_report": f"{zap_result_dir}/{scan_id}_zap.json",
                "html_report": f"{zap_result_dir}/{scan_id}_zap.html",
                "risk_level": {0: "none", 1: "low", 2: "medium", 3: "high"}.get(process.returncode, "unknown")
            }

        except Exception as e:
            logger.error(f"ZAP scan failed: {e}")
            return {
                "engine": self.name,
                "scan_id": scan_id,
                "status": "failed",
                "error": str(e)
            }

class MultiScannerManager:
    """Manages multiple scanner engines"""
    
    def __init__(self):
        self.engines = {
            'ventiapi': VentiAPIScanner(),
            'zap': ZAPScanner()
        }
        
    def get_available_engines(self) -> List[str]:
        """Get list of available scanner engines"""
        return list(self.engines.keys())
    
    async def run_parallel_scan(self, scan_id: str, spec_path: str, target_url: str, 
                               engines: List[str], options: Dict[str, Any]) -> Dict[str, Any]:
        """Run multiple scanners in parallel"""
        
        if not engines:
            engines = self.get_available_engines()
        
        # Validate requested engines
        invalid_engines = [e for e in engines if e not in self.engines]
        if invalid_engines:
            raise ValueError(f"Invalid scanner engines: {invalid_engines}")
        
        logger.info(f"🚀 Starting parallel scan with engines: {engines}")
        
        # Create scan tasks for each engine
        tasks = []
        for engine_name in engines:
            engine = self.engines[engine_name]
            task = asyncio.create_task(
                engine.scan(scan_id, spec_path, target_url, options),
                name=f"{engine_name}-{scan_id}"
            )
            tasks.append(task)
        
        # Wait for all scans to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        scan_results = {
            "scan_id": scan_id,
            "engines": engines,
            "start_time": datetime.utcnow().isoformat(),
            "results": {}
        }
        
        for i, result in enumerate(results):
            engine_name = engines[i]
            
            if isinstance(result, Exception):
                scan_results["results"][engine_name] = {
                    "status": "failed",
                    "error": str(result)
                }
            else:
                scan_results["results"][engine_name] = result
        
        # Calculate overall status
        statuses = [r.get("status", "failed") for r in scan_results["results"].values()]
        if any(s == "completed" for s in statuses):
            scan_results["overall_status"] = "completed"
        elif all(s == "failed" for s in statuses):
            scan_results["overall_status"] = "failed"
        else:
            scan_results["overall_status"] = "partial"
        
        scan_results["end_time"] = datetime.utcnow().isoformat()
        
        return scan_results

# Global instance
multi_scanner = MultiScannerManager()