"""
AWS ECS Scanner Integration - replaces Docker commands with ECS RunTask
"""
import json
import os
from typing import Dict, List, Optional
import uuid
from datetime import datetime

try:
    import boto3
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False

class AWSECSScanner:
    """AWS ECS-based scanner that uses RunTask instead of Docker commands"""
    
    def __init__(self):
        self.available = False
        self.ecs_client = None
        
        if not BOTO3_AVAILABLE:
            print("WARNING: boto3 not available, AWS scanner disabled")
            return
            
        try:
            self.ecs_client = boto3.client('ecs', region_name=os.getenv('AWS_REGION', 'us-west-1'))
            self.cluster_name = os.getenv('ECS_CLUSTER_NAME', 'ventiapi-scanner-cluster')
            self.scanner_task_definition = os.getenv('SCANNER_TASK_DEFINITION', 'ventiapi-scanner:latest')
            self.subnet_ids = os.getenv('SUBNET_IDS', '').split(',')
            self.security_group_ids = os.getenv('SECURITY_GROUP_IDS', '').split(',')
            
            # Test AWS credentials by making a simple call
            try:
                self.ecs_client.list_clusters(maxResults=1)
                self.available = True
                print("AWS ECS Scanner initialized successfully")
            except Exception as e:
                print(f"WARNING: AWS credentials not available: {e}")
                self.ecs_client = None
        except Exception as e:
            print(f"WARNING: Failed to initialize AWS ECS client: {e}")
            self.ecs_client = None
        
    def run_scanner_task(self, scan_id: str, spec_url: str, server_url: str, 
                        output_path: str, rps: float = 1.0, max_requests: int = 100,
                        dangerous: bool = False) -> Dict:
        """
        Run scanner as ECS task instead of Docker container
        """
        if not self.available or not self.ecs_client:
            return {
                'success': False,
                'error': 'AWS ECS client not available',
                'scan_id': scan_id
            }
            
        try:
            # Create task override with scanner parameters
            container_overrides = {
                'name': 'ventiapi-scanner',
                'command': [
                    '--spec', spec_url,
                    '--server', server_url, 
                    '--out', output_path,
                    '--rps', str(rps),
                    '--max-requests', str(max_requests)
                ],
                'environment': [
                    {
                        'name': 'S3_BUCKET',
                        'value': os.getenv('S3_BUCKET', 'ventiapi-scanner-storage-712155057496')
                    },
                    {
                        'name': 'AWS_REGION',
                        'value': os.getenv('AWS_REGION', 'us-west-1')
                    }
                ]
            }
            
            if dangerous:
                container_overrides['command'].extend(['--dangerous'])
            
            # Run ECS task
            response = self.ecs_client.run_task(
                cluster=self.cluster_name,
                taskDefinition=self.scanner_task_definition,
                launchType='FARGATE',
                networkConfiguration={
                    'awsvpcConfiguration': {
                        'subnets': [s.strip() for s in self.subnet_ids if s.strip()],
                        'securityGroups': [sg.strip() for sg in self.security_group_ids if sg.strip()],
                        'assignPublicIp': 'ENABLED'
                    }
                },
                overrides={
                    'containerOverrides': [container_overrides]
                },
                tags=[
                    {
                        'key': 'scan_id',
                        'value': scan_id
                    },
                    {
                        'key': 'app',
                        'value': 'ventiapi-scanner'
                    }
                ]
            )
            
            if response.get('failures'):
                raise Exception(f"Task launch failed: {response['failures']}")
                
            task_arn = response['tasks'][0]['taskArn']
            return {
                'success': True,
                'task_arn': task_arn,
                'scan_id': scan_id
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'scan_id': scan_id
            }
    
    def get_task_status(self, task_arn: str) -> Dict:
        """Get status of ECS task"""
        if not self.available or not self.ecs_client:
            return {'status': 'ERROR', 'error': 'AWS ECS client not available'}
            
        try:
            response = self.ecs_client.describe_tasks(
                cluster=self.cluster_name,
                tasks=[task_arn]
            )
            
            if not response['tasks']:
                return {'status': 'NOT_FOUND'}
                
            task = response['tasks'][0]
            return {
                'status': task['lastStatus'],
                'desired_status': task['desiredStatus'],
                'created_at': task['createdAt'].isoformat() if 'createdAt' in task else None,
                'started_at': task['startedAt'].isoformat() if 'startedAt' in task else None,
                'stopped_at': task['stoppedAt'].isoformat() if 'stoppedAt' in task else None,
                'stop_reason': task.get('stoppedReason', ''),
                'health_status': task.get('healthStatus', 'UNKNOWN')
            }
            
        except Exception as e:
            return {'status': 'ERROR', 'error': str(e)}
    
    def stop_task(self, task_arn: str) -> bool:
        """Stop a running ECS task"""
        if not self.available or not self.ecs_client:
            return False
            
        try:
            self.ecs_client.stop_task(
                cluster=self.cluster_name,
                task=task_arn,
                reason='User requested stop'
            )
            return True
        except Exception:
            return False
    
    def list_running_scans(self) -> List[Dict]:
        """List all running scanner tasks"""
        if not self.available or not self.ecs_client:
            return []
            
        try:
            response = self.ecs_client.list_tasks(
                cluster=self.cluster_name,
                serviceName=None,
                desiredStatus='RUNNING'
            )
            
            if not response['taskArns']:
                return []
                
            # Get detailed task info
            tasks_response = self.ecs_client.describe_tasks(
                cluster=self.cluster_name,
                tasks=response['taskArns']
            )
            
            running_scans = []
            for task in tasks_response['tasks']:
                # Check if this is a scanner task by looking at tags
                tags_response = self.ecs_client.list_tags_for_resource(
                    resourceArn=task['taskArn']
                )
                
                scan_id = None
                for tag in tags_response.get('tags', []):
                    if tag['key'] == 'scan_id':
                        scan_id = tag['value']
                        break
                
                if scan_id:
                    running_scans.append({
                        'scan_id': scan_id,
                        'task_arn': task['taskArn'],
                        'status': task['lastStatus'],
                        'created_at': task['createdAt'].isoformat() if 'createdAt' in task else None
                    })
            
            return running_scans
            
        except Exception as e:
            print(f"Error listing running scans: {e}")
            return []

# Global scanner instance
aws_scanner = AWSECSScanner()

def get_aws_scanner_command(scan_id: str, spec_url: str, server_url: str, 
                           output_path: str, rps: float = 1.0, max_requests: int = 100,
                           dangerous: bool = False) -> Dict:
    """
    AWS ECS replacement for get_secure_docker_command
    Returns task execution result instead of Docker command
    """
    return aws_scanner.run_scanner_task(
        scan_id=scan_id,
        spec_url=spec_url, 
        server_url=server_url,
        output_path=output_path,
        rps=rps,
        max_requests=max_requests,
        dangerous=dangerous
    )