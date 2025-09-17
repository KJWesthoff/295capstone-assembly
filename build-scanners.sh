#!/bin/bash

echo "🔨 Building Containerized Security Scanners..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not available. Please install Docker and try again."
    exit 1
fi

# Build scanners
SCANNERS_DIR="./scanners"
BUILT_COUNT=0
FAILED_COUNT=0

if [ ! -d "$SCANNERS_DIR" ]; then
    print_error "Scanners directory not found: $SCANNERS_DIR"
    exit 1
fi

print_status "Building scanner containers..."

# Find all scanner directories with Dockerfiles
for scanner_dir in "$SCANNERS_DIR"/*; do
    if [ -d "$scanner_dir" ] && [ -f "$scanner_dir/Dockerfile" ]; then
        scanner_name=$(basename "$scanner_dir")
        image_name="$scanner_name:latest"
        
        print_status "Building $scanner_name..."
        
        # Build the container
        if docker build -t "$image_name" "$scanner_dir"; then
            print_success "Built $image_name"
            BUILT_COUNT=$((BUILT_COUNT + 1))
            
            # Test health check
            print_status "Testing health check for $scanner_name..."
            if docker run --rm "$image_name" --health-check > /dev/null 2>&1; then
                print_success "$scanner_name health check passed"
            else
                print_warning "$scanner_name health check failed"
            fi
        else
            print_error "Failed to build $image_name"
            FAILED_COUNT=$((FAILED_COUNT + 1))
        fi
        
        echo ""
    fi
done

# Summary
echo "🏁 Build Summary:"
echo "   ✅ Successfully built: $BUILT_COUNT scanners"
echo "   ❌ Failed to build: $FAILED_COUNT scanners"

if [ $FAILED_COUNT -eq 0 ]; then
    print_success "All scanners built successfully!"
    
    # Show available images
    print_status "Available scanner images:"
    docker images | grep -E "(nuclei-scanner|zap-scanner|venti-scanner)" | head -10
    
else
    print_warning "Some scanners failed to build. Check the output above for details."
    exit 1
fi

echo ""
print_status "To use the containerized scanners:"
echo "   1. Start the main application with: ./start-dev.sh"
echo "   2. Access the scanner management API at: http://localhost:8000/api/v2/scanners"
echo "   3. The scanner containers will be automatically discovered and available"