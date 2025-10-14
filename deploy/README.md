# VentiAPI Scanner - AWS Deployment Guide

This directory contains everything needed to deploy VentiAPI Scanner to AWS EC2 using Docker Compose.

## Quick Start

1. **Prerequisites:**
   ```bash
   # Install AWS CLI
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   
   # Configure AWS CLI
   aws configure
   ```

2. **Create EC2 Key Pair:**
   ```bash
   aws ec2 create-key-pair --key-name ventiapi-key --query 'KeyMaterial' --output text > ~/.ssh/ventiapi-key.pem
   chmod 400 ~/.ssh/ventiapi-key.pem
   ```

3. **Set Up Production Credentials:**
   ```bash
   cd deploy
   ./setup-credentials.sh
   ```

4. **Deploy:**
   ```bash
   ./deploy-simple.sh
   ```

## Files Overview

- **`cloudformation.yml`** - AWS infrastructure template (VPC, EC2, Security Groups)
- **`deploy-simple.sh`** - Simplified deployment script (recommended)
- **`setup-credentials.sh`** - Secure credential configuration script
- **`aws-inventory.sh`** - AWS resource inventory script
- **`docker-compose.prod.yml`** - Production Docker Compose overrides
- **`.env.production.example`** - Environment configuration template

## Credential Management

### Setting Up Credentials
```bash
cd deploy
./setup-credentials.sh
```

This script will:
- Generate a secure JWT secret
- Prompt for admin credentials with validation
- Create `.env.production` with secure permissions (600)
- Ensure credentials are gitignored

### Checking Credential Status
```bash
./setup-credentials.sh --check
```

### Security Features
- **🔒 Gitignored**: All credential files are automatically excluded from git
- **🛡️ Secure Permissions**: Files are created with 600 permissions (owner-only access)
- **🔐 Password Validation**: Enforces strong password requirements
- **🎲 JWT Generation**: Automatically generates cryptographically secure JWT secrets

## Deployment Process

The deployment script will:

1. **Create AWS Infrastructure:**
   - VPC with public subnet
   - EC2 instance (t3.medium by default)
   - Security groups for web access
   - Elastic IP for static IP address

2. **Install Dependencies:**
   - Docker and Docker Compose
   - Git for code deployment
   - CloudWatch agent for monitoring

3. **Deploy Application:**
   - Clone your repository
   - Build and start Docker containers
   - Configure environment variables

## Configuration

### Environment Variables

Copy `.env.production` to `.env.local` on the server and update:

```bash
# Critical settings to change:
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_PASSWORD=your-secure-admin-password
FRONTEND_URL=http://your-domain.com
```

### Instance Sizing

| Instance Type | CPU | Memory | Network | Monthly Cost* |
|---------------|-----|--------|---------|---------------|
| t3.small      | 2   | 2 GB   | Low     | ~$15          |
| t3.medium     | 2   | 4 GB   | Moderate| ~$30          |
| t3.large      | 2   | 8 GB   | High    | ~$60          |

*Costs are estimates and may vary by region

## Management Commands

### Connect to Instance
```bash
ssh -i ~/.ssh/ventiapi-key.pem ec2-user@YOUR_PUBLIC_IP
```

### Application Management
```bash
# Check status
cd /opt/ventiapi && docker-compose ps

# View logs
cd /opt/ventiapi && docker-compose logs -f

# Restart services
cd /opt/ventiapi && docker-compose restart

# Update application
cd /opt/ventiapi && git pull && docker-compose up -d --build

# Stop application
cd /opt/ventiapi && docker-compose down

# Start application
cd /opt/ventiapi && docker-compose up -d
```

### System Management
```bash
# Check disk usage
df -h

# Check memory usage
free -h

# Check Docker usage
docker system df

# Clean up old Docker images
docker system prune -f
```

## Security Considerations

1. **Change Default Passwords:**
   - Update `ADMIN_PASSWORD` in `.env.local`
   - Change `JWT_SECRET` to a random 32+ character string

2. **Restrict Access:**
   - Update `AllowedCIDR` in CloudFormation to your IP range
   - Consider using a VPN or bastion host for SSH access

3. **Enable HTTPS:**
   - Set up SSL certificates (Let's Encrypt recommended)
   - Update nginx configuration for HTTPS

4. **Monitor Security:**
   - Enable CloudWatch logging
   - Set up AWS CloudTrail
   - Monitor application logs for suspicious activity

## Monitoring and Logging

### CloudWatch Integration
The instance comes with CloudWatch agent pre-installed. Logs are available in:
- `/var/log/ventiapi/` - Application logs
- Docker container logs via `docker-compose logs`

### Health Checks
- Application health: `http://YOUR_IP:3000/health`
- API documentation: `http://YOUR_IP:3000/api/docs`

## Troubleshooting

### Common Issues

1. **Deployment Fails:**
   ```bash
   # Check CloudFormation events
   aws cloudformation describe-stack-events --stack-name ventiapi-scanner
   
   # Check instance logs
   aws ec2 get-console-output --instance-id INSTANCE_ID
   ```

2. **Application Won't Start:**
   ```bash
   # SSH to instance and check
   ssh -i ~/.ssh/ventiapi-key.pem ec2-user@YOUR_IP
   cd /opt/ventiapi
   docker-compose logs
   ```

3. **Out of Disk Space:**
   ```bash
   # Clean up Docker
   docker system prune -f
   docker volume prune -f
   
   # Check large files
   du -sh /opt/ventiapi/* | sort -h
   ```

4. **Performance Issues:**
   ```bash
   # Check resource usage
   htop
   docker stats
   
   # Consider upgrading instance type
   ```

### Getting Help

- Check application logs: `docker-compose logs`
- Monitor system resources: `htop`, `df -h`
- Review security groups if networking issues occur
- Check CloudFormation stack status in AWS Console

## Cleanup

To destroy all AWS resources:
```bash
./deploy.sh --destroy
```

**Warning:** This will permanently delete all data and resources!

## Cost Optimization

1. **Use Spot Instances:** Modify CloudFormation for 60-90% savings
2. **Schedule Shutdown:** Stop instance during non-business hours
3. **Right-Size Instance:** Start with t3.small and scale up if needed
4. **Monitor Usage:** Use AWS Cost Explorer to track spending

## Next Steps

1. **Set up Domain:** Point a domain name to your Elastic IP
2. **Enable HTTPS:** Use Let's Encrypt for SSL certificates
3. **Set up Monitoring:** Configure CloudWatch alerts
4. **Backup Strategy:** Implement automated backups
5. **Auto-Scaling:** Consider ECS/EKS for higher traffic