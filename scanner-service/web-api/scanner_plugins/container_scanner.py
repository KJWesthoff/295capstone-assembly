"""
Container-based scanner implementation
Manages containerized security scanners
"""
import asyncio
try:
    import docker
    DOCKER_IMPORT_AVAILABLE = True
except ImportError:
    DOCKER_IMPORT_AVAILABLE = False
    docker = None
import json
import yaml
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging

from .base import (
    BaseScanner, ScannerType, ScannerCapability, ScanTarget, ScanConfig,
    ScanResult, SecurityFinding, SeverityLevel
)


class ContainerScanner(BaseScanner):
    """Base class for containerized scanners"""
    
    def __init__(self, scanner_type: ScannerType, manifest_path: str):
        self.manifest = self._load_manifest(manifest_path)
        super().__init__(scanner_type, self.manifest["name"])
        
        if DOCKER_IMPORT_AVAILABLE:
            try:
                self.docker_client = docker.from_env()
            except Exception as e:
                self.logger.warning(f"Failed to connect to Docker: {e}")
                self.docker_client = None
        else:
            self.docker_client = None
        self.shared_results = Path("/shared/results")
        self.shared_specs = Path("/shared/specs")
        self.logger = logging.getLogger(f"scanner.{self.name}")
        
    def _load_manifest(self, manifest_path: str) -> Dict:
        """Load scanner manifest configuration"""
        try:
            with open(manifest_path, 'r') as f:
                return yaml.safe_load(f)
        except Exception as e:
            raise RuntimeError(f"Failed to load scanner manifest {manifest_path}: {e}")
    
    def get_capabilities(self) -> ScannerCapability:
        """Return scanner capabilities from manifest"""
        caps = self.manifest["capabilities"]
        return ScannerCapability(
            name=self.manifest["name"],
            description=self.manifest.get("description", ""),
            supported_targets=caps.get("targets", []),
            supported_formats=caps.get("formats", []),
            parallel_capable=caps.get("parallel", False),
            auth_capable=caps.get("auth", False),
            custom_headers=caps.get("headers", False)
        )
    
    def validate_target(self, target: ScanTarget) -> bool:
        """Validate if this scanner can handle the target"""
        capabilities = self.get_capabilities()
        return target.target_type in capabilities.supported_targets
    
    def validate_config(self, config: ScanConfig) -> bool:
        """Validate scan configuration against container limits"""
        resources = self.manifest.get("resources", {})
        timeout = resources.get("timeout", 3600)
        
        # Check timeout limits
        if config.timeout > timeout:
            return False
        
        # Additional validation can be added here
        return True
    
    async def scan(
        self,
        scan_id: str,
        target: ScanTarget,
        config: ScanConfig,
        progress_callback: Optional[callable] = None
    ) -> ScanResult:
        """Execute containerized scan"""
        
        start_time = datetime.utcnow()
        result = ScanResult(
            scan_id=scan_id,
            scanner_type=self.scanner_type,
            status="running",
            target=target,
            config=config,
            findings=[],
            metadata={},
            started_at=start_time
        )
        
        container = None
        
        try:
            if progress_callback:
                await progress_callback(scan_id, 5, f"Starting {self.name} container")
            
            # Prepare scan directories
            result_dir = self.shared_results / scan_id
            result_dir.mkdir(parents=True, exist_ok=True, mode=0o755)
            
            # Create scan configuration
            scan_config = self._create_scan_config(scan_id, target, config)
            config_file = result_dir / "config.json"
            
            with open(config_file, 'w') as f:
                json.dump(scan_config, f)
            
            if progress_callback:
                await progress_callback(scan_id, 10, f"Launching {self.name} scanner")
            
            # Run container
            container = await self._run_container(scan_id, scan_config)
            
            if progress_callback:
                await progress_callback(scan_id, 20, f"{self.name} scan in progress")
            
            # Monitor container
            exit_code = await self._monitor_container(container, config.timeout, progress_callback, scan_id)
            
            if exit_code == 0:
                # Scan completed successfully
                result.status = "completed"
                result.completed_at = datetime.utcnow()
                
                # Load findings
                result.findings = await self._load_container_findings(scan_id)
                result.metadata = {
                    "total_findings": len(result.findings),
                    "duration_seconds": (result.completed_at - start_time).total_seconds(),
                    "scanner_image": self.manifest["image"],
                    "container_mode": True
                }
                
                if progress_callback:
                    await progress_callback(scan_id, 100, f"{self.name} scan completed")
                
            else:
                # Scan failed
                result.status = "failed"
                result.error_message = await self._get_container_logs(container)
                result.completed_at = datetime.utcnow()
                
                if progress_callback:
                    await progress_callback(scan_id, 100, f"{self.name} scan failed")
            
        except Exception as e:
            result.status = "failed"
            result.error_message = str(e)
            result.completed_at = datetime.utcnow()
            
            self.logger.error(f"Container scan {scan_id} failed: {e}")
            
            if progress_callback:
                await progress_callback(scan_id, 100, f"{self.name} scan error: {str(e)}")
        
        finally:
            # Clean up container
            if container:
                try:
                    container.remove(force=True)
                except:
                    pass
        
        return result
    
    async def stop_scan(self, scan_id: str) -> bool:
        """Stop a running containerized scan"""
        try:
            container_name = f"{self.scanner_type.value}-{scan_id}"
            
            # Find and stop container
            try:
                container = self.docker_client.containers.get(container_name)
                container.stop(timeout=10)
                container.remove(force=True)
                return True
            except docker.errors.NotFound:
                # Container already stopped/removed
                return True
            
        except Exception as e:
            self.logger.error(f"Error stopping container scan {scan_id}: {e}")
            return False
    
    def _create_scan_config(self, scan_id: str, target: ScanTarget, config: ScanConfig) -> Dict:
        """Create standardized scan configuration for container"""
        return {
            "scan_id": scan_id,
            "target": {
                "url": target.url,
                "spec_file": target.spec_file,
                "target_type": target.target_type,
                "authentication": target.authentication,
                "headers": target.headers
            },
            "config": {
                "max_requests": config.max_requests,
                "requests_per_second": config.requests_per_second,
                "timeout": config.timeout,
                "dangerous_mode": config.dangerous_mode,
                "fuzz_auth": config.fuzz_auth,
                "parallel_chunks": config.parallel_chunks,
                "custom_params": config.custom_params
            }
        }
    
    async def _run_container(self, scan_id: str, scan_config: Dict) -> docker.models.containers.Container:
        """Run scanner container with configuration"""
        container_name = f"{self.scanner_type.value}-{scan_id}"
        image = self.manifest["image"]
        
        # Prepare volumes
        volumes = {}
        for volume_spec in self.manifest.get("volumes", []):
            host_path, container_path = volume_spec.split(":")[:2]
            volumes[host_path] = {"bind": container_path, "mode": "rw"}
        
        # Add config volume
        result_dir = self.shared_results / scan_id
        volumes[str(result_dir)] = {"bind": "/tmp", "mode": "rw"}
        
        # Prepare environment
        environment = {}
        for env_var in self.manifest.get("environment", []):
            if "=" in env_var:
                key, value = env_var.split("=", 1)
                environment[key] = value
        
        # Resource limits
        resources = self.manifest.get("resources", {})
        mem_limit = resources.get("memory", "512m")
        cpu_limit = resources.get("cpu", "500m")
        
        # Convert CPU limit (e.g., "500m" to nano CPUs)
        if cpu_limit.endswith("m"):
            nano_cpus = int(cpu_limit[:-1]) * 1000000
        else:
            nano_cpus = int(float(cpu_limit) * 1000000000)
        
        try:
            # Run container
            container = self.docker_client.containers.run(
                image=image,
                name=container_name,
                detach=True,
                remove=False,  # We'll remove manually after getting logs
                volumes=volumes,
                environment=environment,
                mem_limit=mem_limit,
                nano_cpus=nano_cpus,
                network_mode="host",  # Allow access to target URLs
                stdin_open=True,
                tty=False
            )
            
            # Pass configuration to container
            config_json = json.dumps(scan_config)
            container.exec_run(f"sh -c 'echo \'{config_json}\' > /tmp/config.json'")
            
            return container
            
        except Exception as e:
            self.logger.error(f"Failed to run container {container_name}: {e}")
            raise
    
    async def _monitor_container(
        self,
        container: docker.models.containers.Container,
        timeout: int,
        progress_callback: Optional[callable],
        scan_id: str
    ) -> int:
        """Monitor container execution and update progress"""
        
        start_time = asyncio.get_event_loop().time()
        
        # Progress simulation based on timeout
        progress_steps = [30, 45, 60, 75, 90]
        step_interval = timeout / len(progress_steps)
        next_step_time = start_time + step_interval
        step_index = 0
        
        while True:
            # Check container status
            try:
                container.reload()
                if container.status == "exited":
                    return container.attrs["State"]["ExitCode"]
                elif container.status not in ["running", "created"]:
                    # Container failed
                    return 1
            except Exception as e:
                self.logger.error(f"Error checking container status: {e}")
                return 1
            
            # Update progress
            current_time = asyncio.get_event_loop().time()
            if (progress_callback and step_index < len(progress_steps) and 
                current_time >= next_step_time):
                
                await progress_callback(
                    scan_id, 
                    progress_steps[step_index], 
                    f"{self.name} scanning in progress"
                )
                step_index += 1
                next_step_time += step_interval
            
            # Check timeout
            if current_time - start_time > timeout:
                container.stop(timeout=10)
                return 124  # Timeout exit code
            
            await asyncio.sleep(2)
    
    async def _get_container_logs(self, container: docker.models.containers.Container) -> str:
        """Get container logs for error reporting"""
        try:
            logs = container.logs(tail=50).decode('utf-8', errors='replace')
            return logs[-500:]  # Last 500 characters
        except Exception:
            return "Unable to retrieve container logs"
    
    async def _load_container_findings(self, scan_id: str) -> List[SecurityFinding]:
        """Load findings from container output"""
        result_dir = self.shared_results / scan_id
        
        # Try different possible output files
        possible_files = ["findings.json", "results.json", "output.json"]
        
        for filename in possible_files:
            findings_file = result_dir / filename
            if findings_file.exists():
                try:
                    with open(findings_file) as f:
                        data = json.load(f)
                    
                    # Handle different output formats
                    if isinstance(data, dict) and "findings" in data:
                        raw_findings = data["findings"]
                    elif isinstance(data, list):
                        raw_findings = data
                    else:
                        continue
                    
                    return self.normalize_findings(raw_findings)
                    
                except Exception as e:
                    self.logger.error(f"Error loading findings from {findings_file}: {e}")
                    continue
        
        return []
    
    def _normalize_single_finding(self, raw_finding: Dict) -> Optional[SecurityFinding]:
        """
        Normalize container finding to standard format
        This is a generic implementation - specific scanners may override
        """
        try:
            # Try to extract standard fields
            severity_map = {
                "CRITICAL": SeverityLevel.CRITICAL,
                "HIGH": SeverityLevel.HIGH,
                "MEDIUM": SeverityLevel.MEDIUM,
                "LOW": SeverityLevel.LOW,
                "INFO": SeverityLevel.INFO,
                "INFORMATIONAL": SeverityLevel.INFO
            }
            
            severity = severity_map.get(
                raw_finding.get("severity", "").upper(),
                SeverityLevel.MEDIUM
            )
            
            return SecurityFinding(
                id=raw_finding.get("id", f"container-{hash(str(raw_finding))}"),
                title=raw_finding.get("title", raw_finding.get("name", "Unknown Finding")),
                description=raw_finding.get("description", raw_finding.get("desc", "")),
                severity=severity,
                category=raw_finding.get("category", "unknown"),
                endpoint=raw_finding.get("endpoint", raw_finding.get("url", "")),
                method=raw_finding.get("method", "GET"),
                evidence=raw_finding.get("evidence"),
                remediation=raw_finding.get("remediation", raw_finding.get("solution")),
                references=raw_finding.get("references"),
                cvss_score=raw_finding.get("cvss_score"),
                cwe_id=raw_finding.get("cwe_id")
            )
        except Exception as e:
            self.logger.error(f"Error normalizing container finding: {e}")
            return None
    
    async def health_check(self) -> bool:
        """Check if container scanner is available"""
        try:
            # Check if Docker is available
            if not self.docker_client:
                return False
                
            self.docker_client.ping()
            
            # Check if scanner image exists
            try:
                self.docker_client.images.get(self.manifest["image"])
                return True
            except docker.errors.ImageNotFound:
                # Try to pull image
                try:
                    self.docker_client.images.pull(self.manifest["image"])
                    return True
                except:
                    return False
            
        except Exception as e:
            self.logger.error(f"Health check failed for {self.name}: {e}")
            return False