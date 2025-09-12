# VentiAPI Scanner - Full-Stack API Security Testing Platform

A complete full-stack application for scanning APIs for security vulnerabilities using parallel processing and real-time progress tracking.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐
│   Frontend      │    │   Web API       │    │   Scanner Cluster   │
│   (React +      │◄──►│   (FastAPI +    │◄──►│   (VentiAPI)        │
│   TanStack      │    │   Parallel      │    │   Parallel          │
│   Query)        │    │   Processing)   │    │   Containers        │
│   Port: 3000    │    │   Port: 8000    │    │   Dynamic Scaling   │
└─────────────────┘    └─────────────────┘    └─────────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │     Redis       │
                       │   (Cache/Queue) │
                       │   Port: 6379    │
                       └─────────────────┘
```

## ✨ Key Features

### 🚀 **Performance Optimized**
- **Parallel Scanning**: Automatically splits large API specs into chunks and runs multiple containers concurrently
- **Smart Probe Grouping**: Groups compatible security probes to avoid conflicts while maximizing parallelism
- **Real-time Progress**: Live updates with TanStack Query showing individual container progress

### 🔍 **Comprehensive Security Testing** 
- **OWASP API Top 10** complete coverage (API1-API10)
- **Static & Active Probes**: Both specification analysis and runtime testing
- **Severity Classification**: Critical, High, Medium, Low with detailed scoring
- **Professional Reports**: HTML reports with embedded CSS and findings breakdown

### 💻 **Modern Full-Stack**
- **React 19 + TypeScript**: Modern frontend with type safety
- **FastAPI Backend**: High-performance async Python API
- **Docker Orchestration**: Complete containerized deployment
- **Redis Caching**: Optimized performance and job queuing

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Git with submodule support

### 1. Clone and Setup
```bash
git clone <your-repo-url>
cd ScannerApp
git submodule update --init --recursive
```

### 2. Start the Full Stack
```bash
docker compose up --build
```

### 3. Access the Application
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs
- **Redis:** localhost:6379

## 📁 Project Structure

```
ScannerApp/
├── docker-compose.yml              # Full-stack orchestration
├── frontend/                       # React TypeScript app
│   ├── src/
│   │   ├── api/                   # TanStack Query API client
│   │   ├── components/            # React components
│   │   │   ├── ApiScanner.tsx     # Main scanning interface
│   │   │   ├── Report.tsx         # Results display with real-time updates
│   │   │   └── ParallelScanProgress.tsx  # Parallel progress visualization
│   │   └── ...
│   ├── Dockerfile                 # Multi-stage production build
│   ├── nginx.conf                 # Production web server config
│   └── package.json
├── external-scanner/               # VentiAPI Scanner (Git Submodule)
│   └── ventiapi-scanner/          # External scanner engine
│       ├── scanner/               # Core security probes
│       │   ├── probes/           # API1-API10 security tests
│       │   ├── core/             # Scanner framework
│       │   └── report/           # HTML report generation
│       └── templates/            # Report templates
├── scanner-service/                # Custom backend services
│   └── web-api/                   # FastAPI backend
│       ├── main.py               # API endpoints + parallel orchestration
│       ├── Dockerfile            # Web API container
│       └── requirements.txt
└── README.md                      # This file
```

## 🔧 Advanced Features

### Real-Time Progress Tracking
- **TanStack Query Integration**: Automatic polling every 2 seconds during scans
- **Parallel Container Monitoring**: Individual progress for each scan chunk
- **Phase Tracking**: "Running auth probes", "Running scan probes", etc.
- **Smart Polling**: Automatically stops when scan completes

### Intelligent Scan Optimization
- **Endpoint Chunking**: Splits large APIs into 4-endpoint chunks for parallel processing
- **Probe Grouping**: 
  - **Auth Group**: Authentication-related probes (may interact)
  - **Scan Group**: Read-only probes (safe parallel execution)
  - **Dangerous Group**: Intrusive probes (optional, run separately)
- **Result Merging**: Aggregates findings from all parallel containers

### Professional Reporting
- **Dual Format**: JSON findings + HTML reports
- **Embedded Styling**: Self-contained HTML with CSS
- **Severity Breakdown**: Visual summary with color-coded severity levels
- **Downloadable Reports**: Direct browser download via API

## 🔍 API Endpoints

### Core Scan Management
```bash
# Start a new scan
POST /api/scan/start
  - Form data: spec_file, server_url, target_url, dangerous, rps, max_requests

# Real-time status with parallel info
GET /api/scan/{scan_id}/status
  Response includes: progress, current_phase, chunk_status[], parallel_mode

# Get paginated findings
GET /api/scan/{scan_id}/findings?offset=0&limit=50

# Download HTML report
GET /api/scan/{scan_id}/report

# List all scans
GET /api/scans

# Delete scan and cleanup
DELETE /api/scan/{scan_id}
```

### Example Usage
```bash
# Start a parallel scan
curl -X POST "http://localhost:8000/api/scan/start" \
  -F "server_url=https://your-api.com" \
  -F "target_url=https://your-api.com" \
  -F "spec_file=@openapi.yml" \
  -F "dangerous=false" \
  -F "rps=2.0"

# Monitor real-time progress
curl "http://localhost:8000/api/scan/{scan_id}/status"

# Download professional HTML report
curl "http://localhost:8000/api/scan/{scan_id}/report" -o security_report.html
```

## ☁️ AWS Deployment Guide

### Option 1: ECS with Application Load Balancer (Recommended)

#### Prerequisites
```bash
# Install AWS CLI and configure
aws configure

# Install ECS CLI
curl -Lo ecs-cli https://amazon-ecs-cli.s3.amazonaws.com/ecs-cli-linux-amd64-latest
sudo chmod +x ./ecs-cli && sudo mv ./ecs-cli /usr/local/bin

# Install Docker
sudo apt-get update && sudo apt-get install -y docker.io
sudo usermod -aG docker $USER
```

#### 1. Create ECS Infrastructure
```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name ventiapi-cluster

# Create task execution role
aws iam create-role --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file://ecs-trust-policy.json

aws iam attach-role-policy --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

Create `ecs-trust-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

#### 2. Build and Push Container Images
```bash
# Create ECR repositories
aws ecr create-repository --repository-name ventiapi-frontend
aws ecr create-repository --repository-name ventiapi-web-api
aws ecr create-repository --repository-name ventiapi-scanner

# Get login token
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and push images
docker build -t ventiapi-frontend ./frontend
docker tag ventiapi-frontend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/ventiapi-frontend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/ventiapi-frontend:latest

docker build -t ventiapi-web-api ./scanner-service/web-api
docker tag ventiapi-web-api:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/ventiapi-web-api:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/ventiapi-web-api:latest

docker build -t ventiapi-scanner ./external-scanner/ventiapi-scanner
docker tag ventiapi-scanner:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/ventiapi-scanner:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/ventiapi-scanner:latest
```

#### 3. Create ECS Task Definition
Create `task-definition.json`:
```json
{
  "family": "ventiapi-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096",
  "executionRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "redis",
      "image": "redis:7-alpine",
      "memory": 512,
      "portMappings": [{"containerPort": 6379}]
    },
    {
      "name": "web-api",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/ventiapi-web-api:latest",
      "memory": 2048,
      "portMappings": [{"containerPort": 8000}],
      "environment": [
        {"name": "PYTHONUNBUFFERED", "value": "1"}
      ],
      "dependsOn": [{"containerName": "redis", "condition": "START"}],
      "mountPoints": [
        {
          "sourceVolume": "docker-socket",
          "containerPath": "/var/run/docker.sock"
        }
      ]
    },
    {
      "name": "frontend",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/ventiapi-frontend:latest",
      "memory": 512,
      "portMappings": [{"containerPort": 80}],
      "environment": [
        {"name": "REACT_APP_API_URL", "value": "http://<your-alb-url>:8000"}
      ],
      "dependsOn": [{"containerName": "web-api", "condition": "START"}]
    }
  ],
  "volumes": [
    {
      "name": "docker-socket",
      "host": {
        "sourcePath": "/var/run/docker.sock"
      }
    }
  ]
}
```

#### 4. Deploy to ECS
```bash
# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create ECS service with ALB
aws ecs create-service \
  --cluster ventiapi-cluster \
  --service-name ventiapi-service \
  --task-definition ventiapi-task:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}"
```

### Option 2: EC2 with Docker Compose (Simpler)

#### 1. Launch EC2 Instance
```bash
# Create key pair
aws ec2 create-key-pair --key-name ventiapi-key --query 'KeyMaterial' --output text > ventiapi-key.pem
chmod 400 ventiapi-key.pem

# Launch instance
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --count 1 \
  --instance-type t3.large \
  --key-name ventiapi-key \
  --security-group-ids sg-12345 \
  --subnet-id subnet-12345 \
  --associate-public-ip-address
```

#### 2. Setup Instance
```bash
# SSH to instance
ssh -i ventiapi-key.pem ec2-user@<public-ip>

# Install Docker & Docker Compose
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
sudo yum install -y git
```

#### 3. Deploy Application
```bash
# Clone repository
git clone <your-repo-url>
cd ScannerApp
git submodule update --init --recursive

# Update environment for production
export REACT_APP_API_URL=http://<public-ip>:8000

# Start services
docker-compose up -d --build

# Verify deployment
curl http://<public-ip>:8000/docs
curl http://<public-ip>:3000
```

### Option 3: Kubernetes with EKS (Advanced)

#### 1. Create EKS Cluster
```bash
# Install eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Create cluster
eksctl create cluster \
  --name ventiapi-cluster \
  --version 1.27 \
  --region us-east-1 \
  --nodegroup-name workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 4 \
  --managed
```

#### 2. Create Kubernetes Manifests

Create `k8s/namespace.yaml`:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ventiapi
```

Create `k8s/redis.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: ventiapi
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: ventiapi
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

Create `k8s/web-api.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api
  namespace: ventiapi
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-api
  template:
    metadata:
      labels:
        app: web-api
    spec:
      containers:
      - name: web-api
        image: <account-id>.dkr.ecr.us-east-1.amazonaws.com/ventiapi-web-api:latest
        ports:
        - containerPort: 8000
        env:
        - name: PYTHONUNBUFFERED
          value: "1"
        volumeMounts:
        - name: docker-socket
          mountPath: /var/run/docker.sock
      volumes:
      - name: docker-socket
        hostPath:
          path: /var/run/docker.sock
---
apiVersion: v1
kind: Service
metadata:
  name: web-api
  namespace: ventiapi
spec:
  selector:
    app: web-api
  ports:
  - port: 8000
    targetPort: 8000
  type: LoadBalancer
```

Create `k8s/frontend.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: ventiapi
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: <account-id>.dkr.ecr.us-east-1.amazonaws.com/ventiapi-frontend:latest
        ports:
        - containerPort: 80
        env:
        - name: REACT_APP_API_URL
          value: "http://<web-api-load-balancer-url>:8000"
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: ventiapi
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
```

#### 3. Deploy to Kubernetes
```bash
# Apply manifests
kubectl apply -f k8s/

# Get services
kubectl get services -n ventiapi

# Get external IPs
kubectl get services -n ventiapi -o wide
```

## 🔒 Production Security Considerations

### Network Security
- Use VPC with private subnets for backend services
- Configure security groups to allow only necessary traffic
- Enable AWS WAF for frontend protection

### Secrets Management
- Use AWS Secrets Manager or Parameter Store for sensitive data
- Never commit credentials to version control
- Rotate API keys and certificates regularly

### Monitoring & Logging
```bash
# CloudWatch integration
aws logs create-log-group --log-group-name /ecs/ventiapi

# Application monitoring
docker run -d --name prometheus prom/prometheus
docker run -d --name grafana grafana/grafana
```

### SSL/TLS Configuration
```bash
# Get SSL certificate from ACM
aws acm request-certificate --domain-name your-domain.com
```

## 🛠️ Development & Testing

### Local Development
```bash
# Frontend only
cd frontend && npm start

# Backend only (with hot reload)
cd scanner-service/web-api && uvicorn main:app --reload --host 0.0.0.0

# Scanner only
cd external-scanner/ventiapi-scanner && python -m scanner.cli --help
```

### Git Submodule Management
```bash
# Update to latest external scanner
git submodule update --remote external-scanner

# Commit submodule updates
git add external-scanner && git commit -m "Update scanner to latest version"

# For new clones
git submodule update --init --recursive
```

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Backend API URL | `http://localhost:8000` |
| `PYTHONUNBUFFERED` | Python output buffering | `1` |

## 📊 Performance & Scaling

### Current Capabilities
- **Parallel Processing**: 3x faster scanning with automatic endpoint chunking
- **Container Scaling**: Dynamic scanner container creation
- **Real-time Updates**: 2-second polling with smart query management
- **Memory Efficient**: Streaming results, minimal persistent storage

### Scaling Considerations
- **Horizontal Scaling**: Add more ECS tasks or K8s pods
- **Redis Clustering**: For high-concurrency scenarios  
- **Database Integration**: Replace in-memory storage with RDS/DynamoDB
- **CDN Integration**: CloudFront for static assets

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test locally: `docker compose up --build`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Submit a pull request

### Development Workflow
- Follow TypeScript best practices
- Use TanStack Query for all API state management
- Test with real vulnerable APIs (VAmPI included)
- Update documentation for new features

## 📄 License

MIT License - see LICENSE file for details.

## 🎯 Supported Vulnerability Types

### OWASP API Security Top 10
- **API1**: Broken Object Level Authorization (BOLA)
- **API2**: Broken User Authentication  
- **API3**: Excessive Data Exposure
- **API4**: Lack of Resources & Rate Limiting
- **API5**: Broken Function Level Authorization (BFLA)
- **API6**: Mass Assignment
- **API7**: Security Misconfiguration
- **API8**: Injection Flaws
- **API9**: Improper Assets Management
- **API10**: Insufficient Logging & Monitoring

### Advanced Features
- **Rate Limiting Detection**: Configurable RPS testing
- **Authentication Fuzzing**: Token manipulation and bypass attempts
- **Dangerous Mode**: Intrusive testing with data modification
- **Custom Payloads**: Extensible probe system

---

**Built with ❤️ for API Security**