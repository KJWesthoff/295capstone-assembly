#!/bin/bash
# start-kubernetes.sh - Quick Kubernetes deployment for VentiAPI Scanner
# This script provides a simple alternative to the full kubernetes_deploy.sh

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

# Function to check if cluster exists
cluster_exists() {
    k3d cluster list | grep -q "$CLUSTER_NAME" 2>/dev/null
}

# Function to check if namespace exists
namespace_exists() {
    kubectl get namespace "$NAMESPACE" >/dev/null 2>&1
}

# Function to check if pods are running
pods_running() {
    local ready_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep -c "Running" || echo "0")
    local total_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l || echo "0")
    
    if [[ "$total_pods" -gt 0 && "$ready_pods" -eq "$total_pods" ]]; then
        return 0
    else
        return 1
    fi
}

# Function to start existing deployment
start_existing() {
    print_status "Starting existing Kubernetes deployment..."
    
    if ! cluster_exists; then
        print_error "Cluster '$CLUSTER_NAME' does not exist. Run './kubernetes_deploy.sh' to create it."
        exit 1
    fi
    
    # Switch to cluster context
    kubectl config use-context "k3d-$CLUSTER_NAME" >/dev/null 2>&1
    
    if ! namespace_exists; then
        print_error "Namespace '$NAMESPACE' does not exist. Run './kubernetes_deploy.sh' to create it."
        exit 1
    fi
    
    # Check if pods are already running
    if pods_running; then
        print_success "All pods are already running!"
        show_status
        return 0
    fi
    
    # Scale up deployments if they were scaled down
    print_status "Scaling up deployments..."
    kubectl scale deployment redis --replicas=1 -n "$NAMESPACE" >/dev/null 2>&1 || true
    kubectl scale deployment web-api --replicas=1 -n "$NAMESPACE" >/dev/null 2>&1 || true
    kubectl scale deployment frontend --replicas=1 -n "$NAMESPACE" >/dev/null 2>&1 || true
    
    # Wait for pods to be ready
    print_status "Waiting for pods to be ready..."
    
    local timeout=120
    local count=0
    while ! pods_running && [[ $count -lt $timeout ]]; do
        sleep 2
        count=$((count + 2))
        if [[ $((count % 10)) -eq 0 && $count -gt 0 ]]; then
            echo -n "."
        fi
    done
    echo
    
    if pods_running; then
        print_success "All pods are running!"
    else
        print_warning "Some pods may still be starting. Check status with: kubectl get pods -n $NAMESPACE"
    fi
}

# Function to show deployment status
show_status() {
    echo
    echo "📊 Deployment Status:"
    echo "===================="
    
    # Check cluster
    if cluster_exists; then
        print_success "Cluster '$CLUSTER_NAME' is running"
    else
        print_error "Cluster '$CLUSTER_NAME' not found"
        return 1
    fi
    
    # Check namespace
    if namespace_exists; then
        print_success "Namespace '$NAMESPACE' exists"
    else
        print_error "Namespace '$NAMESPACE' not found"
        return 1
    fi
    
    # Show pods
    echo
    echo "Pod Status:"
    kubectl get pods -n "$NAMESPACE" 2>/dev/null || echo "No pods found"
    
    # Show services
    echo
    echo "Service Status:"
    kubectl get services -n "$NAMESPACE" 2>/dev/null || echo "No services found"
    
    # Test health endpoints if pods are running
    if pods_running; then
        echo
        echo "🏥 Health Checks:"
        echo "=================="
        
        # Test frontend
        if curl -s http://localhost:3000/health >/dev/null 2>&1; then
            print_success "Frontend (http://localhost:3000) - healthy"
        else
            print_warning "Frontend (http://localhost:3000) - not responding"
        fi
        
        # Test API
        if curl -s http://localhost:8000/health >/dev/null 2>&1; then
            print_success "API (http://localhost:8000) - healthy"
        else
            print_warning "API (http://localhost:8000) - not responding"
        fi
        
        echo
        echo "🌐 Access Information:"
        echo "====================="
        echo "Frontend: http://localhost:3000"
        echo "API:      http://localhost:8000"
        echo "Username: MICS295"
        echo "Password: MaryMcHale"
    fi
}

# Function to stop deployment
stop_deployment() {
    print_status "Stopping Kubernetes deployment..."
    
    if ! cluster_exists; then
        print_warning "Cluster '$CLUSTER_NAME' does not exist."
        return 0
    fi
    
    kubectl config use-context "k3d-$CLUSTER_NAME" >/dev/null 2>&1
    
    if namespace_exists; then
        print_status "Scaling down deployments..."
        kubectl scale deployment redis --replicas=0 -n "$NAMESPACE" >/dev/null 2>&1 || true
        kubectl scale deployment web-api --replicas=0 -n "$NAMESPACE" >/dev/null 2>&1 || true
        kubectl scale deployment frontend --replicas=0 -n "$NAMESPACE" >/dev/null 2>&1 || true
        print_success "Deployments scaled down to 0 replicas"
    else
        print_warning "Namespace '$NAMESPACE' does not exist."
    fi
}

# Function to completely delete deployment
delete_deployment() {
    print_status "Deleting Kubernetes cluster..."
    
    if cluster_exists; then
        k3d cluster delete "$CLUSTER_NAME"
        print_success "Cluster '$CLUSTER_NAME' deleted"
    else
        print_warning "Cluster '$CLUSTER_NAME' does not exist."
    fi
}

# Function to show logs
show_logs() {
    if ! cluster_exists; then
        print_error "Cluster '$CLUSTER_NAME' does not exist."
        exit 1
    fi
    
    kubectl config use-context "k3d-$CLUSTER_NAME" >/dev/null 2>&1
    
    if ! namespace_exists; then
        print_error "Namespace '$NAMESPACE' does not exist."
        exit 1
    fi
    
    local service="$1"
    if [[ -z "$service" ]]; then
        echo "Available services:"
        kubectl get deployments -n "$NAMESPACE" --no-headers | awk '{print "  - " $1}'
        echo
        echo "Usage: $0 logs <service-name>"
        echo "Example: $0 logs web-api"
        return 1
    fi
    
    print_status "Showing logs for $service..."
    kubectl logs deployment/"$service" -n "$NAMESPACE" -f
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo
    echo "Commands:"
    echo "  start     Start the Kubernetes deployment (default)"
    echo "  stop      Stop the deployment (scale to 0 replicas)"
    echo "  status    Show deployment status and health checks"
    echo "  logs      Show logs for a specific service"
    echo "  delete    Delete the entire cluster"
    echo "  help      Show this help message"
    echo
    echo "Examples:"
    echo "  $0                # Start deployment"
    echo "  $0 start          # Start deployment"
    echo "  $0 status         # Show status"
    echo "  $0 stop           # Stop deployment"
    echo "  $0 logs web-api   # Show web-api logs"
    echo "  $0 delete         # Delete cluster"
    echo
    echo "Notes:"
    echo "  - This script manages an existing Kubernetes deployment"
    echo "  - To create a new deployment, use './kubernetes_deploy.sh'"
    echo "  - The cluster and deployments persist between start/stop"
    echo "  - Use 'delete' to completely remove everything"
}

# Function to check prerequisites
check_prerequisites() {
    if ! command -v kubectl >/dev/null 2>&1; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v k3d >/dev/null 2>&1; then
        print_error "k3d is not installed or not in PATH"
        print_status "Install with: curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash"
        exit 1
    fi
    
    if ! command -v curl >/dev/null 2>&1; then
        print_error "curl is not installed or not in PATH"
        exit 1
    fi
}

# Main function
main() {
    local command="${1:-start}"
    
    case "$command" in
        start)
            check_prerequisites
            start_existing
            show_status
            ;;
        stop)
            check_prerequisites
            stop_deployment
            ;;
        status)
            check_prerequisites
            show_status
            ;;
        logs)
            check_prerequisites
            show_logs "$2"
            ;;
        delete)
            check_prerequisites
            read -p "Are you sure you want to delete the entire cluster? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                delete_deployment
            else
                print_status "Delete cancelled."
            fi
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            print_error "Unknown command: $command"
            echo
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"