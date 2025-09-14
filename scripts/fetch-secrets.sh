#!/bin/bash

# AWS Secrets Manager Integration Script
# This script fetches secrets from AWS Secrets Manager and exports them as environment variables
# Usage: source ./scripts/fetch-secrets.sh

set -e

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if jq is installed for JSON parsing
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Please install it first (apt-get install jq or brew install jq)"
    exit 1
fi

# Configuration
SECRET_NAME="${SECRET_NAME:-scanner-app-secrets}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "Fetching secrets from AWS Secrets Manager..."
echo "Secret Name: $SECRET_NAME"
echo "AWS Region: $AWS_REGION"

# Fetch the secret from AWS Secrets Manager
SECRET_JSON=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_NAME" \
    --region "$AWS_REGION" \
    --query SecretString \
    --output text 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "Error: Failed to fetch secret '$SECRET_NAME' from AWS Secrets Manager"
    echo "Please ensure:"
    echo "1. The secret exists in the specified region"
    echo "2. You have proper AWS credentials configured"
    echo "3. Your IAM user/role has secretsmanager:GetSecretValue permission"
    exit 1
fi

# Parse and export environment variables
echo "Parsing secrets and exporting environment variables..."

# Export JWT_SECRET
JWT_SECRET=$(echo "$SECRET_JSON" | jq -r '.JWT_SECRET // empty')
if [ -n "$JWT_SECRET" ]; then
    export JWT_SECRET
    echo "✓ JWT_SECRET exported"
else
    echo "⚠ Warning: JWT_SECRET not found in secrets"
fi

# Export DEFAULT_ADMIN_USERNAME
DEFAULT_ADMIN_USERNAME=$(echo "$SECRET_JSON" | jq -r '.DEFAULT_ADMIN_USERNAME // empty')
if [ -n "$DEFAULT_ADMIN_USERNAME" ]; then
    export DEFAULT_ADMIN_USERNAME
    echo "✓ DEFAULT_ADMIN_USERNAME exported"
else
    echo "⚠ Warning: DEFAULT_ADMIN_USERNAME not found in secrets"
fi

# Export DEFAULT_ADMIN_PASSWORD
DEFAULT_ADMIN_PASSWORD=$(echo "$SECRET_JSON" | jq -r '.DEFAULT_ADMIN_PASSWORD // empty')
if [ -n "$DEFAULT_ADMIN_PASSWORD" ]; then
    export DEFAULT_ADMIN_PASSWORD
    echo "✓ DEFAULT_ADMIN_PASSWORD exported"
else
    echo "⚠ Warning: DEFAULT_ADMIN_PASSWORD not found in secrets"
fi

# Export REDIS_URL
REDIS_URL=$(echo "$SECRET_JSON" | jq -r '.REDIS_URL // empty')
if [ -n "$REDIS_URL" ]; then
    export REDIS_URL
    echo "✓ REDIS_URL exported"
else
    echo "⚠ Warning: REDIS_URL not found in secrets"
fi

# Export SCANNER_MAX_PARALLEL_CONTAINERS
SCANNER_MAX_PARALLEL_CONTAINERS=$(echo "$SECRET_JSON" | jq -r '.SCANNER_MAX_PARALLEL_CONTAINERS // empty')
if [ -n "$SCANNER_MAX_PARALLEL_CONTAINERS" ]; then
    export SCANNER_MAX_PARALLEL_CONTAINERS
    echo "✓ SCANNER_MAX_PARALLEL_CONTAINERS exported"
else
    echo "⚠ Warning: SCANNER_MAX_PARALLEL_CONTAINERS not found in secrets"
fi

# Export SCANNER_CONTAINER_MEMORY_LIMIT
SCANNER_CONTAINER_MEMORY_LIMIT=$(echo "$SECRET_JSON" | jq -r '.SCANNER_CONTAINER_MEMORY_LIMIT // empty')
if [ -n "$SCANNER_CONTAINER_MEMORY_LIMIT" ]; then
    export SCANNER_CONTAINER_MEMORY_LIMIT
    echo "✓ SCANNER_CONTAINER_MEMORY_LIMIT exported"
else
    echo "⚠ Warning: SCANNER_CONTAINER_MEMORY_LIMIT not found in secrets"
fi

# Export DATABASE_URL (if using RDS instead of Redis)
DATABASE_URL=$(echo "$SECRET_JSON" | jq -r '.DATABASE_URL // empty')
if [ -n "$DATABASE_URL" ]; then
    export DATABASE_URL
    echo "✓ DATABASE_URL exported"
fi

echo ""
echo "✅ Secrets successfully fetched and exported!"
echo "You can now run your application with these environment variables."