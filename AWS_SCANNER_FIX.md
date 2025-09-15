# AWS Scanner Fix - Docker Daemon Issue

## Problem Identified ❌

Your AWS deployment is failing because:

**Issue**: ECS Fargate containers don't have access to Docker daemon
**Error**: `docker: Cannot connect to the Docker daemon at unix:///var/run/docker.sock`

The local fixes work perfectly, but AWS ECS Fargate doesn't support Docker-in-Docker.

## Current Status ✅

Good news! Your other fixes are working:

- ✅ **Frontend**: Deployed and serving correctly
- ✅ **Backend API**: Deployed and responding  
- ✅ **Authentication**: Working (MICS295/MaryMcHale)
- ✅ **API Routing**: ALB routes frontend and /api/* correctly
- ✅ **Environment**: All secrets and config loaded

**Only the scanner execution fails** due to Docker daemon access.

## Solutions Available

### Option 1: ECS Task-based Scanning (Recommended)
Instead of Docker-in-Docker, use ECS RunTask API to launch scanner containers:

```python
# Replace docker command with ECS RunTask
aws_ecs = boto3.client('ecs')
response = aws_ecs.run_task(
    cluster='ventiapi-scanner-cluster',
    taskDefinition='ventiapi-scanner:latest',
    overrides={
        'containerOverrides': [{
            'name': 'scanner',
            'command': [
                '--spec', spec_url,
                '--server', server_url,
                '--out', output_path,
                '--rps', str(rps),
                '--max-requests', str(max_requests)
            ]
        }]
    }
)
```

### Option 2: EC2 with Docker (Alternative)
Deploy backend to EC2 instances instead of Fargate to have Docker access.

### Option 3: Lambda + Step Functions (Advanced)
Use serverless architecture for scanner execution.

## Quick Fix Implementation

The fastest solution is to modify the backend to use ECS tasks instead of Docker commands.

**Files to modify:**
- `scanner-service/web-api/security.py` - Replace Docker commands with ECS RunTask
- Add IAM permissions for ECS task management
- Update task definition for scanner

## Test Commands

Your deployment is working for everything except scanning:

```bash
# ✅ These work:
curl http://ventiapi-scanner-alb-610630590.us-west-1.elb.amazonaws.com/
curl -X POST http://ventiapi-scanner-alb-610630590.us-west-1.elb.amazonaws.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"MICS295","password":"MaryMcHale"}'

# ❌ This fails at scanner execution:
# Scan creation works, but scanner can't access Docker daemon
```

## Next Steps

1. **Option A**: Implement ECS task-based scanning (recommended)
2. **Option B**: Accept that scanning works locally, demo from local version
3. **Option C**: Migrate to EC2 deployment for Docker access

Your local implementation is perfect! The AWS issue is purely infrastructure-related.