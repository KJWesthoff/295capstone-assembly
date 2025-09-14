# AWS Deployment Guide

This guide provides step-by-step instructions for deploying the VentiAPI Scanner to AWS using containerized services.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          AWS Cloud                             │
├─────────────────────────────────────────────────────────────────┤
│  CloudFront CDN                                                │
│  └─ Static Asset Caching + SSL Termination                     │
├─────────────────────────────────────────────────────────────────┤
│  Application Load Balancer (ALB)                               │
│  └─ SSL Termination + Path-based Routing                       │
├─────────────────┬─────────────────┬─────────────────┬───────────┤
│  ECS Fargate    │  ECS Fargate    │  ElastiCache    │   EFS     │
│  Frontend       │  Backend API    │  Redis          │  Shared   │
│  (React)        │  (FastAPI)      │  (Session/Cache)│  Storage  │
│  Port 80        │  Port 8000      │  Port 6379      │           │
└─────────────────┴─────────────────┴─────────────────┴───────────┘
```

## Prerequisites

### Required Tools
- AWS CLI v2 installed and configured
- Docker installed locally
- jq installed for JSON processing
- Valid AWS account with appropriate permissions

### AWS Permissions Required
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecs:*",
                "ecr:*",
                "ec2:*",
                "elasticloadbalancing:*",
                "elasticache:*",
                "efs:*",
                "secretsmanager:*",
                "iam:*",
                "logs:*",
                "cloudfront:*",
                "acm:*",
                "route53:*"
            ],
            "Resource": "*"
        }
    ]
}
```

## Step 1: Environment Setup

### 1.1 Set Environment Variables
```bash
# Core configuration
export AWS_REGION="us-east-1"
export PROJECT_NAME="ventiapi-scanner"
export DOMAIN_NAME="your-domain.com"  # Optional: your custom domain
export ENVIRONMENT="production"

# Generate unique identifiers
export CLUSTER_NAME="${PROJECT_NAME}-cluster"
export ECR_REPOSITORY="${PROJECT_NAME}"
export VPC_NAME="${PROJECT_NAME}-vpc"
```

### 1.2 Configure AWS CLI
```bash
aws configure
# Enter your AWS Access Key ID, Secret Key, Default region, and output format
```

## Step 2: Create ECR Repositories

### 2.1 Create Repositories for Images
```bash
# Frontend repository
aws ecr create-repository \
    --repository-name ${PROJECT_NAME}/frontend \
    --region ${AWS_REGION}

# Backend API repository
aws ecr create-repository \
    --repository-name ${PROJECT_NAME}/backend \
    --region ${AWS_REGION}

# Scanner repository
aws ecr create-repository \
    --repository-name ${PROJECT_NAME}/scanner \
    --region ${AWS_REGION}

# Get ECR login token
aws ecr get-login-password --region ${AWS_REGION} | \
docker login --username AWS --password-stdin \
$(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com
```

## Step 3: Build and Push Docker Images

### 3.1 Build and Push Frontend
```bash
# Build frontend image
docker build -t ${PROJECT_NAME}/frontend ./frontend

# Tag for ECR
docker tag ${PROJECT_NAME}/frontend:latest \
$(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/frontend:latest

# Push to ECR
docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/frontend:latest
```

### 3.2 Build and Push Backend
```bash
# Build backend image
docker build -t ${PROJECT_NAME}/backend ./scanner-service/web-api

# Tag for ECR
docker tag ${PROJECT_NAME}/backend:latest \
$(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/backend:latest

# Push to ECR
docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/backend:latest
```

### 3.3 Build and Push Scanner
```bash
# Build scanner image
docker build -t ${PROJECT_NAME}/scanner ./external-scanner/ventiapi-scanner

# Tag for ECR
docker tag ${PROJECT_NAME}/scanner:latest \
$(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/scanner:latest

# Push to ECR
docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/scanner:latest
```

## Step 4: Create AWS Secrets Manager Secret

### 4.1 Create Production Secrets
```bash
# Create the secret with production values
aws secretsmanager create-secret \
    --name "${PROJECT_NAME}-secrets" \
    --description "Production secrets for VentiAPI Scanner" \
    --secret-string '{
        "JWT_SECRET": "'$(openssl rand -base64 32)'",
        "DEFAULT_ADMIN_USERNAME": "admin",
        "DEFAULT_ADMIN_PASSWORD": "'$(openssl rand -base64 16)'",
        "REDIS_URL": "redis://ventiapi-redis.cache.amazonaws.com:6379",
        "SCANNER_MAX_PARALLEL_CONTAINERS": "10",
        "SCANNER_CONTAINER_MEMORY_LIMIT": "1g",
        "FRONTEND_URL": "https://'${DOMAIN_NAME:-$(aws sts get-caller-identity --query Account --output text).execute-api.${AWS_REGION}.amazonaws.com}'",
        "ADDITIONAL_CORS_ORIGINS": "https://api.'${DOMAIN_NAME:-localhost}'"
    }' \
    --region ${AWS_REGION}

# Save admin credentials for later reference
aws secretsmanager get-secret-value \
    --secret-id "${PROJECT_NAME}-secrets" \
    --query SecretString --output text | \
    jq -r '"Admin Username: " + .DEFAULT_ADMIN_USERNAME + "\nAdmin Password: " + .DEFAULT_ADMIN_PASSWORD'
```

## Step 5: Create VPC and Networking

### 5.1 Create VPC
```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc \
    --cidr-block 10.0.0.0/16 \
    --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${VPC_NAME}}]" \
    --query 'Vpc.VpcId' --output text)

echo "Created VPC: $VPC_ID"

# Enable DNS hostnames
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames
```

### 5.2 Create Subnets
```bash
# Get availability zones
AZ1=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[0].ZoneName' --output text)
AZ2=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[1].ZoneName' --output text)

# Create public subnets
PUBLIC_SUBNET_1=$(aws ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block 10.0.1.0/24 \
    --availability-zone $AZ1 \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-public-1}]" \
    --query 'Subnet.SubnetId' --output text)

PUBLIC_SUBNET_2=$(aws ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block 10.0.2.0/24 \
    --availability-zone $AZ2 \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-public-2}]" \
    --query 'Subnet.SubnetId' --output text)

# Create private subnets
PRIVATE_SUBNET_1=$(aws ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block 10.0.3.0/24 \
    --availability-zone $AZ1 \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-private-1}]" \
    --query 'Subnet.SubnetId' --output text)

PRIVATE_SUBNET_2=$(aws ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block 10.0.4.0/24 \
    --availability-zone $AZ2 \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-private-2}]" \
    --query 'Subnet.SubnetId' --output text)

echo "Created subnets: $PUBLIC_SUBNET_1, $PUBLIC_SUBNET_2, $PRIVATE_SUBNET_1, $PRIVATE_SUBNET_2"
```

### 5.3 Create Internet Gateway and Route Tables
```bash
# Create internet gateway
IGW_ID=$(aws ec2 create-internet-gateway \
    --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${PROJECT_NAME}-igw}]" \
    --query 'InternetGateway.InternetGatewayId' --output text)

# Attach to VPC
aws ec2 attach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID

# Create route table for public subnets
PUBLIC_RT_ID=$(aws ec2 create-route-table \
    --vpc-id $VPC_ID \
    --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${PROJECT_NAME}-public-rt}]" \
    --query 'RouteTable.RouteTableId' --output text)

# Add internet route
aws ec2 create-route --route-table-id $PUBLIC_RT_ID --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID

# Associate public subnets with route table
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_1 --route-table-id $PUBLIC_RT_ID
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_2 --route-table-id $PUBLIC_RT_ID

# Enable auto-assign public IP for public subnets
aws ec2 modify-subnet-attribute --subnet-id $PUBLIC_SUBNET_1 --map-public-ip-on-launch
aws ec2 modify-subnet-attribute --subnet-id $PUBLIC_SUBNET_2 --map-public-ip-on-launch
```

## Step 6: Create ElastiCache Redis Cluster

### 6.1 Create Redis Subnet Group
```bash
aws elasticache create-cache-subnet-group \
    --cache-subnet-group-name "${PROJECT_NAME}-redis-subnet-group" \
    --cache-subnet-group-description "Subnet group for VentiAPI Scanner Redis" \
    --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2
```

### 6.2 Create Security Group for Redis
```bash
REDIS_SG_ID=$(aws ec2 create-security-group \
    --group-name "${PROJECT_NAME}-redis-sg" \
    --description "Security group for Redis cache" \
    --vpc-id $VPC_ID \
    --query 'GroupId' --output text)

# Allow Redis access from ECS tasks (port 6379)
aws ec2 authorize-security-group-ingress \
    --group-id $REDIS_SG_ID \
    --protocol tcp \
    --port 6379 \
    --source-group $REDIS_SG_ID
```

### 6.3 Create Redis Cluster
```bash
aws elasticache create-cache-cluster \
    --cache-cluster-id "${PROJECT_NAME}-redis" \
    --cache-node-type cache.t3.micro \
    --engine redis \
    --num-cache-nodes 1 \
    --cache-subnet-group-name "${PROJECT_NAME}-redis-subnet-group" \
    --security-group-ids $REDIS_SG_ID \
    --tags Key=Name,Value="${PROJECT_NAME}-redis"

# Wait for cluster to be available
aws elasticache wait cache-cluster-available --cache-cluster-id "${PROJECT_NAME}-redis"
```

## Step 7: Create EFS for Shared Storage

### 7.1 Create EFS File System
```bash
# Create EFS
EFS_ID=$(aws efs create-file-system \
    --throughput-mode provisioned \
    --provisioned-throughput-in-mibps 100 \
    --performance-mode generalPurpose \
    --tags Key=Name,Value="${PROJECT_NAME}-efs" \
    --query 'FileSystemId' --output text)

echo "Created EFS: $EFS_ID"
```

### 7.2 Create EFS Mount Targets
```bash
# Create security group for EFS
EFS_SG_ID=$(aws ec2 create-security-group \
    --group-name "${PROJECT_NAME}-efs-sg" \
    --description "Security group for EFS" \
    --vpc-id $VPC_ID \
    --query 'GroupId' --output text)

# Allow NFS access from ECS tasks
aws ec2 authorize-security-group-ingress \
    --group-id $EFS_SG_ID \
    --protocol tcp \
    --port 2049 \
    --source-group $EFS_SG_ID

# Create mount targets
aws efs create-mount-target \
    --file-system-id $EFS_ID \
    --subnet-id $PRIVATE_SUBNET_1 \
    --security-groups $EFS_SG_ID

aws efs create-mount-target \
    --file-system-id $EFS_ID \
    --subnet-id $PRIVATE_SUBNET_2 \
    --security-groups $EFS_SG_ID
```

## Step 8: Create ECS Cluster

### 8.1 Create ECS Cluster
```bash
aws ecs create-cluster \
    --cluster-name $CLUSTER_NAME \
    --capacity-providers FARGATE \
    --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
    --tags key=Name,value=$CLUSTER_NAME
```

### 8.2 Create ECS Execution Role
```bash
# Create execution role
aws iam create-role \
    --role-name "${PROJECT_NAME}-ecs-execution-role" \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "ecs-tasks.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }'

# Attach policies
aws iam attach-role-policy \
    --role-name "${PROJECT_NAME}-ecs-execution-role" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

aws iam attach-role-policy \
    --role-name "${PROJECT_NAME}-ecs-execution-role" \
    --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
```

### 8.3 Create ECS Task Role
```bash
# Create task role for backend (needs Docker access)
aws iam create-role \
    --role-name "${PROJECT_NAME}-ecs-task-role" \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "ecs-tasks.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }'

# Create custom policy for Docker access and Secrets Manager
aws iam put-role-policy \
    --role-name "${PROJECT_NAME}-ecs-task-role" \
    --policy-name "VentiAPITaskPolicy" \
    --policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "secretsmanager:GetSecretValue",
                    "ecs:RunTask",
                    "ecs:StopTask",
                    "ecs:DescribeTasks",
                    "iam:PassRole"
                ],
                "Resource": "*"
            }
        ]
    }'
```

## Step 9: Create Load Balancer

### 9.1 Create Security Groups
```bash
# ALB Security Group
ALB_SG_ID=$(aws ec2 create-security-group \
    --group-name "${PROJECT_NAME}-alb-sg" \
    --description "Security group for ALB" \
    --vpc-id $VPC_ID \
    --query 'GroupId' --output text)

# Allow HTTP and HTTPS
aws ec2 authorize-security-group-ingress \
    --group-id $ALB_SG_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
    --group-id $ALB_SG_ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0

# ECS Security Group
ECS_SG_ID=$(aws ec2 create-security-group \
    --group-name "${PROJECT_NAME}-ecs-sg" \
    --description "Security group for ECS services" \
    --vpc-id $VPC_ID \
    --query 'GroupId' --output text)

# Allow traffic from ALB
aws ec2 authorize-security-group-ingress \
    --group-id $ECS_SG_ID \
    --protocol tcp \
    --port 80 \
    --source-group $ALB_SG_ID

aws ec2 authorize-security-group-ingress \
    --group-id $ECS_SG_ID \
    --protocol tcp \
    --port 8000 \
    --source-group $ALB_SG_ID

# Allow ECS tasks to access Redis and EFS
aws ec2 authorize-security-group-ingress \
    --group-id $REDIS_SG_ID \
    --protocol tcp \
    --port 6379 \
    --source-group $ECS_SG_ID

aws ec2 authorize-security-group-ingress \
    --group-id $EFS_SG_ID \
    --protocol tcp \
    --port 2049 \
    --source-group $ECS_SG_ID
```

### 9.2 Create Application Load Balancer
```bash
ALB_ARN=$(aws elbv2 create-load-balancer \
    --name "${PROJECT_NAME}-alb" \
    --subnets $PUBLIC_SUBNET_1 $PUBLIC_SUBNET_2 \
    --security-groups $ALB_SG_ID \
    --tags Key=Name,Value="${PROJECT_NAME}-alb" \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns $ALB_ARN \
    --query 'LoadBalancers[0].DNSName' --output text)

echo "ALB DNS: $ALB_DNS"
```

### 9.3 Create Target Groups
```bash
# Frontend target group
FRONTEND_TG_ARN=$(aws elbv2 create-target-group \
    --name "${PROJECT_NAME}-frontend-tg" \
    --protocol HTTP \
    --port 80 \
    --vpc-id $VPC_ID \
    --target-type ip \
    --health-check-path "/" \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 10 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --query 'TargetGroups[0].TargetGroupArn' --output text)

# Backend target group
BACKEND_TG_ARN=$(aws elbv2 create-target-group \
    --name "${PROJECT_NAME}-backend-tg" \
    --protocol HTTP \
    --port 8000 \
    --vpc-id $VPC_ID \
    --target-type ip \
    --health-check-path "/health" \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 10 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --query 'TargetGroups[0].TargetGroupArn' --output text)
```

### 9.4 Create Load Balancer Listeners
```bash
# HTTP Listener (redirect to HTTPS in production)
aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=$FRONTEND_TG_ARN

# Create listener rules for API routing
LISTENER_ARN=$(aws elbv2 describe-listeners \
    --load-balancer-arn $ALB_ARN \
    --query 'Listeners[0].ListenerArn' --output text)

# API path routing
aws elbv2 create-rule \
    --listener-arn $LISTENER_ARN \
    --priority 100 \
    --conditions Field=path-pattern,Values="/api/*" \
    --actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN
```

## Step 10: Create ECS Services

### 10.1 Create Task Definitions

#### Frontend Task Definition
```bash
cat > frontend-task-def.json << EOF
{
    "family": "${PROJECT_NAME}-frontend",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "256",
    "memory": "512",
    "executionRoleArn": "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/${PROJECT_NAME}-ecs-execution-role",
    "containerDefinitions": [
        {
            "name": "frontend",
            "image": "$(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/frontend:latest",
            "portMappings": [
                {
                    "containerPort": 80,
                    "protocol": "tcp"
                }
            ],
            "essential": true,
            "environment": [
                {
                    "name": "REACT_APP_API_URL",
                    "value": "https://${ALB_DNS}"
                }
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/${PROJECT_NAME}-frontend",
                    "awslogs-region": "${AWS_REGION}",
                    "awslogs-stream-prefix": "ecs",
                    "awslogs-create-group": "true"
                }
            }
        }
    ]
}
EOF

aws ecs register-task-definition --cli-input-json file://frontend-task-def.json
```

#### Backend Task Definition
```bash
cat > backend-task-def.json << EOF
{
    "family": "${PROJECT_NAME}-backend",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "512",
    "memory": "1024",
    "executionRoleArn": "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/${PROJECT_NAME}-ecs-execution-role",
    "taskRoleArn": "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/${PROJECT_NAME}-ecs-task-role",
    "volumes": [
        {
            "name": "shared-storage",
            "efsVolumeConfiguration": {
                "fileSystemId": "${EFS_ID}",
                "rootDirectory": "/"
            }
        }
    ],
    "containerDefinitions": [
        {
            "name": "backend",
            "image": "$(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/backend:latest",
            "portMappings": [
                {
                    "containerPort": 8000,
                    "protocol": "tcp"
                }
            ],
            "essential": true,
            "mountPoints": [
                {
                    "sourceVolume": "shared-storage",
                    "containerPath": "/shared"
                }
            ],
            "environment": [
                {
                    "name": "PYTHONUNBUFFERED",
                    "value": "1"
                },
                {
                    "name": "SECRET_NAME",
                    "value": "${PROJECT_NAME}-secrets"
                },
                {
                    "name": "AWS_REGION",
                    "value": "${AWS_REGION}"
                }
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/${PROJECT_NAME}-backend",
                    "awslogs-region": "${AWS_REGION}",
                    "awslogs-stream-prefix": "ecs",
                    "awslogs-create-group": "true"
                }
            }
        }
    ]
}
EOF

aws ecs register-task-definition --cli-input-json file://backend-task-def.json
```

### 10.2 Create ECS Services
```bash
# Frontend service
aws ecs create-service \
    --cluster $CLUSTER_NAME \
    --service-name "${PROJECT_NAME}-frontend" \
    --task-definition "${PROJECT_NAME}-frontend:1" \
    --desired-count 2 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG_ID],assignPublicIp=DISABLED}" \
    --load-balancers "targetGroupArn=$FRONTEND_TG_ARN,containerName=frontend,containerPort=80"

# Backend service
aws ecs create-service \
    --cluster $CLUSTER_NAME \
    --service-name "${PROJECT_NAME}-backend" \
    --task-definition "${PROJECT_NAME}-backend:1" \
    --desired-count 2 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG_ID],assignPublicIp=DISABLED}" \
    --load-balancers "targetGroupArn=$BACKEND_TG_ARN,containerName=backend,containerPort=8000"
```

## Step 11: Configure DNS and SSL (Optional)

### 11.1 Request SSL Certificate (if using custom domain)
```bash
# Only if you have a custom domain
if [ ! -z "$DOMAIN_NAME" ]; then
    CERT_ARN=$(aws acm request-certificate \
        --domain-name $DOMAIN_NAME \
        --domain-name "*.${DOMAIN_NAME}" \
        --validation-method DNS \
        --query 'CertificateArn' --output text)
    
    echo "Certificate requested: $CERT_ARN"
    echo "Complete DNS validation in ACM console, then create HTTPS listener"
fi
```

### 11.2 Create Route53 Records (if using custom domain)
```bash
# Create hosted zone and update nameservers with your domain registrar
# This is domain registrar specific - follow AWS Route53 documentation
```

## Step 12: Deployment Script Integration

### 12.1 Update Production Deployment Script
The existing production deployment script (`scripts/deploy-production.sh`) can be adapted for ECS:

```bash
#!/bin/bash
# ECS Production Deployment Script

set -e

echo "🚀 Starting ECS Production Deployment..."

# Fetch secrets from AWS Secrets Manager
source ./scripts/fetch-secrets.sh

# Build and push updated images
./deploy-to-ecr.sh

# Update ECS services
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service "${PROJECT_NAME}-frontend" \
    --force-new-deployment

aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service "${PROJECT_NAME}-backend" \
    --force-new-deployment

echo "✅ Deployment completed successfully!"
```

## Step 13: Monitoring and Logging

### 13.1 CloudWatch Dashboards
```bash
# Create CloudWatch dashboard for monitoring
aws cloudwatch put-dashboard \
    --dashboard-name "${PROJECT_NAME}-dashboard" \
    --dashboard-body file://cloudwatch-dashboard.json
```

### 13.2 Set Up Alarms
```bash
# High CPU alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "${PROJECT_NAME}-high-cpu" \
    --alarm-description "High CPU usage" \
    --metric-name CPUUtilization \
    --namespace AWS/ECS \
    --statistic Average \
    --period 300 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=ServiceName,Value="${PROJECT_NAME}-backend" Name=ClusterName,Value=$CLUSTER_NAME \
    --evaluation-periods 2
```

## Step 14: Testing Deployment

### 14.1 Health Checks
```bash
# Test ALB health
curl -f http://$ALB_DNS/health

# Test API endpoints
curl -f http://$ALB_DNS/api/auth/me
```

### 14.2 Load Testing
```bash
# Install Apache Bench for load testing
sudo apt-get install apache2-utils

# Test concurrent requests
ab -n 1000 -c 10 http://$ALB_DNS/
```

## Step 15: Maintenance and Updates

### 15.1 Rolling Updates
```bash
# Update task definitions and force new deployment
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service "${PROJECT_NAME}-backend" \
    --task-definition "${PROJECT_NAME}-backend:2" \
    --force-new-deployment
```

### 15.2 Scaling
```bash
# Scale services
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service "${PROJECT_NAME}-backend" \
    --desired-count 5
```

### 15.3 Backup and Recovery
```bash
# Backup EFS data
aws efs create-backup-vault \
    --backup-vault-name "${PROJECT_NAME}-backup-vault"

# Create backup plan for EFS
aws backup put-backup-plan --backup-plan file://backup-plan.json
```

## Cleanup

### To remove all resources:
```bash
# Delete ECS services and cluster
aws ecs update-service --cluster $CLUSTER_NAME --service "${PROJECT_NAME}-frontend" --desired-count 0
aws ecs update-service --cluster $CLUSTER_NAME --service "${PROJECT_NAME}-backend" --desired-count 0
aws ecs delete-service --cluster $CLUSTER_NAME --service "${PROJECT_NAME}-frontend" --force
aws ecs delete-service --cluster $CLUSTER_NAME --service "${PROJECT_NAME}-backend" --force
aws ecs delete-cluster --cluster $CLUSTER_NAME

# Delete load balancer
aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN

# Delete target groups
aws elbv2 delete-target-group --target-group-arn $FRONTEND_TG_ARN
aws elbv2 delete-target-group --target-group-arn $BACKEND_TG_ARN

# Delete ElastiCache
aws elasticache delete-cache-cluster --cache-cluster-id "${PROJECT_NAME}-redis"

# Delete EFS
aws efs delete-file-system --file-system-id $EFS_ID

# Delete VPC (this will delete associated resources)
aws ec2 delete-vpc --vpc-id $VPC_ID
```

## Troubleshooting

### Common Issues

1. **ECS Tasks Failing to Start**
   - Check CloudWatch logs: `/ecs/${PROJECT_NAME}-backend`
   - Verify IAM roles have correct permissions
   - Ensure security groups allow required traffic

2. **Load Balancer Health Checks Failing**
   - Verify target group health check settings
   - Check application is listening on correct port
   - Ensure security groups allow ALB → ECS traffic

3. **Can't Access Secrets Manager**
   - Verify execution role has `SecretsManagerReadWrite` policy
   - Check secret name matches environment variable
   - Ensure region is correct

4. **EFS Mount Issues**
   - Verify EFS security group allows NFS (port 2049)
   - Check EFS mount targets exist in correct subnets
   - Ensure ECS task role has EFS permissions

5. **Redis Connection Issues**
   - Verify Redis security group allows connections from ECS
   - Check Redis cluster is in same VPC
   - Ensure Redis URL is correct in secrets

### Useful Commands

```bash
# View ECS service status
aws ecs describe-services --cluster $CLUSTER_NAME --services "${PROJECT_NAME}-backend"

# View running tasks
aws ecs list-tasks --cluster $CLUSTER_NAME --service-name "${PROJECT_NAME}-backend"

# Get task details
aws ecs describe-tasks --cluster $CLUSTER_NAME --tasks <task-arn>

# View CloudWatch logs
aws logs describe-log-streams --log-group-name "/ecs/${PROJECT_NAME}-backend"

# Check load balancer target health
aws elbv2 describe-target-health --target-group-arn $BACKEND_TG_ARN
```

## Security Considerations

1. **Network Security**
   - Services deployed in private subnets
   - Security groups restrict access to necessary ports only
   - No direct internet access to backend services

2. **Secrets Management**
   - All secrets stored in AWS Secrets Manager
   - No hardcoded credentials in images or task definitions
   - Secrets encrypted at rest and in transit

3. **Access Control**
   - IAM roles follow principle of least privilege
   - ECS execution role separate from task role
   - No AWS credentials stored in containers

4. **Data Protection**
   - EFS encrypted at rest (enable in production)
   - ALB with SSL termination (configure certificate)
   - Redis with encryption in transit (enable for production)

## Cost Optimization

1. **Right-sizing Resources**
   - Monitor CPU/Memory usage and adjust task definitions
   - Use Fargate Spot for non-critical workloads
   - Implement auto-scaling based on metrics

2. **Storage Optimization**
   - Use EFS Intelligent Tiering
   - Clean up old scan results regularly
   - Optimize image sizes to reduce ECR costs

3. **Network Costs**
   - Keep inter-service communication within same AZ when possible
   - Use CloudFront CDN for static assets
   - Monitor data transfer costs

This deployment guide provides a production-ready AWS infrastructure for the VentiAPI Scanner with proper security, monitoring, and scalability considerations.