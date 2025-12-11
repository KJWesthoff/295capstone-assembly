#!/bin/bash
# cleanup-cedar-images.sh
# Cleans up cedar-frontend and cedar-mastra Docker images and build cache
# WITHOUT touching scanner images (ventiapi-scanner, ventiapi-zap)
#
# Usage:
#   ./cleanup-cedar-images.sh              # Normal cleanup (24h+ build cache)
#   ./cleanup-cedar-images.sh --aggressive # Full cleanup (all build cache)

set -e

AGGRESSIVE=false
if [ "$1" = "--aggressive" ] || [ "$1" = "-a" ]; then
    AGGRESSIVE=true
fi

echo "=== Cedar Image Cleanup Script ==="
if [ "$AGGRESSIVE" = true ]; then
    echo "Mode: AGGRESSIVE (clearing all build cache)"
else
    echo "Mode: Normal (clearing build cache older than 24h)"
fi
echo ""

# Show current disk usage
echo "Disk usage before cleanup:"
df -h / | tail -1
echo ""

# Show current docker disk usage
echo "Docker disk usage before cleanup:"
docker system df
echo ""

# Remove dangling images (untagged images from failed builds)
echo "Removing dangling images..."
docker image prune -f
echo ""

# Remove old cedar-frontend images (keep the latest tagged one)
echo "Cleaning cedar-frontend images..."
docker images "ventiapi-cedar-frontend" --format "{{.ID}} {{.Tag}}" | while read id tag; do
    if [ "$tag" != "latest" ]; then
        echo "  Removing cedar-frontend image: $id ($tag)"
        docker rmi "$id" 2>/dev/null || true
    fi
done

# Remove old cedar-mastra images (keep the latest tagged one)
echo "Cleaning cedar-mastra images..."
docker images "ventiapi-cedar-mastra" --format "{{.ID}} {{.Tag}}" | while read id tag; do
    if [ "$tag" != "latest" ]; then
        echo "  Removing cedar-mastra image: $id ($tag)"
        docker rmi "$id" 2>/dev/null || true
    fi
done

# Clean up build cache (this is usually the biggest space saver)
echo ""
echo "Cleaning Docker build cache..."
if [ "$AGGRESSIVE" = true ]; then
    docker builder prune -af
else
    docker builder prune -f --filter "until=24h"
fi
echo ""

# Remove stopped containers
echo "Removing stopped containers..."
docker container prune -f
echo ""

# Show results
echo "=== Cleanup Complete ==="
echo ""
echo "Disk usage after cleanup:"
df -h / | tail -1
echo ""
echo "Docker disk usage after cleanup:"
docker system df
echo ""

# Show protected images still present
echo "Protected scanner images (NOT deleted):"
docker images | grep -E "(ventiapi-scanner|ventiapi-zap)" || echo "  (none found - may need rebuilding)"
echo ""
echo "Cedar images:"
docker images | grep -E "(cedar-frontend|cedar-mastra)" || echo "  (none found)"
