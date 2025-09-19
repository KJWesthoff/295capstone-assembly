#!/usr/bin/env python3
"""
Railway Scanner Worker Service
Stateless worker that processes scan jobs from Redis queue
"""

import os
import sys
import json
import redis
import asyncio
import logging
import signal
import time
from pathlib import Path
from typing import Dict, Any

# Add scanner to path
sys.path.insert(0, '/app/scanner')

from scanner.core.spec_loader import load_spec
from scanner.runtime.http import HttpClient
from scanner.runtime.auth import AuthContext
from scanner.report.render import render

# Import probes
from scanner.probes import (
    bola as p_bola,
    auth_matrix as p_auth,
    ratelimit as p_rl,
    exposure as p_expo,
    mass_assign as p_mass,
    bfla as p_bfla,
    misconfig as p_misc,
    injection as p_inj,
    inventory as p_inv,
    logging as p_log
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - WORKER - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ScannerWorker:
    def __init__(self):
        self.redis_url = os.getenv('REDIS_URL', 'redis://redis:6379')
        self.worker_id = os.getenv('RAILWAY_REPLICA_ID', f'worker-{int(time.time())}')
        self.redis_client = None
        self.running = True
        
    def connect_redis(self):
        """Connect to Redis with retry logic"""
        max_retries = 10
        for attempt in range(max_retries):
            try:
                self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
                self.redis_client.ping()
                logger.info(f"✅ Connected to Redis: {self.redis_url}")
                return True
            except Exception as e:
                logger.warning(f"Redis connection attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                    
        logger.error("❌ Failed to connect to Redis after all retries")
        return False
        
    def register_worker(self):
        """Register this worker instance"""
        try:
            worker_info = {
                'worker_id': self.worker_id,
                'started_at': time.time(),
                'status': 'ready'
            }
            self.redis_client.hset('scanner_workers', self.worker_id, json.dumps(worker_info))
            self.redis_client.expire(f'scanner_workers', 3600)  # 1 hour TTL
            logger.info(f"📝 Registered worker: {self.worker_id}")
        except Exception as e:
            logger.error(f"Failed to register worker: {e}")
            
    def update_worker_status(self, status: str, job_id: str = None):
        """Update worker status in Redis"""
        try:
            worker_info = {
                'worker_id': self.worker_id,
                'status': status,
                'current_job': job_id,
                'last_update': time.time()
            }
            self.redis_client.hset('scanner_workers', self.worker_id, json.dumps(worker_info))
        except Exception as e:
            logger.error(f"Failed to update worker status: {e}")
            
    async def process_scan_job(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single scan job"""
        job_id = job_data.get('job_id')
        scan_id = job_data.get('scan_id')
        chunk_id = job_data.get('chunk_id')
        
        logger.info(f"🔍 Processing scan job: {job_id} (scan: {scan_id}, chunk: {chunk_id})")
        
        try:
            # Update job status to running
            self.redis_client.hset(f'scan_job:{job_id}', 'status', 'running')
            self.redis_client.hset(f'scan_job:{job_id}', 'worker_id', self.worker_id)
            self.redis_client.hset(f'scan_job:{job_id}', 'started_at', time.time())
            
            # Extract job parameters
            spec_location = job_data.get('spec_location')
            server_url = job_data.get('server_url')
            dangerous = job_data.get('dangerous', False)
            fuzz_auth = job_data.get('fuzz_auth', False)
            rps = job_data.get('rps', 1.0)
            max_requests = job_data.get('max_requests', 400)
            
            logger.info(f"📋 Job params: server={server_url}, dangerous={dangerous}, fuzz_auth={fuzz_auth}")
            
            # Load spec from shared volume
            spec_path = Path(spec_location)
            if not spec_path.exists():
                raise FileNotFoundError(f"Spec file not found: {spec_location}")
                
            spec = load_spec(str(spec_path))
            
            # Initialize HTTP client and auth context
            client = HttpClient(server_url, rps=rps, timeout=12.0, max_requests=max_requests)
            authctx = AuthContext(spec.security_schemes, fuzz_auth=fuzz_auth)
            
            # Run security probes
            logger.info("🚀 Starting security scanning...")
            findings = []
            
            # Update progress
            self.redis_client.hset(f'scan_job:{job_id}', 'progress', 10)
            self.redis_client.hset(f'scan_job:{job_id}', 'phase', 'Running authentication probes')
            
            # Core OWASP API Security Top 10 probes
            findings += await p_auth.run(spec, client, authctx, server_url, fuzz_auth=fuzz_auth)
            self.redis_client.hset(f'scan_job:{job_id}', 'progress', 20)
            
            findings += await p_bola.run(spec, client, authctx, server_url)
            self.redis_client.hset(f'scan_job:{job_id}', 'progress', 30)
            
            findings += await p_bfla.run(spec, client, authctx, server_url)
            self.redis_client.hset(f'scan_job:{job_id}', 'progress', 40)
            
            findings += await p_rl.run(spec, client, authctx, server_url)
            self.redis_client.hset(f'scan_job:{job_id}', 'progress', 50)
            
            findings += await p_expo.run(spec, client, authctx, server_url)
            self.redis_client.hset(f'scan_job:{job_id}', 'progress', 60)
            
            findings += await p_mass.run(spec, client, authctx, server_url, dangerous=dangerous)
            self.redis_client.hset(f'scan_job:{job_id}', 'progress', 70)
            
            # Extended probes
            self.redis_client.hset(f'scan_job:{job_id}', 'phase', 'Running extended security probes')
            
            findings += await p_misc.check_misconfiguration(client, spec, server_url)
            self.redis_client.hset(f'scan_job:{job_id}', 'progress', 80)
            
            findings += await p_inj.check_injection(client, spec, dangerous=dangerous)
            self.redis_client.hset(f'scan_job:{job_id}', 'progress', 90)
            
            findings += await p_inv.check_inventory(client, spec, server_url)
            findings += await p_log.check_logging(client, spec, server_url)
            
            # Close HTTP client
            await client.aclose()
            
            # Generate report
            output_dir = f"/shared/results/{chunk_id}"
            Path(output_dir).mkdir(parents=True, exist_ok=True)
            
            render(findings, spec, output_dir)
            
            # Store results in Redis
            result = {
                'job_id': job_id,
                'scan_id': scan_id,
                'chunk_id': chunk_id,
                'findings_count': len(findings),
                'findings': [f.__dict__ for f in findings],  # Serialize findings
                'output_dir': output_dir,
                'completed_at': time.time()
            }
            
            # Update job status
            self.redis_client.hset(f'scan_job:{job_id}', 'status', 'completed')
            self.redis_client.hset(f'scan_job:{job_id}', 'progress', 100)
            self.redis_client.hset(f'scan_job:{job_id}', 'completed_at', time.time())
            self.redis_client.hset(f'scan_job:{job_id}', 'findings_count', len(findings))
            
            # Store findings
            self.redis_client.set(f'scan_results:{job_id}', json.dumps(result), ex=3600)  # 1 hour TTL
            
            logger.info(f"✅ Completed scan job {job_id} with {len(findings)} findings")
            return result
            
        except Exception as e:
            logger.error(f"❌ Job {job_id} failed: {e}")
            
            # Update job status to failed
            self.redis_client.hset(f'scan_job:{job_id}', 'status', 'failed')
            self.redis_client.hset(f'scan_job:{job_id}', 'error', str(e))
            self.redis_client.hset(f'scan_job:{job_id}', 'failed_at', time.time())
            
            return {'error': str(e), 'job_id': job_id}
            
    def run(self):
        """Main worker loop"""
        logger.info(f"🚀 Starting Scanner Worker: {self.worker_id}")
        
        # Setup signal handlers
        signal.signal(signal.SIGTERM, self.shutdown)
        signal.signal(signal.SIGINT, self.shutdown)
        
        # Connect to Redis
        if not self.connect_redis():
            sys.exit(1)
            
        # Register worker
        self.register_worker()
        
        # Main processing loop
        while self.running:
            try:
                self.update_worker_status('waiting')
                
                # Block for up to 30 seconds waiting for a job
                job_data = self.redis_client.brpop('scan_queue', timeout=30)
                
                if job_data:
                    queue_name, job_json = job_data
                    job = json.loads(job_json)
                    job_id = job.get('job_id')
                    
                    self.update_worker_status('processing', job_id)
                    
                    # Process job
                    result = asyncio.run(self.process_scan_job(job))
                    
                    logger.info(f"📤 Job {job_id} completed")
                    
                else:
                    # No job received in timeout period
                    logger.debug("⏰ No jobs received, continuing to wait...")
                    
            except Exception as e:
                logger.error(f"❌ Worker error: {e}")
                time.sleep(5)  # Wait before retrying
                
        logger.info("👋 Scanner worker shutting down...")
        
    def shutdown(self, signum, frame):
        """Graceful shutdown handler"""
        logger.info(f"🛑 Received shutdown signal {signum}")
        self.running = False
        
        # Unregister worker
        if self.redis_client:
            try:
                self.redis_client.hdel('scanner_workers', self.worker_id)
                logger.info(f"📝 Unregistered worker: {self.worker_id}")
            except Exception as e:
                logger.error(f"Failed to unregister worker: {e}")

if __name__ == "__main__":
    worker = ScannerWorker()
    worker.run()