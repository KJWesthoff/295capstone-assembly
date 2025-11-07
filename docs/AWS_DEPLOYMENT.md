# VentiAPI Scanner - AWS Deployment Guide

A complete guide for deploying VentiAPI Scanner to AWS EC2 with Docker Compose support for MVP usage.

## 🎯 Overview

This deployment solution provides:
- **One-command deployment** to AWS EC2
- **Docker-in-Docker support** (preserves your scanner architecture)
- **Production-ready configuration** with logging and monitoring
- **Cost-optimized** for MVP usage (~$35-40/month)
- **Easy management** and scaling options

## 📋 Prerequisites

### 1. AWS Account Setup
- AWS account with programmatic access
- IAM user with EC2, VPC, and CloudFormation permissions
- AWS CLI installed and configured

### 2. Local Requirements
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI
aws configure
```

### 3. EC2 Key Pair
```bash
# Create key pair for SSH access
aws ec2 create-key-pair --key-name ventiapi-key --query 'KeyMaterial' --output text > ~/.ssh/ventiapi-key.pem
chmod 400 ~/.ssh/ventiapi-key.pem
```

## 🚀 Quick Deployment

### Step 1: Deploy Infrastructure
```bash
cd deploy
./deploy.sh
```

The script will:
1. **Create AWS infrastructure** (VPC, EC2, Security Groups)
2. **Install dependencies** (Docker, Git, CloudWatch)
3. **Deploy application** (Clone repo, build containers)
4. **Provide access URLs** and management commands

### Step 2: Configure Application
```bash
# SSH to your instance
ssh -i ~/.ssh/ventiapi-key.pem ec2-user@YOUR_PUBLIC_IP

# Update environment configuration
cd /opt/ventiapi
sudo cp deploy/.env.production .env.local
sudo nano .env.local  # Update passwords and secrets
```

### Step 3: Access Your Application
- **Application**: `http://YOUR_PUBLIC_IP:3000`
- **API Docs**: `http://YOUR_PUBLIC_IP:3000/api/docs`
- **Admin Login**: Use credentials from `.env.local`

## 📁 Deployment Files

### Infrastructure
- **`deploy/cloudformation.yml`** - AWS infrastructure template
- **`deploy/deploy.sh`** - Automated deployment script

### Configuration
- **`deploy/docker-compose.prod.yml`** - Production Docker overrides
- **`deploy/.env.production`** - Environment template
- **`deploy/README.md`** - Detailed deployment guide

## ⚙️ AWS Architecture

```
Internet Gateway
       ↓
   Public Subnet
       ↓
  EC2 Instance (t3.medium)
    ├── Docker Engine
    ├── Nginx (Port 80/443)
    ├── React Frontend
    ├── FastAPI Backend
    ├── Redis Cache
    └── Scanner Containers
```

### Resources Created
- **VPC** with public subnet
- **EC2 instance** (t3.medium, 30GB storage)
- **Security Groups** (SSH, HTTP, HTTPS)
- **Elastic IP** (static public IP)
- **IAM Role** for CloudWatch logging

## 💰 Cost Breakdown

| Resource | Type | Monthly Cost |
|----------|------|--------------|
| EC2 Instance | t3.medium | ~$30 |
| EBS Storage | 30GB gp3 | ~$3 |
| Elastic IP | Static IP | $0* |
| Data Transfer | Outbound | ~$5-10 |
| **Total** | | **~$35-40** |

*Free while attached to running instance

### Cost Optimization Options
1. **t3.small**: Reduce to ~$15/month for light usage
2. **Spot Instances**: 60-90% savings (less reliable)
3. **Scheduled Shutdown**: Stop during off-hours
4. **Reserved Instances**: 1-year commitment for 30% savings

## 🔧 Management Commands

### Application Management
```bash
# Connect to instance
ssh -i ~/.ssh/ventiapi-key.pem ec2-user@YOUR_PUBLIC_IP

# Check application status
cd /opt/ventiapi && docker-compose ps

# View logs
cd /opt/ventiapi && docker-compose logs -f

# Restart services
cd /opt/ventiapi && docker-compose restart

# Update application
cd /opt/ventiapi && git pull && docker-compose up -d --build

# Stop/Start application
cd /opt/ventiapi && docker-compose down
cd /opt/ventiapi && docker-compose up -d
```

### System Monitoring
```bash
# Check system resources
htop
df -h
free -h

# Monitor Docker containers
docker stats
docker system df

# Clean up Docker resources
docker system prune -f
docker volume prune -f
```

## 🔒 Security Configuration

### 1. Change Default Credentials
```bash
# Update .env.local with secure values
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-minimum-32-characters
ADMIN_PASSWORD=your-secure-admin-password-here
```

### 2. Restrict Network Access
```bash
# Update CloudFormation AllowedCIDR parameter
# From: 0.0.0.0/0 (open to world)
# To: YOUR_IP/32 (your IP only)
```

### 3. Enable HTTPS (Optional)
```bash
# Install Let's Encrypt certificates
sudo yum install -y certbot
sudo certbot certonly --standalone -d your-domain.com

# Update nginx configuration for SSL
```

## 📊 Monitoring and Logging

### CloudWatch Integration
- **Instance metrics** automatically sent to CloudWatch
- **Application logs** available in `/var/log/ventiapi/`
- **Docker logs** via `docker-compose logs`

### Health Checks
- **Application health**: `http://YOUR_IP:3000/health`
- **API status**: `http://YOUR_IP:3000/api/docs`
- **System status**: SSH and check `docker-compose ps`

### Setting Up Alerts
```bash
# Create CloudWatch alarm for high CPU
aws cloudwatch put-metric-alarm \
  --alarm-name "VentiAPI-HighCPU" \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=InstanceId,Value=YOUR_INSTANCE_ID \
  --evaluation-periods 2
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Deployment Fails
```bash
# Check CloudFormation stack status
aws cloudformation describe-stack-events --stack-name ventiapi-scanner

# Check instance initialization logs
aws ec2 get-console-output --instance-id YOUR_INSTANCE_ID
```

#### 2. Application Won't Start
```bash
# SSH to instance and diagnose
ssh -i ~/.ssh/ventiapi-key.pem ec2-user@YOUR_IP
cd /opt/ventiapi
docker-compose logs
docker-compose ps
```

#### 3. Out of Disk Space
```bash
# Clean up Docker resources
docker system prune -f
docker volume prune -f

# Check disk usage
du -sh /opt/ventiapi/* | sort -h
df -h
```

#### 4. Can't Access Application
```bash
# Check security groups
aws ec2 describe-security-groups --group-ids YOUR_SECURITY_GROUP_ID

# Check if services are running
docker-compose ps
netstat -tlnp | grep :3000
```

#### 5. Performance Issues
```bash
# Monitor resource usage
htop
docker stats

# Consider upgrading instance type
aws ec2 modify-instance-attribute --instance-id YOUR_INSTANCE_ID --instance-type t3.large
```

## 📈 Scaling Options

### Vertical Scaling (Upgrade Instance)
```bash
# Stop instance
aws ec2 stop-instances --instance-ids YOUR_INSTANCE_ID

# Change instance type
aws ec2 modify-instance-attribute --instance-id YOUR_INSTANCE_ID --instance-type t3.large

# Start instance
aws ec2 start-instances --instance-ids YOUR_INSTANCE_ID
```

### Horizontal Scaling (Multiple Instances)
When you outgrow a single instance, consider:
1. **Application Load Balancer** + multiple EC2 instances
2. **Amazon ECS** with Fargate for container orchestration
3. **Amazon EKS** for Kubernetes-based scaling

## 🔄 Backup and Recovery

### Automated Backups
```bash
# Create AMI snapshot
aws ec2 create-image --instance-id YOUR_INSTANCE_ID --name "ventiapi-backup-$(date +%Y%m%d)"

# Schedule daily backups with cron
0 2 * * * aws ec2 create-image --instance-id YOUR_INSTANCE_ID --name "ventiapi-backup-$(date +%Y%m%d)"
```

### Data Backup
```bash
# Backup application data
tar -czf ventiapi-data-backup.tar.gz /opt/ventiapi/data/

# Upload to S3
aws s3 cp ventiapi-data-backup.tar.gz s3://your-backup-bucket/
```

## 🚮 Cleanup

### Destroy All Resources
```bash
cd deploy
./deploy.sh --destroy
```

**⚠️ Warning**: This permanently deletes all AWS resources and data!

### Partial Cleanup
```bash
# Stop instance (keeps EBS storage)
aws ec2 stop-instances --instance-ids YOUR_INSTANCE_ID

# Terminate instance (deletes everything)
aws ec2 terminate-instances --instance-ids YOUR_INSTANCE_ID
```

## 🔮 Next Steps

### Production Enhancements
1. **Domain Setup**: Point domain to Elastic IP
2. **HTTPS/SSL**: Enable SSL certificates
3. **CDN**: Add CloudFront for static assets
4. **Database**: Move to RDS for production data
5. **Monitoring**: Enhanced CloudWatch dashboards

### Scaling Preparation
1. **Container Registry**: Move to ECR
2. **Load Balancing**: Prepare for multiple instances
3. **Auto Scaling**: Implement based on metrics
4. **CI/CD Pipeline**: Automate deployments

### Security Hardening
1. **VPN/Bastion**: Restrict SSH access
2. **WAF**: Web Application Firewall
3. **Secrets Manager**: Centralized secret management
4. **Compliance**: SOC2, PCI-DSS if needed

## 📞 Support

### Getting Help
- **Application logs**: `docker-compose logs`
- **System logs**: `/var/log/messages`
- **CloudFormation events**: AWS Console
- **Instance console**: EC2 → Instances → Actions → Instance Settings → Get System Log

### Useful Resources
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [CloudFormation Documentation](https://docs.aws.amazon.com/cloudformation/)

---

## 📝 Summary

This deployment provides a production-ready VentiAPI Scanner on AWS with:

✅ **One-command deployment**  
✅ **Docker-in-Docker support**  
✅ **Production configurations**  
✅ **Cost optimization**  
✅ **Easy management**  
✅ **Monitoring and logging**  
✅ **Security best practices**  
✅ **Scaling options**  

Perfect for MVP deployment with room to grow!

---

*Estimated setup time: 15-20 minutes*  
*Estimated monthly cost: $35-40*  
*Complexity level: Beginner to Intermediate*