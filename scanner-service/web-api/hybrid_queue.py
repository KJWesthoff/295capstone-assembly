"""
Hybrid Job Queue that falls back to direct Docker execution
Provides backward compatibility for development environments
"""

import os
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class HybridScanQueue:
    def __init__(self):
        self.redis_available = False
        self.job_queue = None
        
        # Try to initialize Redis job queue
        try:
            from job_queue import job_queue
            self.job_queue = job_queue
            self.redis_available = True
            logger.info("✅ Redis job queue available - using job queue mode")
        except Exception as e:
            logger.warning(f"⚠️  Redis not available, falling back to Docker mode: {e}")
            self.redis_available = False
    
    def is_job_queue_mode(self) -> bool:
        """Check if running in job queue mode"""
        return self.redis_available and self.job_queue is not None
    
    def create_scan_jobs(self, scan_id: str, spec_chunks: List[str], scan_params: Dict[str, Any]) -> List[str]:
        """Create scan jobs - use Redis if available, otherwise return empty list for Docker fallback"""
        if self.is_job_queue_mode():
            return self.job_queue.create_scan_jobs(scan_id, spec_chunks, scan_params)
        else:
            logger.info(f"📝 Docker mode: scan {scan_id} will use direct execution")
            return []  # Empty list indicates Docker mode
    
    def create_single_scan_job(self, scan_id: str, scan_params: Dict[str, Any]) -> Optional[str]:
        """Create single scan job - use Redis if available, otherwise return None for Docker fallback"""
        if self.is_job_queue_mode():
            return self.job_queue.create_single_scan_job(scan_id, scan_params)
        else:
            logger.info(f"📝 Docker mode: scan {scan_id} will use direct execution")
            return None  # None indicates Docker mode
    
    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get job status - only works in job queue mode"""
        if self.is_job_queue_mode() and job_id:
            return self.job_queue.get_job_status(job_id)
        else:
            return {'status': 'not_available'}
    
    def get_scan_jobs_status(self, scan_id: str) -> List[Dict[str, Any]]:
        """Get scan jobs status - only works in job queue mode"""
        if self.is_job_queue_mode():
            return self.job_queue.get_scan_jobs_status(scan_id)
        else:
            return []
    
    def get_scan_results(self, scan_id: str) -> List[Dict[str, Any]]:
        """Get scan results - only works in job queue mode"""
        if self.is_job_queue_mode():
            return self.job_queue.get_scan_results(scan_id)
        else:
            return []
    
    def get_queue_stats(self) -> Dict[str, int]:
        """Get queue statistics"""
        if self.is_job_queue_mode():
            return self.job_queue.get_queue_stats()
        else:
            return {
                'queue_length': 0,
                'active_workers': 0,
                'processing_workers': 0,
                'waiting_workers': 0,
                'mode': 'docker'
            }
    
    def cancel_scan_jobs(self, scan_id: str) -> int:
        """Cancel scan jobs - only works in job queue mode"""
        if self.is_job_queue_mode():
            return self.job_queue.cancel_scan_jobs(scan_id)
        else:
            return 0
    
    def cleanup_old_jobs(self, max_age_hours: int = 24) -> int:
        """Cleanup old jobs - only works in job queue mode"""
        if self.is_job_queue_mode():
            return self.job_queue.cleanup_old_jobs(max_age_hours)
        else:
            return 0

# Global hybrid queue instance
hybrid_queue = HybridScanQueue()