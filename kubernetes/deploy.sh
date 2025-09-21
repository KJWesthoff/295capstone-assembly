#!/bin/bash

set -e

echo "🚀 Deploying VentiAPI Scanner to Kubernetes..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if k3d is available (optional, for local development)
if command -v k3d &> /dev/null; then
    echo "📦 Building and importing Docker images for k3d..."
    
    # Build images
    echo "Building frontend image..."
    docker build -t ventiapi-frontend:latest ./frontend
    
    echo "Building web-api image..."
    docker build -t ventiapi-web-api:latest ./scanner-service/web-api
    
    echo "Building scanner image..."
    docker build -t ventiapi-scanner:latest -f scanner.Dockerfile .
    
    # Import images to k3d (if cluster exists)
    CLUSTER_NAME=${K3D_CLUSTER_NAME:-"ventiapi-local"}
    if k3d cluster list | grep -q "$CLUSTER_NAME"; then
        echo "Importing images to k3d cluster '$CLUSTER_NAME'..."
        k3d image import ventiapi-frontend:latest -c "$CLUSTER_NAME"
        k3d image import ventiapi-web-api:latest -c "$CLUSTER_NAME"
        k3d image import ventiapi-scanner:latest -c "$CLUSTER_NAME"
    else
        echo "⚠️  k3d cluster '$CLUSTER_NAME' not found. Images built but not imported."
        echo "💡 Create cluster with: k3d cluster create $CLUSTER_NAME"
    fi
fi

# Apply Kubernetes manifests
echo "🔧 Applying Kubernetes manifests..."
kubectl apply -k ./kubernetes/

# Wait for deployments to be ready
echo "⏳ Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/redis -n ventiapi
kubectl wait --for=condition=available --timeout=300s deployment/web-api -n ventiapi
kubectl wait --for=condition=available --timeout=300s deployment/frontend -n ventiapi

# Get service URLs
echo "✅ Deployment complete!"
echo ""
echo "🌐 Service URLs:"
if command -v k3d &> /dev/null && k3d cluster list | grep -q "${K3D_CLUSTER_NAME:-ventiapi-local}"; then
    echo "  Frontend: http://localhost:30000"
    echo "  API: http://localhost:30001"
else
    echo "  Use kubectl port-forward to access services:"
    echo "  Frontend: kubectl port-forward -n ventiapi svc/frontend 3000:80"
    echo "  API: kubectl port-forward -n ventiapi svc/web-api 8000:8000"
fi

echo ""
echo "🔍 Check status with:"
echo "  kubectl get pods -n ventiapi"
echo "  kubectl get svc -n ventiapi"
echo ""
echo "📝 View logs with:"
echo "  kubectl logs -n ventiapi -l app=web-api"
echo "  kubectl logs -n ventiapi -l app=frontend"