# Secrets Management

This document explains how to manage secrets and credentials for the Scanner Application across different environments.

## Overview

The application uses a multi-tiered approach for managing secrets:

1. **Development**: Local `.env.local` file (git-ignored)
2. **Production**: AWS Secrets Manager
3. **CI/CD**: Environment variables or integrated secrets management

## Development Environment

### Local Development Setup

1. **Copy development credentials:**
   ```bash
   # Credentials are already in .env.local (git-ignored)
   # Default admin credentials:
   # Username: admin
   # Password: admin123
   ```

2. **Start development environment:**
   ```bash
   # Backend (loads .env.local automatically)
   JWT_SECRET=$(cat .env.local | grep JWT_SECRET | cut -d'=' -f2) docker compose up --build -d
   
   # Frontend (development server)
   cd frontend && PORT=3001 REACT_APP_API_URL=http://localhost:8000 npm start
   ```

### Environment Variables

The following secrets are managed:

- `JWT_SECRET`: Secret key for JWT token signing
- `DEFAULT_ADMIN_USERNAME`: Default administrator username
- `DEFAULT_ADMIN_PASSWORD`: Default administrator password
- `REDIS_URL`: Redis connection string
- `SCANNER_MAX_PARALLEL_CONTAINERS`: Maximum parallel scanner containers
- `SCANNER_CONTAINER_MEMORY_LIMIT`: Memory limit per scanner container

## Production Environment

### AWS Secrets Manager Setup

1. **Create a secret in AWS Secrets Manager:**
   ```bash
   aws secretsmanager create-secret \
     --name "scanner-app-secrets" \
     --description "Production secrets for Scanner Application" \
     --secret-string '{
       "JWT_SECRET": "your-production-jwt-secret-here",
       "DEFAULT_ADMIN_USERNAME": "admin",
       "DEFAULT_ADMIN_PASSWORD": "your-secure-admin-password",
       "REDIS_URL": "redis://your-production-redis:6379",
       "SCANNER_MAX_PARALLEL_CONTAINERS": "10",
       "SCANNER_CONTAINER_MEMORY_LIMIT": "1g"
     }'
   ```

2. **Configure IAM permissions:**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "secretsmanager:GetSecretValue"
         ],
         "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:scanner-app-secrets-*"
       }
     ]
   }
   ```

### Production Deployment

#### Option 1: Using the deployment script
```bash
# Deploy with automatic secret fetching
./scripts/deploy-production.sh
```

#### Option 2: Manual deployment
```bash
# Fetch secrets manually
source ./scripts/fetch-secrets.sh

# Deploy application
docker compose up --build -d
```

#### Option 3: Using Python script
```bash
# Export secrets for shell sourcing
python3 ./scripts/secrets_manager.py --export > /tmp/secrets.env
source /tmp/secrets.env
rm /tmp/secrets.env

# Deploy application
docker compose up --build -d
```

## Scripts Reference

### `scripts/fetch-secrets.sh`
Bash script that fetches secrets from AWS Secrets Manager and exports them as environment variables.

**Usage:**
```bash
# Source the script to load secrets into current shell
source ./scripts/fetch-secrets.sh

# Configure secret name and region
SECRET_NAME=my-app-secrets AWS_REGION=us-west-2 source ./scripts/fetch-secrets.sh
```

### `scripts/secrets_manager.py`
Python utility for AWS Secrets Manager integration with more advanced features.

**Usage:**
```bash
# Load secrets into environment variables
python3 ./scripts/secrets_manager.py

# Print export statements for shell sourcing
python3 ./scripts/secrets_manager.py --export

# Use custom secret name and region
python3 ./scripts/secrets_manager.py --secret-name my-secrets --region us-west-2
```

### `scripts/deploy-production.sh`
Complete production deployment script that handles secret fetching and application deployment.

**Usage:**
```bash
# Deploy to production
./scripts/deploy-production.sh

# Deploy with custom configuration
SECRET_NAME=my-secrets AWS_REGION=us-west-2 ./scripts/deploy-production.sh
```

## Security Best Practices

1. **Never commit secrets to version control**
   - The `.env.local` file is git-ignored
   - Use environment variables for CI/CD
   - Store production secrets in AWS Secrets Manager

2. **Use strong, unique secrets**
   - Generate JWT secrets with sufficient entropy (recommended: 256-bit)
   - Use complex passwords for admin accounts
   - Rotate secrets regularly

3. **Principle of least privilege**
   - Grant minimal IAM permissions for accessing secrets
   - Use IAM roles instead of hardcoded AWS credentials
   - Limit secret access to only required applications

4. **Audit and monitoring**
   - Enable AWS CloudTrail for secrets access logging
   - Monitor for unauthorized access attempts
   - Set up alerts for secret retrieval

## Troubleshooting

### Common Issues

1. **AWS credentials not configured:**
   ```bash
   aws configure
   # or
   export AWS_ACCESS_KEY_ID=your-key
   export AWS_SECRET_ACCESS_KEY=your-secret
   ```

2. **Secret not found:**
   - Verify the secret exists: `aws secretsmanager describe-secret --secret-id scanner-app-secrets`
   - Check the region: secrets are region-specific
   - Verify IAM permissions

3. **JWT secret not working:**
   - Ensure the secret is base64-encoded if required
   - Check secret length (minimum 256 bits recommended)
   - Verify no trailing whitespace or newlines

4. **Permission denied:**
   - Check IAM role/user permissions
   - Verify resource ARN matches the secret
   - Ensure the secret policy allows access

### Debug Commands

```bash
# Test AWS credentials
aws sts get-caller-identity

# Test secret access
aws secretsmanager get-secret-value --secret-id scanner-app-secrets

# Validate environment variables
env | grep -E "(JWT_SECRET|DEFAULT_ADMIN|REDIS_URL)"

# Check container logs
docker compose logs web-api
```

## Migration from Development to Production

1. **Create production secret:**
   ```bash
   # Copy values from .env.local to AWS Secrets Manager
   aws secretsmanager create-secret --name scanner-app-secrets \
     --secret-string "$(cat .env.local | jq -R -s 'split("\n") | map(select(. != "") | split("=")) | map({(.[0]): .[1]}) | add')"
   ```

2. **Test secret access:**
   ```bash
   python3 ./scripts/secrets_manager.py --secret-name scanner-app-secrets
   ```

3. **Deploy to production:**
   ```bash
   ./scripts/deploy-production.sh
   ```