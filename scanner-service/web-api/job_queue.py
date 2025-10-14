"""
Redis Job Queue Manager for Scanner Workers
Handles job distribution and result collection for Railway microservice architecture
"""

import os
import json
import uuid
import time
import redis
import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class ScanJobQueue:
    def __init__(self):
        self.redis_url = os.getenv('REDIS_URL', 'redis://redis:6379')  # Use Docker service name
        self.redis_client = None
        self.connected = False
        
    def connect(self):
        """Connect to Redis with retry logic"""
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            self.redis_client.ping()
            self.connected = True
            logger.info(f"✅ Connected to Redis job queue: {self.redis_url}")
            return True
        except Exception as e:
            logger.warning(f"⚠️  Failed to connect to Redis: {e}")
            self.connected = False
            return False
            
    def ensure_connected(self):
        """Ensure connection exists, try to connect if not"""
        if not self.connected:
            return self.connect()
        return True
            
    def create_scan_jobs(self, scan_id: str, spec_chunks: List[str], scan_params: Dict[str, Any]) -> List[str]:
        """Create multiple scan jobs for parallel processing"""
        if not self.ensure_connected():
            return []  # Return empty list if Redis not available
            
        job_ids = []
        
        for i, chunk_spec in enumerate(spec_chunks):
            chunk_id = f"{scan_id}_chunk_{i}"
            job_id = str(uuid.uuid4())
            
            # Save chunk spec to shared volume
            chunk_spec_path = f"/shared/specs/{chunk_id}_spec.yaml"
            
            # Job data for worker
            job_data = {
                'job_id': job_id,
                'scan_id': scan_id,
                'chunk_id': chunk_id,
                'spec_location': chunk_spec_path,
                'server_url': scan_params['server_url'],
                'dangerous': scan_params.get('dangerous', False),
                'fuzz_auth': scan_params.get('fuzz_auth', False),
                'rps': scan_params.get('rps', 1.0),
                'max_requests': scan_params.get('max_requests', 400),
                'created_at': time.time()
            }
            
            # Store job metadata
            self.redis_client.hset(f'scan_job:{job_id}', mapping={
                'status': 'queued',
                'job_data': json.dumps(job_data),
                'created_at': time.time(),
                'scan_id': scan_id,
                'chunk_id': chunk_id
            })
            
            # Add job to queue
            self.redis_client.lpush('scan_queue', json.dumps(job_data))
            
            job_ids.append(job_id)
            logger.info(f"📝 Created scan job: {job_id} for chunk {chunk_id}")
            
        return job_ids
        
    def create_single_scan_job(self, scan_id: str, scan_params: Dict[str, Any]) -> str:
        """Create a single scan job (no chunking)"""
        if not self.ensure_connected():
            return ""  # Return empty string if Redis not available
            
        job_id = str(uuid.uuid4())
        
        # Job data for worker
        job_data = {
            'job_id': job_id,
            'scan_id': scan_id,
            'chunk_id': scan_id,  # Use scan_id as chunk_id for single jobs
            'spec_location': scan_params.get('spec_location') or '',  # Empty for OpenAPI endpoint scans
            'server_url': scan_params['server_url'],
            'dangerous': scan_params.get('dangerous', False),
            'fuzz_auth': scan_params.get('fuzz_auth', False),
            'rps': scan_params.get('rps', 1.0),
            'max_requests': scan_params.get('max_requests', 400),
            'created_at': time.time()
        }
        
        # Store job metadata
        self.redis_client.hset(f'scan_job:{job_id}', mapping={
            'status': 'queued',
            'job_data': json.dumps(job_data),
            'created_at': time.time(),
            'scan_id': scan_id,
            'chunk_id': scan_id
        })
        
        # Add job to queue
        self.redis_client.lpush('scan_queue', json.dumps(job_data))
        
        logger.info(f"📝 Created single scan job: {job_id}")
        return job_id
        
    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get current status of a scan job"""
        try:
            job_data = self.redis_client.hgetall(f'scan_job:{job_id}')
            if not job_data:
                return {'status': 'not_found'}
                
            return {
                'job_id': job_id,
                'status': job_data.get('status', 'unknown'),
                'progress': int(job_data.get('progress', 0)),
                'phase': job_data.get('phase', 'Unknown'),
                'worker_id': job_data.get('worker_id'),
                'error': job_data.get('error'),
                'findings_count': int(job_data.get('findings_count', 0)),
                'created_at': float(job_data.get('created_at', 0)),
                'started_at': float(job_data.get('started_at', 0)) if job_data.get('started_at') else None,
                'completed_at': float(job_data.get('completed_at', 0)) if job_data.get('completed_at') else None
            }
        except Exception as e:
            logger.error(f"Failed to get job status for {job_id}: {e}")
            return {'status': 'error', 'error': str(e)}
            
    def get_scan_jobs_status(self, scan_id: str) -> List[Dict[str, Any]]:
        """Get status of all jobs for a scan"""
        job_statuses = []
        
        # Find all jobs for this scan
        for key in self.redis_client.scan_iter(match=f'scan_job:*'):
            job_data = self.redis_client.hgetall(key)
            if job_data.get('scan_id') == scan_id:
                job_id = key.split(':')[1]
                status = self.get_job_status(job_id)
                job_statuses.append(status)
                
        return sorted(job_statuses, key=lambda x: x.get('created_at', 0))
        
    def get_job_results(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get results from a completed job"""
        try:
            results_json = self.redis_client.get(f'scan_results:{job_id}')
            if results_json:
                return json.loads(results_json)
            return None
        except Exception as e:
            logger.error(f"Failed to get job results for {job_id}: {e}")
            return None
            
    def get_scan_results(self, scan_id: str) -> List[Dict[str, Any]]:
        """Get all results for a scan"""
        all_results = []
        
        # Get all job IDs for this scan
        job_statuses = self.get_scan_jobs_status(scan_id)
        
        for job_status in job_statuses:
            if job_status['status'] == 'completed':
                results = self.get_job_results(job_status['job_id'])
                if results:
                    all_results.append(results)
                    
        return all_results
        
    def get_queue_stats(self) -> Dict[str, int]:
        """Get queue statistics"""
        if not self.ensure_connected():
            return {'queue_length': 0, 'active_workers': 0, 'processing_workers': 0, 'waiting_workers': 0}
            
        try:
            queue_length = self.redis_client.llen('scan_queue')
            
            # Count active workers
            workers = self.redis_client.hgetall('scanner_workers')
            active_workers = 0
            processing_workers = 0
            
            for worker_data in workers.values():
                try:
                    worker_info = json.loads(worker_data)
                    active_workers += 1
                    if worker_info.get('status') == 'processing':
                        processing_workers += 1
                except:
                    continue
                    
            return {
                'queue_length': queue_length,
                'active_workers': active_workers,
                'processing_workers': processing_workers,
                'waiting_workers': active_workers - processing_workers
            }
        except Exception as e:
            logger.error(f"Failed to get queue stats: {e}")
            return {'queue_length': 0, 'active_workers': 0, 'processing_workers': 0, 'waiting_workers': 0}
            
    def cancel_scan_jobs(self, scan_id: str) -> int:
        """Cancel all jobs for a scan"""
        cancelled_count = 0
        
        # Find and cancel all jobs for this scan
        for key in self.redis_client.scan_iter(match=f'scan_job:*'):
            job_data = self.redis_client.hgetall(key)
            if job_data.get('scan_id') == scan_id:
                job_id = key.split(':')[1]
                
                # Update job status to cancelled
                self.redis_client.hset(f'scan_job:{job_id}', 'status', 'cancelled')
                cancelled_count += 1
                
        logger.info(f"🚫 Cancelled {cancelled_count} jobs for scan {scan_id}")
        return cancelled_count
        
    def cleanup_old_jobs(self, max_age_hours: int = 24):
        """Clean up old job data"""
        cutoff_time = time.time() - (max_age_hours * 3600)
        cleaned_count = 0
        
        # Clean up old job metadata
        for key in self.redis_client.scan_iter(match=f'scan_job:*'):
            job_data = self.redis_client.hgetall(key)
            created_at = float(job_data.get('created_at', 0))
            
            if created_at < cutoff_time:
                job_id = key.split(':')[1]
                
                # Delete job metadata and results
                self.redis_client.delete(key)
                self.redis_client.delete(f'scan_results:{job_id}')
                cleaned_count += 1
                
        # Clean up old worker registrations
        workers = self.redis_client.hgetall('scanner_workers')
        for worker_id, worker_data in workers.items():
            try:
                worker_info = json.loads(worker_data)
                last_update = float(worker_info.get('last_update', worker_info.get('started_at', 0)))
                
                if last_update < cutoff_time:
                    self.redis_client.hdel('scanner_workers', worker_id)
                    cleaned_count += 1
            except:
                continue
                
        if cleaned_count > 0:
            logger.info(f"🧹 Cleaned up {cleaned_count} old job records")
            
        return cleaned_count

# Global job queue instance
job_queue = ScanJobQueue()
# Note: Connection will be established on first use via ensure_connected()