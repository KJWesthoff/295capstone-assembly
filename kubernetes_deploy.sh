#!/bin/bash
# kubernetes_deploy.sh - VentiAPI Scanner Kubernetes Deployment Script
# This script automates the deployment of VentiAPI Scanner to Kubernetes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME="ventiapi-local"
NAMESPACE="ventiapi"
FRONTEND_PORT="3000"
API_PORT="8000"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command_exists kubectl; then
        print_error "kubectl is not installed. Please install kubectl first."
        print_status "Install with: curl -LO \"https://dl.k8s.io/release/\$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl\""
        exit 1
    fi
    
    if ! command_exists k3d; then
        print_error "k3d is not installed. Please install k3d first."
        print_status "Install with: curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash"
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    
    print_success "All prerequisites met!"
}

# Function to create k3d cluster
create_cluster() {
    print_status "Creating k3d cluster '$CLUSTER_NAME'..."
    
    # Check if cluster already exists
    if k3d cluster list | grep -q "$CLUSTER_NAME"; then
        print_warning "Cluster '$CLUSTER_NAME' already exists."
        read -p "Do you want to delete and recreate it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Deleting existing cluster..."
            k3d cluster delete "$CLUSTER_NAME"
        else
            print_status "Using existing cluster..."
            return 0
        fi
    fi
    
    # Create cluster with proper port mappings
    k3d cluster create "$CLUSTER_NAME" \
        --port "$FRONTEND_PORT:30000@agent:0" \
        --port "$API_PORT:30001@agent:0" \
        --agents 2
    
    print_success "Cluster '$CLUSTER_NAME' created successfully!"
}

# Function to build Docker images
build_images() {
    print_status "Building Docker images..."
    
    # Build frontend image
    print_status "Building frontend image..."
    docker build -t ventiapi-frontend:latest ./frontend
    
    # Build web-api image
    print_status "Building web-api image..."
    docker build -t ventiapi-web-api:latest ./scanner-service/web-api
    
    # Build scanner image
    print_status "Building scanner image..."
    docker build -t ventiapi-scanner:latest -f scanner.Dockerfile .
    
    print_success "All Docker images built successfully!"
}

# Function to import images to k3d
import_images() {
    print_status "Importing images to k3d cluster..."
    
    k3d image import \
        ventiapi-frontend:latest \
        ventiapi-web-api:latest \
        ventiapi-scanner:latest \
        --cluster "$CLUSTER_NAME"
    
    print_success "Images imported to cluster successfully!"
}

# Function to create Kubernetes manifests directory structure
create_manifests() {
    print_status "Creating Kubernetes manifests..."
    
    # Create directory structure
    mkdir -p kubernetes/{base,overlays/{local,production}}
    
    # Create namespace manifest
    cat > kubernetes/base/namespace.yaml << 'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: ventiapi
  labels:
    name: ventiapi
    app.kubernetes.io/name: ventiapi-scanner
EOF

    # Create Redis manifest
    cat > kubernetes/base/redis.yaml << 'EOF'
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
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
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

    # Create Web API manifest
    cat > kubernetes/base/web-api.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api
  namespace: ventiapi
spec:
  replicas: 1
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
        imagePullPolicy: Never
        ports:
        - containerPort: 8000
        env:
        - name: JWT_SECRET
          value: "your-jwt-secret-here"
        - name: DEFAULT_ADMIN_USERNAME
          value: "MICS295"
        - name: DEFAULT_ADMIN_PASSWORD
          value: "MaryMcHale"
        - name: REDIS_URL
          value: "redis://redis:6379"
        - name: PYTHONUNBUFFERED
          value: "1"
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
  type: NodePort
  ports:
  - port: 8000
    targetPort: 8000
    nodePort: 30001
EOF

    # Create Frontend manifest with nginx config
    cat > kubernetes/base/frontend.yaml << 'EOF'
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
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: ventiapi
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      initContainers:
      - name: frontend-builder
        image: ventiapi-frontend:latest
        imagePullPolicy: Never
        command: ["sh", "-c", "cp -r /app/build/* /shared/"]
        volumeMounts:
        - name: frontend-build
          mountPath: /shared
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
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: ventiapi
spec:
  selector:
    app: frontend
  type: NodePort
  ports:
  - port: 80
    targetPort: 80
    nodePort: 30000
EOF

    print_success "Kubernetes manifests created successfully!"
}

# Function to deploy to Kubernetes
deploy_kubernetes() {
    print_status "Deploying to Kubernetes..."
    
    # Apply manifests
    kubectl apply -f kubernetes/base/
    
    print_status "Waiting for deployments to be ready..."
    
    # Wait for deployments
    kubectl wait --for=condition=available --timeout=300s deployment/redis -n "$NAMESPACE"
    kubectl wait --for=condition=available --timeout=300s deployment/web-api -n "$NAMESPACE"
    kubectl wait --for=condition=available --timeout=300s deployment/frontend -n "$NAMESPACE"
    
    print_success "All deployments are ready!"
}

# Function to verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    # Check pods
    print_status "Checking pod status..."
    kubectl get pods -n "$NAMESPACE"
    
    # Check services
    print_status "Checking service status..."
    kubectl get services -n "$NAMESPACE"
    
    # Test health endpoints
    print_status "Testing health endpoints..."
    
    # Test frontend
    if curl -s http://localhost:$FRONTEND_PORT/health > /dev/null; then
        print_success "Frontend health check passed!"
    else
        print_warning "Frontend health check failed. Waiting 30 seconds and retrying..."
        sleep 30
        if curl -s http://localhost:$FRONTEND_PORT/health > /dev/null; then
            print_success "Frontend health check passed on retry!"
        else
            print_error "Frontend health check failed!"
        fi
    fi
    
    # Test API
    if curl -s http://localhost:$API_PORT/health > /dev/null; then
        print_success "API health check passed!"
    else
        print_warning "API health check failed. Waiting 30 seconds and retrying..."
        sleep 30
        if curl -s http://localhost:$API_PORT/health > /dev/null; then
            print_success "API health check passed on retry!"
        else
            print_error "API health check failed!"
        fi
    fi
}

# Function to show access information
show_access_info() {
    echo
    echo "🎉 VentiAPI Scanner deployed successfully to Kubernetes!"
    echo
    echo "📍 Access Information:"
    echo "   Frontend: http://localhost:$FRONTEND_PORT"
    echo "   API:      http://localhost:$API_PORT"
    echo
    echo "🔐 Login Credentials:"
    echo "   Username: MICS295"
    echo "   Password: MaryMcHale"
    echo
    echo "🛠️  Management Commands:"
    echo "   View pods:     kubectl get pods -n $NAMESPACE"
    echo "   View services: kubectl get services -n $NAMESPACE"
    echo "   View logs:     kubectl logs deployment/web-api -n $NAMESPACE"
    echo "   Scale up:      kubectl scale deployment web-api --replicas=3 -n $NAMESPACE"
    echo
    echo "🧹 Cleanup:"
    echo "   Delete cluster: k3d cluster delete $CLUSTER_NAME"
    echo
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  --cluster-name NAME    Set cluster name (default: $CLUSTER_NAME)"
    echo "  --frontend-port PORT   Set frontend port (default: $FRONTEND_PORT)"
    echo "  --api-port PORT        Set API port (default: $API_PORT)"
    echo "  --skip-build          Skip Docker image building"
    echo "  --skip-import         Skip image import to k3d"
    echo "  --cleanup             Delete existing cluster and exit"
    echo "  --help                Show this help message"
    echo
    echo "Examples:"
    echo "  $0                           # Deploy with default settings"
    echo "  $0 --skip-build              # Deploy without rebuilding images"
    echo "  $0 --cleanup                 # Delete cluster"
    echo "  $0 --frontend-port 8080      # Use different frontend port"
}

# Main execution function
main() {
    local skip_build=false
    local skip_import=false
    local cleanup=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --cluster-name)
                CLUSTER_NAME="$2"
                shift 2
                ;;
            --frontend-port)
                FRONTEND_PORT="$2"
                shift 2
                ;;
            --api-port)
                API_PORT="$2"
                shift 2
                ;;
            --skip-build)
                skip_build=true
                shift
                ;;
            --skip-import)
                skip_import=true
                shift
                ;;
            --cleanup)
                cleanup=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Handle cleanup
    if [[ "$cleanup" == "true" ]]; then
        if k3d cluster list | grep -q "$CLUSTER_NAME"; then
            print_status "Deleting cluster '$CLUSTER_NAME'..."
            k3d cluster delete "$CLUSTER_NAME"
            print_success "Cluster deleted successfully!"
        else
            print_warning "Cluster '$CLUSTER_NAME' does not exist."
        fi
        exit 0
    fi
    
    # Main deployment flow
    print_status "Starting VentiAPI Scanner Kubernetes deployment..."
    
    check_prerequisites
    create_cluster
    
    if [[ "$skip_build" != "true" ]]; then
        build_images
    fi
    
    if [[ "$skip_import" != "true" ]]; then
        import_images
    fi
    
    create_manifests
    deploy_kubernetes
    verify_deployment
    show_access_info
}

# Run main function with all arguments
main "$@"