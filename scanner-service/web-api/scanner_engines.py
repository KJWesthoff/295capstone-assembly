"""
Multi-Scanner Engine Interface
Supports multiple scanning engines (VentiAPI, ZAP, etc.) running in parallel
"""

import asyncio
import json
import subprocess
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

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
        volume_prefix = options.get('volume_prefix', 'scannerapp')
        
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

            result = {
                "engine": self.name,
                "scan_id": scan_id,
                "status": "completed" if process.returncode == 0 else "failed",
                "return_code": process.returncode,
                "stdout": stdout.decode() if stdout else "",
                "stderr": stderr.decode() if stderr else "",
                "result_path": self.get_result_path(scan_id)
            }

            # Log result for debugging
            if process.returncode != 0:
                logger.error(f"VentiAPI scan failed with return code {process.returncode}")
                logger.error(f"stderr: {result['stderr'][:500]}")
            else:
                logger.info(f"✅ VentiAPI scan {scan_id} completed successfully")

            return result
            
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
        volume_prefix = options.get('volume_prefix', 'scannerapp')

        # ZAP result paths (inside container)
        zap_json_path = f'/zap/wrk/{scan_id}_zap.json'
        zap_html_path = f'/zap/wrk/{scan_id}_zap.html'

        cmd = [
            'docker', 'run', '--rm',
            '--network', 'host',
            '--memory', '1g',
            '--cpus', '1.0',
            '--security-opt', 'no-new-privileges',
            '-v', f'{volume_prefix}_shared-results:/zap/wrk/:rw',
            '-v', f'{volume_prefix}_shared-specs:/zap/specs:ro',
            f'--name', f'zap-scanner-{scan_id}',
            f'--label', f'scan_id={scan_id}',
            f'--label', 'app=zap-scanner',
            self.image
        ]

        # Determine target and format
        if spec_path:
            # Use API scan mode with OpenAPI spec
            # Convert host path to container path
            container_spec_path = spec_path.replace('/shared/specs', '/zap/specs')
            cmd.extend([
                '-t', container_spec_path,
                '-f', 'openapi'
            ])
        else:
            # Fallback: try to fetch OpenAPI spec from target URL
            spec_url = f"{target_url}/openapi.json"
            cmd.extend([
                '-t', spec_url,
                '-f', 'openapi'
            ])

        # Add report outputs
        cmd.extend([
            '-J', zap_json_path,
            '-r', zap_html_path
        ])

        # Add ZAP-specific options
        if options.get('debug', False):
            cmd.extend(['-d'])  # Debug mode

        if options.get('timeout', None):
            cmd.extend(['-T', str(options['timeout'])])  # Max time in minutes

        # Safe mode (passive scan only) - recommended for initial testing
        if options.get('safe_mode', True):
            cmd.extend(['-S'])

        return cmd
    
    async def scan(self, scan_id: str, spec_path: str, target_url: str,
                   options: Dict[str, Any]) -> Dict[str, Any]:
        """Execute ZAP scan"""
        cmd = self.get_docker_command(scan_id, spec_path, target_url, options)

        try:
            print(f"🕷️  Starting ZAP scan: {' '.join(cmd)}")
            logger.info(f"🕷️  Starting ZAP scan: {' '.join(cmd)}")

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()
            print(f"🕷️  ZAP scan completed with return code: {process.returncode}")
            print(f"🕷️  ZAP stdout: {stdout.decode()[:500] if stdout else 'No stdout'}")
            print(f"🕷️  ZAP stderr: {stderr.decode()[:500] if stderr else 'No stderr'}")
            
            # ZAP baseline scanner exit codes:
            # 0: No alerts found
            # 1: Low risk alerts found
            # 2: Medium risk alerts found  
            # 3: High risk alerts found
            # Any other code is a real failure
            zap_success = process.returncode in [0, 1, 2, 3]
            
            return {
                "engine": self.name,
                "scan_id": scan_id,
                "status": "completed" if zap_success else "failed",
                "return_code": process.returncode,
                "stdout": stdout.decode() if stdout else "",
                "stderr": stderr.decode() if stderr else "",
                "result_path": self.get_result_path(scan_id),
                "json_report": f"{self.get_result_path(scan_id)}.json",
                "html_report": f"{self.get_result_path(scan_id)}.html",
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

class NucleiScanner(ScannerEngine):
    """Nuclei Scanner Engine - Community-powered vulnerability scanner"""
    
    def __init__(self):
        super().__init__("nuclei")
        self.image = "projectdiscovery/nuclei:latest"
    
    def get_docker_command(self, scan_id: str, spec_path: str, target_url: str, 
                          options: Dict[str, Any]) -> List[str]:
        """Generate Nuclei scanner Docker command"""
        volume_prefix = options.get('volume_prefix', 'scannerapp')
        
        # Nuclei result paths (JSON output)
        nuclei_json_path = f'/app/results/{scan_id}_nuclei.json'
        
        cmd = [
            'docker', 'run', '--rm',
            '--network', 'host',
            '--memory', '512m',
            '--cpus', '0.5',
            '--security-opt', 'no-new-privileges',
            '-v', f'{volume_prefix}_shared-results:/app/results:rw',
            f'--name', f'nuclei-scanner-{scan_id}',
            f'--label', f'scan_id={scan_id}',
            f'--label', 'app=nuclei-scanner',
            self.image,
            '-target', target_url,
            '-json-export', nuclei_json_path,
            '-silent',  # Reduce output noise
            '-no-color'
        ]
        
        # Add severity filter
        severity = options.get('severity', 'critical,high,medium')
        if severity:
            cmd.extend(['-severity', severity])
            
        # Add template filters for API-specific vulnerabilities
        api_templates = options.get('api_templates', True)
        if api_templates:
            cmd.extend(['-tags', 'api,exposure,disclosure,jwt,sql'])
            
        # Rate limiting
        rate_limit = options.get('rate_limit', 150)
        if rate_limit:
            cmd.extend(['-rate-limit', str(rate_limit)])
            
        # Concurrency
        concurrency = options.get('concurrency', 25)
        if concurrency:
            cmd.extend(['-c', str(concurrency)])
            
        # Update templates before scanning
        if options.get('update_templates', True):
            cmd.extend(['-update-templates'])
            
        return cmd
    
    async def scan(self, scan_id: str, spec_path: str, target_url: str,
                   options: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Nuclei scan using on-demand Docker container"""

        try:
            # Parse endpoints from spec if available
            endpoints = await self._get_endpoints_from_spec(spec_path, target_url)

            if not endpoints:
                # Fallback to scanning just the base URL
                endpoints = [target_url]
                print(f"🧬 No spec endpoints found, scanning base URL only: {target_url}")
            else:
                print(f"🧬 Found {len(endpoints)} endpoints from spec to scan")

            all_findings = []

            # Scan each endpoint individually
            for idx, endpoint in enumerate(endpoints):
                full_url = endpoint if endpoint.startswith('http') else f"{target_url.rstrip('/')}{endpoint}"

                print(f"🧬 Scanning endpoint {idx+1}/{len(endpoints)}: {full_url}")

                # Generate command for this specific endpoint
                cmd = self.get_docker_command(f"{scan_id}_ep{idx}", spec_path, full_url, options)

                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )

                stdout, stderr = await process.communicate()

                # Parse results for this endpoint
                endpoint_findings = await self._parse_results(f"{scan_id}_ep{idx}", options.get('volume_prefix', 'scannerapp'))
                all_findings.extend(endpoint_findings)

                print(f"🧬 Endpoint {full_url}: {len(endpoint_findings)} findings (return code: {process.returncode})")

            # Save consolidated results
            await self._save_consolidated_results(scan_id, all_findings, options.get('volume_prefix', 'scannerapp'))

            print(f"🧬 Nuclei scan completed: {len(all_findings)} total findings from {len(endpoints)} endpoints")

            return {
                "engine": self.name,
                "scan_id": scan_id,
                "status": "completed",
                "return_code": 0,
                "result_path": self.get_result_path(scan_id),
                "findings": all_findings,
                "findings_count": len(all_findings),
                "endpoints_scanned": len(endpoints)
            }

        except Exception as e:
            logger.error(f"Nuclei scan failed: {e}")
            return {
                "engine": self.name,
                "scan_id": scan_id,
                "status": "failed",
                "error": str(e)
            }
    
    async def _parse_results(self, scan_id: str, volume_prefix: str) -> List[Dict[str, Any]]:
        """Parse Nuclei JSON results"""
        findings = []
        
        try:
            # Path to results file
            result_file = Path(f"/shared/results/{scan_id}_nuclei.json")
            
            if result_file.exists():
                with open(result_file, 'r') as f:
                    content = f.read().strip()
                    if content:
                        # Nuclei outputs JSONL format (one JSON object per line)
                        for line in content.split('\n'):
                            if line.strip():
                                try:
                                    finding = json.loads(line)
                                    # Convert to standard format
                                    parsed_finding = {
                                        "rule": finding.get("template-id", "unknown"),
                                        "title": finding.get("info", {}).get("name", "Unknown Vulnerability"),
                                        "severity": finding.get("info", {}).get("severity", "info").title(),
                                        "description": finding.get("info", {}).get("description", ""),
                                        "url": finding.get("matched-at", ""),
                                        "template": finding.get("template-id", ""),
                                        "scanner": "nuclei",
                                        "scanner_description": "Nuclei - Community-powered vulnerability scanner"
                                    }
                                    
                                    # Map severity to score
                                    severity_scores = {"Critical": 9, "High": 7, "Medium": 5, "Low": 3, "Info": 1}
                                    parsed_finding["score"] = severity_scores.get(parsed_finding["severity"], 1)
                                    
                                    findings.append(parsed_finding)
                                except json.JSONDecodeError:
                                    continue
                        
                logger.info(f"📊 Nuclei scan {scan_id}: {len(findings)} findings")
            
        except Exception as e:
            logger.error(f"Error parsing Nuclei results for {scan_id}: {e}")

        return findings

    async def _get_endpoints_from_spec(self, spec_path: str, target_url: str) -> List[str]:
        """Parse OpenAPI spec to extract endpoint paths"""
        endpoints = []

        try:
            if not spec_path:
                return []

            # Convert container path to host path
            # spec_path is like "/shared/specs/abc123_openapi.json"
            # We need to check if it exists on the host filesystem
            if spec_path.startswith('/shared/specs/'):
                # Extract just the filename and reconstruct the path
                filename = spec_path.split('/')[-1]
                local_spec_path = Path(f"/shared/specs/{filename}")
            else:
                local_spec_path = Path(spec_path)

            if not local_spec_path.exists():
                logger.warning(f"Spec file not found: {local_spec_path}")
                return []

            # Read and parse spec file
            with open(local_spec_path, 'r') as f:
                spec_content = f.read()

            # Try JSON first, then YAML
            try:
                spec_data = json.loads(spec_content)
            except json.JSONDecodeError:
                import yaml
                spec_data = yaml.safe_load(spec_content)

            # Extract paths
            if 'paths' in spec_data:
                endpoints = list(spec_data['paths'].keys())
                logger.info(f"📋 Extracted {len(endpoints)} endpoints from spec")

        except Exception as e:
            logger.error(f"Error parsing spec for endpoints: {e}")

        return endpoints

    async def _save_consolidated_results(self, scan_id: str, findings: List[Dict[str, Any]], volume_prefix: str):
        """Save consolidated findings from all endpoint scans to a single file"""
        try:
            result_file = Path(f"/shared/results/{scan_id}_nuclei.json")

            # Convert findings to JSONL format (Nuclei's output format)
            with open(result_file, 'w') as f:
                for finding in findings:
                    # Convert back to Nuclei's original format for consistency
                    nuclei_format = {
                        "template-id": finding.get("rule", finding.get("template", "unknown")),
                        "info": {
                            "name": finding.get("title", "Unknown"),
                            "severity": finding.get("severity", "info").lower(),
                            "description": finding.get("description", "")
                        },
                        "matched-at": finding.get("url", ""),
                        "type": "http"
                    }
                    f.write(json.dumps(nuclei_format) + '\n')

            logger.info(f"💾 Saved {len(findings)} consolidated Nuclei findings to {result_file}")

        except Exception as e:
            logger.error(f"Error saving consolidated Nuclei results: {e}")

class MultiScannerManager:
    """Manages multiple scanner engines"""
    
    def __init__(self):
        self.engines = {
            'ventiapi': VentiAPIScanner(),
            'zap': ZAPScanner()
        }
        
        # Add Nuclei scanner if available (conditional)
        try:
            self.engines['nuclei'] = NucleiScanner()
            logger.info("✅ Nuclei scanner enabled")
        except Exception as e:
            logger.warning(f"⚠️ Nuclei scanner disabled: {e}")
        
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

        print(f"🚀 Starting parallel scan with engines: {engines}")
        print(f"🔧 Scan parameters: spec_path={spec_path}, target_url={target_url}")
        logger.info(f"🚀 Starting parallel scan with engines: {engines}")

        # Create scan tasks for each engine
        tasks = []
        for engine_name in engines:
            engine = self.engines[engine_name]
            print(f"📍 Creating scan task for {engine_name}")
            task = asyncio.create_task(
                engine.scan(scan_id, spec_path, target_url, options),
                name=f"{engine_name}-{scan_id}"
            )
            tasks.append(task)

        print(f"⏳ Waiting for {len(tasks)} scanner tasks to complete...")
        # Wait for all scans to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
        print(f"✅ All {len(results)} scanner tasks completed")
        
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