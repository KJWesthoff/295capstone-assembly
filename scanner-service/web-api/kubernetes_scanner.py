import os
import yaml
import json
import subprocess
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime
import uuid


class KubernetesScanner:
    def __init__(self):
        self.namespace = "ventiapi"
        # Check if we're running in Kubernetes
        self.in_k8s = os.path.exists('/var/run/secrets/kubernetes.io/serviceaccount')
        
    def _create_job_manifest(self, scan_id: str, spec_file: str, target_url: str, 
                           dangerous: bool = False, fuzz_auth: bool = False, 
                           rps: float = 1.0, max_requests: int = 100) -> Dict[str, Any]:
        """Create a Kubernetes Job manifest for scanning"""
        
        job_name = f"scanner-job-{scan_id[:8]}"
        
        # Build scanner command with conditional spec download
        local_spec_path = f"/shared/specs/spec_{scan_id[:8]}.json"
        
        # Determine if we need to download the spec or use existing file
        if spec_file and spec_file.startswith('/'):
            # Local file path - try to copy, but fallback to download if file doesn't exist
            copy_cmd = f"cp '{spec_file}' '{local_spec_path}' 2>/dev/null || python -c \"import urllib.request; urllib.request.urlretrieve('{target_url}/openapi.json', '{local_spec_path}')\""
            need_download = False
        elif spec_file and (spec_file.startswith('http://') or spec_file.startswith('https://')):
            # URL provided - download it
            download_cmd = f"python -c \"import urllib.request; urllib.request.urlretrieve('{spec_file}', '{local_spec_path}')\""
            need_download = True
        else:
            # No spec provided - download from target URL
            download_cmd = f"python -c \"import urllib.request; urllib.request.urlretrieve('{target_url}/openapi.json', '{local_spec_path}')\""
            need_download = True
        
        # Build the scanner command with flags
        scanner_cmd = f"python /app/venti_wrapper.py --spec {local_spec_path} --server {target_url} --rps {rps} --max-requests {max_requests}"
        
        if dangerous:
            scanner_cmd += " --dangerous"
            
        if fuzz_auth:
            scanner_cmd += " --fuzz-auth"
        
        # Build complete command based on whether download is needed
        if need_download:
            cmd = ["sh", "-c", f"{download_cmd} && {scanner_cmd}"]
        else:
            cmd = ["sh", "-c", f"{copy_cmd} && {scanner_cmd}"]
        
        job_manifest = {
            "apiVersion": "batch/v1",
            "kind": "Job",
            "metadata": {
                "name": job_name,
                "namespace": self.namespace,
                "labels": {
                    "app": "scanner-job",
                    "scan-id": scan_id
                }
            },
            "spec": {
                "ttlSecondsAfterFinished": 300,  # Clean up after 5 minutes
                "backoffLimit": 2,  # Only retry failed pods 2 times
                "template": {
                    "metadata": {
                        "labels": {
                            "app": "scanner-job",
                            "scan-id": scan_id
                        }
                    },
                    "spec": {
                        "restartPolicy": "Never",
                        "containers": [{
                            "name": "scanner",
                            "image": "ventiapi-scanner:latest",
                            "imagePullPolicy": "Never",
                            "command": cmd,
                            "env": [
                                {"name": "SCAN_ID", "value": scan_id},
                                {"name": "TARGET_URL", "value": target_url},
                                {"name": "SPEC_FILE", "value": spec_file or ""},
                                {"name": "PYTHONUNBUFFERED", "value": "1"}
                            ],
                            "resources": {
                                "requests": {"memory": "256Mi", "cpu": "250m"},
                                "limits": {"memory": "512Mi", "cpu": "500m"}
                            },
                            "volumeMounts": [
                                {"name": "shared-results", "mountPath": "/shared/results"},
                                {"name": "shared-specs", "mountPath": "/shared/specs"}
                            ]
                        }],
                        "volumes": [
                            {"name": "shared-results", "emptyDir": {}},
                            {"name": "shared-specs", "emptyDir": {}}
                        ]
                    }
                }
            }
        }
        
        return job_manifest
    
    async def create_scan_job(self, scan_id: str, spec_file: str, target_url: str, 
                            dangerous: bool = False, fuzz_auth: bool = False,
                            rps: float = 1.0, max_requests: int = 100) -> Dict[str, Any]:
        """Create a Kubernetes Job for scanning"""
        
        if not self.in_k8s:
            return {"status": "error", "error": "Not running in Kubernetes environment"}
        
        try:
            job_manifest = self._create_job_manifest(
                scan_id, spec_file, target_url, dangerous, fuzz_auth, rps, max_requests
            )
            
            # Write manifest to temp file
            manifest_path = f"/tmp/scanner-job-{scan_id[:8]}.yaml"
            with open(manifest_path, "w") as f:
                yaml.dump(job_manifest, f)
            
            # Apply the job
            process = await asyncio.create_subprocess_exec(
                "kubectl", "apply", "-f", manifest_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            # Clean up temp file
            try:
                os.remove(manifest_path)
            except:
                pass
            
            if process.returncode == 0:
                job_name = job_manifest["metadata"]["name"]
                return {"status": "success", "job_name": job_name}
            else:
                return {"status": "error", "error": stderr.decode()}
                
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    async def get_job_status(self, scan_id: str) -> Dict[str, Any]:
        """Get the status of a scanner job"""
        
        if not self.in_k8s:
            return {"status": "not_found"}
            
        try:
            job_name = f"scanner-job-{scan_id[:8]}"
            
            # Get job status
            process = await asyncio.create_subprocess_exec(
                "kubectl", "get", "job", job_name,
                "-n", self.namespace, "-o", "json",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                return {"status": "not_found"}
            
            job_data = json.loads(stdout.decode())
            status = job_data.get("status", {})
            
            # Determine job status
            if status.get("succeeded", 0) > 0:
                return {
                    "status": "completed",
                    "succeeded": status.get("succeeded", 0),
                    "failed": status.get("failed", 0),
                    "progress": 100
                }
            elif status.get("failed", 0) > 0:
                return {
                    "status": "failed",
                    "succeeded": status.get("succeeded", 0),
                    "failed": status.get("failed", 0),
                    "progress": 100
                }
            elif status.get("active", 0) > 0:
                return {
                    "status": "running",
                    "succeeded": status.get("succeeded", 0),
                    "failed": status.get("failed", 0),
                    "progress": 50
                }
            else:
                return {
                    "status": "pending",
                    "succeeded": status.get("succeeded", 0),
                    "failed": status.get("failed", 0),
                    "progress": 10
                }
                
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    async def get_job_logs(self, scan_id: str) -> Dict[str, Any]:
        """Get logs from a scanner job"""
        
        if not self.in_k8s:
            return {"status": "error", "error": "Not running in Kubernetes"}
            
        try:
            job_name = f"scanner-job-{scan_id[:8]}"
            
            # Get pod name for the job
            process = await asyncio.create_subprocess_exec(
                "kubectl", "get", "pods",
                "-l", f"job-name={job_name}",
                "-n", self.namespace,
                "--output=jsonpath={.items[0].metadata.name}",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                return {"status": "error", "error": "Pod not found"}
            
            pod_name = stdout.decode().strip()
            if not pod_name:
                return {"status": "error", "error": "No pod found"}
            
            # Get logs from pod
            process = await asyncio.create_subprocess_exec(
                "kubectl", "logs", pod_name,
                "-n", self.namespace,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                return {"status": "success", "logs": stdout.decode()}
            else:
                return {"status": "error", "error": stderr.decode()}
                
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    async def cleanup_job(self, scan_id: str) -> Dict[str, Any]:
        """Clean up the scanner job"""
        
        if not self.in_k8s:
            return {"status": "error", "error": "Not running in Kubernetes"}
            
        try:
            job_name = f"scanner-job-{scan_id[:8]}"
            
            process = await asyncio.create_subprocess_exec(
                "kubectl", "delete", "job", job_name,
                "-n", self.namespace,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                return {"status": "success"}
            else:
                return {"status": "error", "error": stderr.decode()}
                
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def is_kubernetes_available(self) -> bool:
        """Check if Kubernetes is available"""
        return self.in_k8s and os.path.exists('/usr/local/bin/kubectl')


# Create a global instance
k8s_scanner = KubernetesScanner()