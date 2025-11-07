# Secrets Management

This document explains how to manage secrets and credentials for the Scanner Application across different environments.

## Overview

The application uses a multi-tiered approach for managing secrets:

1. **Development**: Local `.env.local` file (git-ignored)
2. **Production**: Environment variables or external secrets management
3. **CI/CD**: Environment variables or integrated secrets management

## Development Environment

### Local Development Setup

The `.env.local` file contains development credentials and is **git-ignored** for security.

1. **Use the development script (recommended):**
   ```bash
   # Start development environment with proper credentials
   ./start-dev.sh
   
   # This script loads .env.local automatically and displays:
   # Username: MICS295
   # Password: MaryMcHale
   ```

2. **Manual start (alternative):**
   ```bash
   # Load environment variables and start
   source .env.local && docker compose up --build
   ```

## Production Environment

### Deployment Setup

1. **Copy the template:**
   ```bash
   cp .env.deploy.example .env.deploy
   ```

2. **Edit with secure values:**
   ```bash
   # Generate a secure JWT secret
   openssl rand -base64 32
   
   # Edit .env.deploy with:
   # - Secure JWT_SECRET
   # - Strong admin credentials
   # - Production database URLs
   ```

3. **Deploy with environment:**
   ```bash
   source .env.deploy && docker compose up --build -d
   ```
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

### Environment Variables Setup

1. **Set production environment variables:**
   ```bash
   export JWT_SECRET="your-production-jwt-secret-here"
   export DEFAULT_ADMIN_USERNAME="admin"
   export DEFAULT_ADMIN_PASSWORD="your-secure-admin-password"
   export REDIS_URL="redis://your-production-redis:6379"
   export SCANNER_MAX_PARALLEL_CONTAINERS="10"
   export SCANNER_CONTAINER_MEMORY_LIMIT="1g"
   ```

2. **Use a secrets management solution:**
   - **Docker Secrets**: For Docker Swarm deployments
   - **Kubernetes Secrets**: For K8s deployments
   - **HashiCorp Vault**: For enterprise environments
   - **External secrets operator**: For cloud-agnostic solutions

### Production Deployment

#### Option 1: Environment variables
```bash
# Set environment variables
export JWT_SECRET="your-secure-jwt-secret"
export DEFAULT_ADMIN_PASSWORD="your-secure-password"

# Deploy application
docker compose up --build -d
```

#### Option 2: Docker secrets (Swarm mode)
```bash
# Create Docker secrets
echo "your-jwt-secret" | docker secret create jwt_secret -
echo "your-admin-password" | docker secret create admin_password -

# Deploy with Docker secrets
docker stack deploy -c docker-compose.yml scanner-app
```

#### Option 3: Environment file
```bash
# Create production environment file
cat > .env.production << EOF
JWT_SECRET=your-secure-jwt-secret
DEFAULT_ADMIN_PASSWORD=your-secure-password
EOF

# Deploy application
docker compose --env-file .env.production up --build -d
```

## Secret Generation

### Generate Secure Secrets

```bash
# Generate a secure JWT secret (256-bit)
export JWT_SECRET=$(openssl rand -base64 32)

# Generate a secure admin password
export DEFAULT_ADMIN_PASSWORD=$(openssl rand -base64 16)

# Display generated secrets (for manual configuration)
echo "JWT_SECRET=${JWT_SECRET}"
echo "DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD}"
```

### Environment File Template

```bash
# Create .env.production template
cat > .env.production.template << EOF
JWT_SECRET=REPLACE_WITH_SECURE_SECRET
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=REPLACE_WITH_SECURE_PASSWORD
REDIS_URL=redis://redis:6379
SCANNER_MAX_PARALLEL_CONTAINERS=10
SCANNER_CONTAINER_MEMORY_LIMIT=1g
EOF
```

## Security Best Practices

1. **Never commit secrets to version control**
   - The `.env.local` file is git-ignored
   - Use environment variables for CI/CD
   - Store production secrets securely

2. **Use strong, unique secrets**
   - Generate JWT secrets with sufficient entropy (recommended: 256-bit)
   - Use complex passwords for admin accounts
   - Rotate secrets regularly

3. **Principle of least privilege**
   - Grant minimal permissions for accessing secrets
   - Use service accounts instead of hardcoded credentials
   - Limit secret access to only required applications

4. **Audit and monitoring**
   - Enable access logging for secrets
   - Monitor for unauthorized access attempts
   - Set up alerts for secret access

## Troubleshooting

### Common Issues

1. **Environment variables not set:**
   ```bash
   # Check if variables are set
   env | grep -E "(JWT_SECRET|DEFAULT_ADMIN|REDIS_URL)"
   
   # Set missing variables
   export JWT_SECRET="your-secret-here"
   ```

2. **JWT secret not working:**
   - Ensure the secret is base64-encoded if required
   - Check secret length (minimum 256 bits recommended)
   - Verify no trailing whitespace or newlines

3. **Permission denied:**
   - Check file permissions on environment files
   - Verify container has access to secrets
   - Ensure proper user/group ownership

4. **Secrets in logs:**
   - Never log secret values
   - Use environment variable names in logs instead
   - Implement log sanitization

### Debug Commands

```bash
# Validate environment variables (without showing values)
env | grep -E "(JWT_SECRET|DEFAULT_ADMIN|REDIS_URL)" | cut -d'=' -f1

# Check if secrets are properly loaded (without showing values)
[ -n "$JWT_SECRET" ] && echo "JWT_SECRET is set" || echo "JWT_SECRET is missing"
[ -n "$DEFAULT_ADMIN_PASSWORD" ] && echo "DEFAULT_ADMIN_PASSWORD is set" || echo "DEFAULT_ADMIN_PASSWORD is missing"

# Check container logs
docker compose logs web-api

# Test secret strength
echo "$JWT_SECRET" | wc -c  # Should be > 32 characters
```

## Migration from Development to Production

1. **Generate production secrets:**
   ```bash
   # Generate secure secrets for production
   openssl rand -base64 32 > jwt_secret.txt
   openssl rand -base64 16 > admin_password.txt
   ```

2. **Create production environment file:**
   ```bash
   # Create secure production environment
   cat > .env.production << EOF
   JWT_SECRET=$(cat jwt_secret.txt)
   DEFAULT_ADMIN_USERNAME=admin
   DEFAULT_ADMIN_PASSWORD=$(cat admin_password.txt)
   REDIS_URL=redis://redis:6379
   SCANNER_MAX_PARALLEL_CONTAINERS=10
   SCANNER_CONTAINER_MEMORY_LIMIT=1g
   EOF
   
   # Secure the file
   chmod 600 .env.production
   ```

3. **Deploy to production:**
   ```bash
   docker compose --env-file .env.production up --build -d
   
   # Clean up temporary files
   rm jwt_secret.txt admin_password.txt
   ```