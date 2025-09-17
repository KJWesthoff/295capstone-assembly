#!/usr/bin/env python3
"""
Nuclei Scanner Wrapper
Standardized interface for Nuclei vulnerability scanner
"""
import json
import subprocess
import sys
import os
from pathlib import Path
from typing import Dict, List, Optional
import uuid


class NucleiWrapper:
    """Wrapper for Nuclei scanner to provide standardized interface"""
    
    def __init__(self):
        self.input_dir = Path("/input")
        self.output_dir = Path("/output")
        self.templates_dir = Path("/app/templates")
        self.nuclei_binary = "/usr/bin/nuclei"
    
    def health_check(self) -> Dict:
        """Health check endpoint"""
        try:
            # Check if nuclei binary exists and is executable
            if not Path(self.nuclei_binary).exists():
                return {
                    "status": "unhealthy",
                    "error": "Nuclei binary not found"
                }
            
            # Get nuclei version
            result = subprocess.run(
                [self.nuclei_binary, '-version'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                version = result.stdout.strip()
                return {
                    "status": "healthy",
                    "version": version,
                    "scanner": "nuclei",
                    "templates_available": self._count_templates()
                }
            else:
                return {
                    "status": "unhealthy",
                    "error": result.stderr or "Unknown error"
                }
                
        except subprocess.TimeoutExpired:
            return {
                "status": "unhealthy",
                "error": "Health check timed out"
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    def _count_templates(self) -> int:
        """Count available nuclei templates"""
        try:
            if self.templates_dir.exists():
                return len(list(self.templates_dir.rglob("*.yaml")))
            return 0
        except:
            return 0
    
    def scan(self, config: Dict) -> Dict:
        """Execute Nuclei scan with standardized configuration"""
        scan_id = config["scan_id"]
        target = config["target"]
        scan_config = config["config"]
        
        try:
            # Create output directory
            output_path = self.output_dir / scan_id
            output_path.mkdir(parents=True, exist_ok=True)
            
            # Build nuclei command
            cmd = self._build_nuclei_command(target, scan_config, output_path)
            
            print(f"Executing Nuclei scan: {' '.join(cmd)}")
            
            # Execute scan
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=scan_config.get("timeout", 300)
            )
            
            print(f"Nuclei exit code: {result.returncode}")
            print(f"Nuclei stdout: {result.stdout}")
            if result.stderr:
                print(f"Nuclei stderr: {result.stderr}")
            
            # Process results regardless of exit code (Nuclei returns non-zero when findings are found)
            return self._process_results(scan_id, output_path, result)
            
        except subprocess.TimeoutExpired:
            return {
                "scan_id": scan_id,
                "status": "failed",
                "error": f"Scan timed out after {scan_config.get('timeout', 300)} seconds",
                "findings": []
            }
        except Exception as e:
            return {
                "scan_id": scan_id,
                "status": "failed",
                "error": str(e),
                "findings": []
            }
    
    def _build_nuclei_command(self, target: Dict, config: Dict, output_path: Path) -> List[str]:
        """Build nuclei command with parameters"""
        findings_file = output_path / "findings.json"
        
        cmd = [
            self.nuclei_binary,
            "-target", target["url"],
            "-json",
            "-output", str(findings_file),
            "-templates", str(self.templates_dir),
            "-rate-limit", str(int(config.get("requests_per_second", 1))),
            "-bulk-size", str(min(config.get("max_requests", 100), 25)),  # Nuclei bulk size limit
            "-timeout", "10",  # Per-request timeout
            "-retries", "1",
            "-no-color",
            "-silent"  # Reduce verbose output
        ]
        
        # Add severity filters
        if config.get("dangerous_mode", False):
            cmd.extend(["-severity", "critical,high,medium,low,info"])
        else:
            cmd.extend(["-severity", "critical,high,medium"])
        
        # Add tags for API scanning if target type is API
        if target.get("target_type") == "api":
            cmd.extend(["-tags", "api,rest,graphql,jwt"])
        
        # Exclude some noisy/less relevant templates for faster scanning
        cmd.extend(["-exclude-tags", "fuzz,dos,intrusive"])
        
        return cmd
    
    def _process_results(self, scan_id: str, output_path: Path, result: subprocess.CompletedProcess) -> Dict:
        """Process Nuclei output to standard format"""
        findings_file = output_path / "findings.json"
        
        findings = []
        
        if findings_file.exists():
            try:
                # Nuclei outputs one JSON object per line
                with open(findings_file, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                nuclei_finding = json.loads(line)
                                finding = self._normalize_finding(nuclei_finding)
                                if finding:
                                    findings.append(finding)
                            except json.JSONDecodeError as e:
                                print(f"Error parsing Nuclei finding: {e}")
                                continue
                            
            except Exception as e:
                print(f"Error reading findings file: {e}")
        
        # Determine status
        if result.returncode == 0 or findings:
            status = "completed"
        else:
            status = "failed"
        
        return {
            "scan_id": scan_id,
            "status": status,
            "findings": findings,
            "metadata": {
                "scanner": "nuclei",
                "total_findings": len(findings),
                "exit_code": result.returncode,
                "templates_used": self._count_templates()
            }
        }
    
    def _normalize_finding(self, nuclei_finding: Dict) -> Optional[Dict]:
        """Convert Nuclei finding to standardized format"""
        try:
            info = nuclei_finding.get("info", {})
            
            # Map Nuclei severity to standard levels
            severity_map = {
                "critical": "CRITICAL",
                "high": "HIGH",
                "medium": "MEDIUM",
                "low": "LOW",
                "info": "INFO",
                "unknown": "INFO"
            }
            
            severity = severity_map.get(
                info.get("severity", "unknown").lower(),
                "MEDIUM"
            )
            
            # Extract matched URL and method
            matched_at = nuclei_finding.get("matched-at", "")
            method = "GET"  # Nuclei doesn't always specify method
            
            # Create evidence from nuclei-specific fields
            evidence = {
                "template_id": nuclei_finding.get("template-id"),
                "template_path": nuclei_finding.get("template-path"),
                "matcher_name": nuclei_finding.get("matcher-name"),
                "matched_at": matched_at,
                "extracted_results": nuclei_finding.get("extracted-results"),
                "curl_command": nuclei_finding.get("curl-command"),
                "type": nuclei_finding.get("type")
            }
            
            # Clean up None values
            evidence = {k: v for k, v in evidence.items() if v is not None}
            
            # Extract references
            references = []
            if "reference" in info:
                if isinstance(info["reference"], list):
                    references = info["reference"]
                else:
                    references = [info["reference"]]
            
            # Get CWE from classification
            classification = info.get("classification", {})
            cwe_id = None
            if "cwe-id" in classification:
                cwe_list = classification["cwe-id"]
                if isinstance(cwe_list, list) and cwe_list:
                    cwe_id = cwe_list[0]
                elif isinstance(cwe_list, str):
                    cwe_id = cwe_list
            
            return {
                "id": f"nuclei-{nuclei_finding.get('template-id', str(uuid.uuid4()))}",
                "title": info.get("name", "Nuclei Finding"),
                "description": info.get("description", ""),
                "severity": severity,
                "category": self._get_category_from_tags(info.get("tags", [])),
                "endpoint": matched_at,
                "method": method,
                "evidence": evidence,
                "remediation": info.get("remediation"),
                "references": references if references else None,
                "cvss_score": None,  # Nuclei doesn't provide CVSS scores
                "cwe_id": cwe_id
            }
            
        except Exception as e:
            print(f"Error normalizing Nuclei finding: {e}")
            return None
    
    def _get_category_from_tags(self, tags: List[str]) -> str:
        """Map Nuclei tags to security categories"""
        if not tags:
            return "unknown"
        
        # Priority mapping - check for specific categories first
        category_mappings = {
            "sqli": "injection",
            "xss": "xss",
            "ssrf": "injection", 
            "rce": "injection",
            "lfi": "injection",
            "auth-bypass": "auth",
            "jwt": "auth",
            "oauth": "auth",
            "disclosure": "disclosure",
            "exposure": "disclosure",
            "config": "config",
            "ssl": "crypto",
            "tls": "crypto",
            "redirect": "redirect",
            "cors": "cors"
        }
        
        # Check each tag against mappings
        for tag in tags:
            tag_lower = tag.lower()
            for pattern, category in category_mappings.items():
                if pattern in tag_lower:
                    return category
        
        # Default to first tag if no specific mapping found
        return tags[0] if tags else "unknown"


def main():
    """Main entry point"""
    wrapper = NucleiWrapper()
    
    # Handle health check
    if "--health-check" in sys.argv:
        health_result = wrapper.health_check()
        print(json.dumps(health_result))
        sys.exit(0 if health_result["status"] == "healthy" else 1)
    
    # Read scan configuration
    config = None
    
    # Try to read from config file first
    config_file = Path("/tmp/config.json")
    if config_file.exists():
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
        except Exception as e:
            print(f"Error reading config file: {e}", file=sys.stderr)
    
    # Fallback to stdin
    if config is None:
        try:
            config = json.load(sys.stdin)
        except Exception as e:
            print(f"Error reading config from stdin: {e}", file=sys.stderr)
            sys.exit(1)
    
    if not config:
        print("No configuration provided", file=sys.stderr)
        sys.exit(1)
    
    # Execute scan
    try:
        result = wrapper.scan(config)
        print(json.dumps(result))
        
        # Exit with appropriate code
        if result["status"] == "completed":
            sys.exit(0)
        else:
            sys.exit(1)
            
    except Exception as e:
        error_result = {
            "scan_id": config.get("scan_id", "unknown"),
            "status": "failed",
            "error": str(e),
            "findings": []
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()