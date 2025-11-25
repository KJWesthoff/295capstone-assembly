#!/bin/bash
# Generate self-signed SSL certificates for PostgreSQL
# This script creates certificates that allow encrypted connections to the database

set -e

CERT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔐 Generating self-signed SSL certificates for PostgreSQL..."

# Generate private key
openssl genrsa -out "${CERT_DIR}/server.key" 2048

# Generate self-signed certificate (valid for 10 years)
openssl req -new -x509 -key "${CERT_DIR}/server.key" \
  -out "${CERT_DIR}/server.crt" -days 3650 \
  -subj "/C=US/ST=California/L=San Francisco/O=VentiAPI/CN=postgres"

# Set proper permissions (PostgreSQL requires strict permissions)
chmod 600 "${CERT_DIR}/server.key"
chmod 644 "${CERT_DIR}/server.crt"

echo "✅ SSL certificates generated successfully!"
echo "   Certificate: ${CERT_DIR}/server.crt"
echo "   Private Key: ${CERT_DIR}/server.key"
echo ""
echo "These certificates will be mounted into the PostgreSQL container."
