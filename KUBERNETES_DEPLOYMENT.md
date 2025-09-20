# Kubernetes Deployment Guide
## VentiAPI Scanner - Production-Ready Container Orchestration

This guide will help you deploy the VentiAPI Scanner to Kubernetes with proper container orchestration, auto-scaling, and job-based scanning.

## Quick Start (2 minutes)

```bash
# 1. One-command deployment
./kubernetes_deploy.sh

# 2. Access application
# Frontend: http://localhost:3000
# API: http://localhost:8000
# Credentials: MICS295 / MaryMcHale
```

**That's it!** The script automatically:
- ✅ Checks prerequisites (Docker, kubectl, k3d)
- ✅ Creates k3d cluster with proper port mappings
- ✅ Builds and imports Docker images
- ✅ Creates Kubernetes manifests
- ✅ Deploys to cluster
- ✅ Verifies health checks
- ✅ Shows access information

## Manual Setup (if you prefer step-by-step)

```bash
# 1. Setup local Kubernetes
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
k3d cluster create ventiapi-local --port "3000:30000@agent:0" --port "8000:30001@agent:0" --agents 2

# 2. Build and import images
docker build -t ventiapi-frontend:latest ./frontend
docker build -t ventiapi-web-api:latest ./scanner-service/web-api
docker build -t ventiapi-scanner:latest -f scanner.Dockerfile .
k3d image import ventiapi-frontend:latest ventiapi-web-api:latest ventiapi-scanner:latest --cluster ventiapi-local

# 3. Deploy everything
kubectl apply -f kubernetes/base/

# 4. Access application
echo "Application ready at: http://localhost:3000"
```

## Prerequisites

- Docker installed and running
- kubectl installed
- Choice of Kubernetes cluster (local or cloud)

## Part 1: Local Development Setup

### Install Tools

**macOS:**
```bash
# Install required tools
brew install kubectl k3d helm

# Optional: k9s for cluster management
brew install k9s
```

**Linux:**
```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install k3d
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

# Install helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### Create Local Cluster

```bash
# Create k3d cluster with port forwarding
k3d cluster create ventiapi-local \
  --port "3000:80@loadbalancer" \
  --port "6443:6443@server:0" \
  --agents 2

# Verify cluster
kubectl get nodes
kubectl cluster-info
```

## Part 2: Kubernetes Manifests

### Create Kubernetes Directory Structure

```bash
mkdir -p kubernetes/{base,overlays/{local,production}}
```

Let's create the manifests:

### 1. Namespace

```bash
cat > kubernetes/base/namespace.yaml << 'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: ventiapi
  labels:
    name: ventiapi
    app.kubernetes.io/name: ventiapi-scanner
EOF
```

### 2. ConfigMap for Environment Variables

```bash
cat > kubernetes/base/configmap.yaml << 'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: ventiapi-config
  namespace: ventiapi
data:
  REDIS_URL: "redis://redis:6379"
  PYTHONUNBUFFERED: "1"
  SCANNER_MAX_PARALLEL_CONTAINERS: "5"
  SCANNER_CONTAINER_MEMORY_LIMIT: "512m"
EOF
```

### 3. Secret for Sensitive Data

```bash
cat > kubernetes/base/secret.yaml << 'EOF'
apiVersion: v1
kind: Secret
metadata:
  name: ventiapi-secrets
  namespace: ventiapi
type: Opaque
data:
  # Base64 encoded values - replace with your actual values
  # echo -n "your-jwt-secret" | base64
  JWT_SECRET: eW91ci1qd3Qtc2VjcmV0
  # echo -n "admin" | base64  
  DEFAULT_ADMIN_USERNAME: YWRtaW4=
  # echo -n "your-secure-password" | base64
  DEFAULT_ADMIN_PASSWORD: eW91ci1zZWN1cmUtcGFzc3dvcmQ=
EOF
```

### 4. Redis Deployment

```bash
cat > kubernetes/base/redis.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: ventiapi
  labels:
    app: redis
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
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        volumeMounts:
        - name: redis-data
          mountPath: /data
      volumes:
      - name: redis-data
        emptyDir: {}
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
EOF
```

### 5. Web API Deployment

```bash
cat > kubernetes/base/web-api.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api
  namespace: ventiapi
  labels:
    app: web-api
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
        image: ventiapi-web-api:latest
        imagePullPolicy: Never  # For local development
        ports:
        - containerPort: 8000
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: ventiapi-secrets
              key: JWT_SECRET
        - name: DEFAULT_ADMIN_USERNAME
          valueFrom:
            secretKeyRef:
              name: ventiapi-secrets
              key: DEFAULT_ADMIN_USERNAME
        - name: DEFAULT_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: ventiapi-secrets
              key: DEFAULT_ADMIN_PASSWORD
        envFrom:
        - configMapRef:
            name: ventiapi-config
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: shared-results
          mountPath: /shared/results
        - name: shared-specs
          mountPath: /shared/specs
      volumes:
      - name: shared-results
        emptyDir: {}
      - name: shared-specs
        emptyDir: {}
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
EOF
```

### 6. Frontend (nginx) Deployment

```bash
cat > kubernetes/base/frontend.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: ventiapi
  labels:
    app: frontend
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
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
          limits:
            memory: "128Mi"
            cpu: "200m"
        volumeMounts:
        - name: nginx-config
          mountPath: /etc/nginx/conf.d/default.conf
          subPath: nginx.conf
        - name: frontend-build
          mountPath: /usr/share/nginx/html
      volumes:
      - name: nginx-config
        configMap:
          name: nginx-config
      - name: frontend-build
        emptyDir: {}
      initContainers:
      - name: frontend-builder
        image: ventiapi-frontend:latest
        imagePullPolicy: Never
        command: ["sh", "-c", "cp -r /app/build/* /shared/"]
        volumeMounts:
        - name: frontend-build
          mountPath: /shared
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
  namespace: ventiapi
data:
  nginx.conf: |
    server {
        listen 80;
        server_name _;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        
        # Serve static files (React frontend)
        location / {
            root /usr/share/nginx/html;
            index index.html index.htm;
            try_files $uri $uri/ /index.html;
            
            # Cache static assets
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }
        
        # Proxy API requests to backend
        location /api/ {
            proxy_pass http://web-api:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Handle CORS preflight requests
            if ($request_method = 'OPTIONS') {
                add_header 'Access-Control-Allow-Origin' '*';
                add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, DELETE';
                add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type';
                add_header 'Access-Control-Max-Age' 1728000;
                add_header 'Content-Type' 'text/plain; charset=utf-8';
                add_header 'Content-Length' 0;
                return 204;
            }
            
            # Timeout settings for long-running scans
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 300s;
        }
        
        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
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
EOF
```

### 7. Scanner Job Template

```bash
cat > kubernetes/base/scanner-job-template.yaml << 'EOF'
apiVersion: batch/v1
kind: Job
metadata:
  name: scanner-job-template
  namespace: ventiapi
  labels:
    app: scanner-job
spec:
  template:
    metadata:
      labels:
        app: scanner-job
    spec:
      restartPolicy: OnFailure
      containers:
      - name: scanner
        image: ventiapi-scanner:latest
        imagePullPolicy: Never
        env:
        - name: SCAN_ID
          value: "PLACEHOLDER_SCAN_ID"
        - name: TARGET_URL
          value: "PLACEHOLDER_TARGET_URL"
        - name: SPEC_FILE
          value: "PLACEHOLDER_SPEC_FILE"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        volumeMounts:
        - name: shared-results
          mountPath: /shared/results
        - name: shared-specs
          mountPath: /shared/specs
      volumes:
      - name: shared-results
        emptyDir: {}
      - name: shared-specs
        emptyDir: {}
EOF
```

### 8. Horizontal Pod Autoscaler

```bash
cat > kubernetes/base/hpa.yaml << 'EOF'
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-api-hpa
  namespace: ventiapi
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: frontend-hpa
  namespace: ventiapi
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: frontend
  minReplicas: 2
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
EOF
```

### 9. Kustomization File

```bash
cat > kubernetes/base/kustomization.yaml << 'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- namespace.yaml
- configmap.yaml
- secret.yaml
- redis.yaml
- web-api.yaml
- frontend.yaml
- hpa.yaml

commonLabels:
  app.kubernetes.io/name: ventiapi-scanner
  app.kubernetes.io/version: v1.0.0
EOF
```

## Part 3: Build and Deploy

### Build Docker Images

```bash
# Build all images for Kubernetes
docker build -t ventiapi-frontend:latest ./frontend
docker build -t ventiapi-web-api:latest ./scanner-service/web-api
docker build -t ventiapi-scanner:latest -f scanner.Dockerfile .

# Load images into k3d cluster
k3d image import ventiapi-frontend:latest --cluster ventiapi-local
k3d image import ventiapi-web-api:latest --cluster ventiapi-local
k3d image import ventiapi-scanner:latest --cluster ventiapi-local
```

### Update Secrets (Important!)

```bash
# Generate secure values
JWT_SECRET=$(openssl rand -base64 32)
ADMIN_USERNAME="your-admin-username"
ADMIN_PASSWORD="your-secure-password"

# Create secret with your values
kubectl create secret generic ventiapi-secrets \
  --namespace=ventiapi \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=DEFAULT_ADMIN_USERNAME="$ADMIN_USERNAME" \
  --from-literal=DEFAULT_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  --dry-run=client -o yaml > kubernetes/base/secret.yaml
```

### Deploy to Kubernetes

```bash
# Deploy everything
kubectl apply -k kubernetes/base/

# Wait for deployments to be ready
kubectl wait --for=condition=available --timeout=300s deployment/web-api -n ventiapi
kubectl wait --for=condition=available --timeout=300s deployment/frontend -n ventiapi
kubectl wait --for=condition=available --timeout=300s deployment/redis -n ventiapi

# Check status
kubectl get all -n ventiapi
```

### Access the Application

```bash
# Get the LoadBalancer IP (for k3d, this will be localhost)
kubectl get service frontend -n ventiapi

# Access at http://localhost:3000
echo "Application ready at: http://localhost:3000"
```

## Part 4: Scanner Job Integration

### Update Backend for Kubernetes Jobs

Create a new file `kubernetes_scanner.py` in your web-api directory:

```python
# scanner-service/web-api/kubernetes_scanner.py
import os
import yaml
import subprocess
from typing import Dict, Any

class KubernetesScanner:
    def __init__(self):
        self.namespace = "ventiapi"
    
    def create_scan_job(self, scan_id: str, spec_file: str, target_url: str) -> Dict[str, Any]:
        """Create a Kubernetes Job for scanning"""
        
        job_manifest = {
            "apiVersion": "batch/v1",
            "kind": "Job",
            "metadata": {
                "name": f"scanner-job-{scan_id}",
                "namespace": self.namespace,
                "labels": {
                    "app": "scanner-job",
                    "scan-id": scan_id
                }
            },
            "spec": {
                "template": {
                    "metadata": {
                        "labels": {
                            "app": "scanner-job",
                            "scan-id": scan_id
                        }
                    },
                    "spec": {
                        "restartPolicy": "OnFailure",
                        "containers": [{
                            "name": "scanner",
                            "image": "ventiapi-scanner:latest",
                            "imagePullPolicy": "Never",
                            "env": [
                                {"name": "SCAN_ID", "value": scan_id},
                                {"name": "TARGET_URL", "value": target_url},
                                {"name": "SPEC_FILE", "value": spec_file}
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
        
        # Write manifest to temp file
        with open(f"/tmp/scanner-job-{scan_id}.yaml", "w") as f:
            yaml.dump(job_manifest, f)
        
        # Apply the job
        result = subprocess.run([
            "kubectl", "apply", "-f", f"/tmp/scanner-job-{scan_id}.yaml"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            return {"status": "success", "job_name": f"scanner-job-{scan_id}"}
        else:
            return {"status": "error", "error": result.stderr}
    
    def get_job_status(self, scan_id: str) -> Dict[str, Any]:
        """Get the status of a scanner job"""
        result = subprocess.run([
            "kubectl", "get", "job", f"scanner-job-{scan_id}",
            "-n", self.namespace, "-o", "json"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            import json
            job_data = json.loads(result.stdout)
            return {
                "status": "running" if job_data["status"].get("active", 0) > 0 else "completed",
                "succeeded": job_data["status"].get("succeeded", 0),
                "failed": job_data["status"].get("failed", 0)
            }
        else:
            return {"status": "not_found"}
    
    def cleanup_job(self, scan_id: str):
        """Clean up the scanner job"""
        subprocess.run([
            "kubectl", "delete", "job", f"scanner-job-{scan_id}",
            "-n", self.namespace
        ])
```

## Part 5: Production Deployment (AWS EKS)

### Create EKS Cluster

```bash
# Install eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Create EKS cluster
eksctl create cluster \
  --name ventiapi-prod \
  --region us-west-2 \
  --nodegroup-name workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 10 \
  --managed

# Install AWS Load Balancer Controller
eksctl create iamserviceaccount \
  --cluster=ventiapi-prod \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess \
  --approve

helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=ventiapi-prod \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### Production Overrides

```bash
# Create production overlay
mkdir -p kubernetes/overlays/production

cat > kubernetes/overlays/production/frontend-ingress.yaml << 'EOF'
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ventiapi-ingress
  namespace: ventiapi
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /health
spec:
  rules:
  - host: your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
EOF

cat > kubernetes/overlays/production/kustomization.yaml << 'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base
- frontend-ingress.yaml

patchesStrategicMerge:
- production-patches.yaml

images:
- name: ventiapi-frontend
  newName: 123456789.dkr.ecr.us-west-2.amazonaws.com/ventiapi-frontend
  newTag: latest
- name: ventiapi-web-api
  newName: 123456789.dkr.ecr.us-west-2.amazonaws.com/ventiapi-web-api
  newTag: latest
- name: ventiapi-scanner
  newName: 123456789.dkr.ecr.us-west-2.amazonaws.com/ventiapi-scanner
  newTag: latest
EOF
```

### Deploy to Production

```bash
# Build and push images to ECR
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-west-2.amazonaws.com

# Tag and push images
docker tag ventiapi-frontend:latest 123456789.dkr.ecr.us-west-2.amazonaws.com/ventiapi-frontend:latest
docker push 123456789.dkr.ecr.us-west-2.amazonaws.com/ventiapi-frontend:latest

# Deploy to EKS
kubectl apply -k kubernetes/overlays/production/
```

## Part 6: Monitoring and Management

### Install k9s for Cluster Management

```bash
# Install k9s
brew install k9s  # macOS
# or download from https://github.com/derailed/k9s/releases

# Use k9s to manage cluster
k9s -n ventiapi
```

### Common Commands

```bash
# View all resources
kubectl get all -n ventiapi

# Check logs
kubectl logs -f deployment/web-api -n ventiapi

# Scale deployments
kubectl scale deployment web-api --replicas=5 -n ventiapi

# Port forward for debugging
kubectl port-forward service/frontend 8080:80 -n ventiapi

# Execute into pod
kubectl exec -it deployment/web-api -n ventiapi -- /bin/bash

# View resource usage
kubectl top pods -n ventiapi
kubectl top nodes
```

### Cleanup

```bash
# Delete local cluster
k3d cluster delete ventiapi-local

# Delete EKS cluster
eksctl delete cluster --name ventiapi-prod --region us-west-2
```

## Summary

This Kubernetes setup provides:

✅ **Container Orchestration**: Proper pod management and scaling  
✅ **Job-based Scanning**: Dynamic scanner job creation  
✅ **High Availability**: Multiple replicas with load balancing  
✅ **Auto-scaling**: HPA based on CPU/memory usage  
✅ **Production Ready**: EKS deployment with ingress  
✅ **Local Development**: k3d for identical local testing  

**Cost Comparison:**
- **Local (k3d)**: Free
- **EKS**: ~$150/month (much more scalable)
- **DigitalOcean Kubernetes**: ~$36/month (good middle ground)

The Kubernetes approach gives you true microservice architecture with professional-grade orchestration capabilities.