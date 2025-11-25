#!/bin/bash

# Script to view/copy ZAP scan reports from Docker volume

set -e

echo "📊 ZAP Scanner Reports"
echo ""

# Check if web-api container is running
if ! docker compose ps web-api | grep -q "running"; then
    echo "❌ web-api container is not running."
    echo "   Start it with: ./start-dev.sh"
    exit 1
fi

# List available ZAP reports
echo "📁 Available ZAP reports:"
docker compose exec web-api ls -lh /shared/results/zap/ 2>/dev/null || echo "   (no reports found)"
echo ""

# If a scan ID is provided, copy that specific report
if [ -n "$1" ]; then
    SCAN_ID="$1"
    OUTPUT_DIR="${2:-./zap-reports}"

    echo "📥 Copying reports for scan ${SCAN_ID} to ${OUTPUT_DIR}/"
    mkdir -p "${OUTPUT_DIR}"

    # Copy JSON report
    if docker compose exec web-api test -f "/shared/results/zap/${SCAN_ID}_zap.json"; then
        docker compose exec web-api cat "/shared/results/zap/${SCAN_ID}_zap.json" > "${OUTPUT_DIR}/${SCAN_ID}_zap.json"
        echo "   ✅ ${OUTPUT_DIR}/${SCAN_ID}_zap.json"
    fi

    # Copy HTML report
    if docker compose exec web-api test -f "/shared/results/zap/${SCAN_ID}_zap.html"; then
        docker compose exec web-api cat "/shared/results/zap/${SCAN_ID}_zap.html" > "${OUTPUT_DIR}/${SCAN_ID}_zap.html"
        echo "   ✅ ${OUTPUT_DIR}/${SCAN_ID}_zap.html"
        echo ""
        echo "🌐 Open HTML report:"
        echo "   open ${OUTPUT_DIR}/${SCAN_ID}_zap.html"
    fi
else
    echo "💡 To copy a specific report:"
    echo "   ./view-zap-reports.sh <scan_id> [output_dir]"
    echo ""
    echo "   Example:"
    echo "   ./view-zap-reports.sh 25aa31ac-7a02-4652-bbc1-72bc1c752477 ./my-reports"
    echo ""
    echo "📂 To copy ALL reports:"
    docker compose exec web-api sh -c 'cd /shared/results && tar czf - zap/' | tar xzf - -C .
    echo "   ✅ All reports copied to ./zap/"
    echo ""
    echo "🌐 View reports:"
    echo "   open zap/*.html"
fi
