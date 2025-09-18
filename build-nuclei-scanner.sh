#!/bin/bash
set -e

echo "Building Nuclei Scanner for VentiAPI Scanner Platform"
echo "====================================================="

# Navigate to nuclei scanner directory
cd nuclei-scanner-container

# Build the Nuclei scanner container
echo "Building Nuclei scanner container..."
docker build -t nuclei-scanner:latest .

# Test the container
echo "Testing container health..."
if docker run --rm nuclei-scanner:latest --health-check; then
    echo "✓ Nuclei scanner container is healthy"
else
    echo "✗ Nuclei scanner container health check failed"
    exit 1
fi

# Copy manifest to main app
echo "Installing scanner manifest..."
cp nuclei-scanner.yaml ../scanner-service/web-api/scanner-manifests/

echo ""
echo "✓ Nuclei scanner successfully built and integrated!"
echo ""
echo "The Nuclei scanner is now available in the VentiAPI Scanner platform:"
echo "  - Container: nuclei-scanner:latest"
echo "  - Type: nuclei"
echo "  - Templates: 10,000+ community vulnerability templates"
echo ""
echo "Start the VentiAPI Scanner platform to see the new scanner:"
echo "  cd scanner-service/web-api && python main.py"