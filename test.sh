#!/bin/bash

# Test script for API scanner
# This script logs into the scanner API and runs a test on VAmPI

set -e  # Exit on any error

API_BASE="http://localhost:3000"
VAMPI_URL="http://localhost:5002"
USERNAME="MICS295"
PASSWORD="MaryMcHale"

echo "🔐 Logging into scanner API..."

# Login and get JWT token
TOKEN_RESPONSE=$(curl -s -X POST "${API_BASE}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"${USERNAME}\", \"password\": \"${PASSWORD}\"}")

# Extract token from response
TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Response:"
  echo "$TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"

# Download VAmPI OpenAPI spec
echo "📥 Downloading VAmPI OpenAPI specification..."
curl -s "${VAMPI_URL}/openapi.json" > /tmp/vampi-spec.json

# Start a scan on VAmPI using file upload
echo "🚀 Starting security scan on VAmPI at ${VAMPI_URL}..."

SCAN_RESPONSE=$(curl -s -X POST "${API_BASE}/api/scan/start" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "server_url=${VAMPI_URL}" \
  -F "spec_file=@/tmp/vampi-spec.json" \
  -F "rps=2.0" \
  -F "max_requests=50" \
  -F "dangerous=false" \
  -F "fuzz_auth=false")

SCAN_ID=$(echo "$SCAN_RESPONSE" | jq -r '.scan_id')

if [ "$SCAN_ID" = "null" ] || [ -z "$SCAN_ID" ]; then
  echo "❌ Scan start failed. Response:"
  echo "$SCAN_RESPONSE"
  exit 1
fi

echo "✅ Scan started with ID: $SCAN_ID"

# Monitor scan progress
echo "📊 Monitoring scan progress..."

while true; do
  STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer ${TOKEN}" \
    "${API_BASE}/api/scan/${SCAN_ID}/status")
  
  STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
  PROGRESS=$(echo "$STATUS_RESPONSE" | jq -r '.progress // 0')
  CURRENT_PHASE=$(echo "$STATUS_RESPONSE" | jq -r '.current_phase // "unknown"')
  FINDINGS_COUNT=$(echo "$STATUS_RESPONSE" | jq -r '.findings_count // 0')
  CURRENT_PROBE=$(echo "$STATUS_RESPONSE" | jq -r '.current_probe // ""')
  
  # Show current endpoint being tested if available
  if [ "$CURRENT_PROBE" != "" ] && [ "$CURRENT_PROBE" != "null" ]; then
    echo "🔍 Testing: $CURRENT_PROBE"
  fi
  
  echo "Status: $STATUS | Progress: ${PROGRESS}% | Phase: $CURRENT_PHASE | Findings: $FINDINGS_COUNT"
  
  # For parallel scans, show chunk status with endpoints
  CHUNK_STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.chunk_status // []')
  if [ "$CHUNK_STATUS" != "[]" ] && [ "$CHUNK_STATUS" != "null" ]; then
    echo "$STATUS_RESPONSE" | jq -r '.chunk_status[]? | select(.current_endpoint != null) | "  Chunk \(.chunk_id): Testing \(.current_endpoint)"' 2>/dev/null || true
  fi
  
  if [ "$STATUS" = "completed" ]; then
    echo "✅ Scan completed!"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "❌ Scan failed!"
    ERROR=$(echo "$STATUS_RESPONSE" | jq -r '.error // "Unknown error"')
    echo "Error: $ERROR"
    exit 1
  fi
  
  sleep 3
done

# Get findings
echo "📋 Retrieving scan findings..."

FINDINGS_RESPONSE=$(curl -s -H "Authorization: Bearer ${TOKEN}" \
  "${API_BASE}/api/scan/${SCAN_ID}/findings?limit=100")

TOTAL_FINDINGS=$(echo "$FINDINGS_RESPONSE" | jq -r '.total // 0')
echo "✅ Found $TOTAL_FINDINGS total findings"

# Show summary by severity
echo "📊 Findings summary:"
echo "$FINDINGS_RESPONSE" | jq -r '.findings[] | .severity' | sort | uniq -c | while read count severity; do
  echo "  $severity: $count"
done

# Show all tested endpoints
echo ""
echo "🎯 Endpoints tested:"
echo "$FINDINGS_RESPONSE" | jq -r '.findings[] | "\(.method) \(.endpoint)"' | sort -u | while read endpoint; do
  echo "  $endpoint"
done

echo ""
echo "🎯 Test completed successfully!"
echo "Scan ID: $SCAN_ID"
echo "Total findings: $TOTAL_FINDINGS"
echo ""
echo "View full report at: ${API_BASE}/#/scan/${SCAN_ID}"
