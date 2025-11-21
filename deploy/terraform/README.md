# VentiAPI Scanner - Terraform Deployment

This directory contains Terraform infrastructure-as-code for deploying VentiAPI Scanner to AWS.

## Prerequisites

1. **Terraform** >= 1.0.0
   ```bash
   brew install terraform  # macOS
   ```

2. **AWS CLI** configured with appropriate credentials
   ```bash
   aws configure --profile ventiapi
   ```

3. **AWS Permissions** required:
   - EC2 (instances, security groups, EIPs)
   - IAM (roles, policies, instance profiles)
   - Secrets Manager
   - CloudWatch Logs
   - (Optional) RDS, S3, DynamoDB, ACM, Route53

4. **SSH Key Pair** created in AWS
   ```bash
   aws ec2 create-key-pair --key-name ventiapi-key --query 'KeyMaterial' \
     --output text > ~/.ssh/ventiapi-key.pem
   chmod 400 ~/.ssh/ventiapi-key.pem
   ```

## Quick Start

### 1. Initialize Terraform

```bash
cd deploy/terraform
terraform init
```

### 2. Configure Sensitive Variables

Copy the template and fill in your values:

```bash
cp terraform.tfvars.local.example terraform.tfvars.local
# Edit terraform.tfvars.local with your actual API keys
```

Or use environment variables:

```bash
export TF_VAR_openai_api_key="sk-proj-..."
export TF_VAR_admin_password="YourSecurePassword"
```

### 3. Plan and Apply

```bash
# Preview changes
terraform plan -var-file="prod.tfvars" -var-file="terraform.tfvars.local"

# Apply changes
terraform apply -var-file="prod.tfvars" -var-file="terraform.tfvars.local"
```

### 4. Access Your Deployment

After successful deployment, Terraform outputs the connection details:

```bash
terraform output ssh_command    # SSH into the instance
terraform output urls           # Service URLs
terraform output public_ip      # Elastic IP address
```

## Configuration Files

| File | Purpose |
|------|---------|
| `main.tf` | EC2, security groups, IAM roles, Elastic IP |
| `variables.tf` | All variable definitions with defaults |
| `secrets.tf` | AWS Secrets Manager integration |
| `outputs.tf` | Terraform outputs |
| `cloudwatch.tf` | CloudWatch log groups |
| `backend.tf` | Optional S3 remote state |
| `rds.tf` | Optional RDS PostgreSQL |
| `acm.tf` | Optional SSL/TLS certificates |
| `user-data.sh` | EC2 bootstrap script |
| `prod.tfvars` | Production environment settings |
| `dev.tfvars` | Development environment settings |

## Environment Configurations

### Production (`prod.tfvars`)
- Instance type: `t3.medium`
- Recommended for live deployments

```bash
terraform apply -var-file="prod.tfvars" -var-file="terraform.tfvars.local"
```

### Development (`dev.tfvars`)
- Instance type: `t3.small`
- Uses `main` branch by default

```bash
terraform apply -var-file="dev.tfvars" -var-file="terraform.tfvars.local"
```

## Optional Features

### Remote State (Recommended for Teams)

Enable S3-based remote state for team collaboration:

1. Enable state resources:
   ```bash
   terraform apply -var-file="prod.tfvars" \
     -var="enable_remote_state_resources=true" \
     -var-file="terraform.tfvars.local"
   ```

2. Uncomment the backend block in `main.tf`

3. Migrate state:
   ```bash
   terraform init -migrate-state
   ```

### RDS PostgreSQL

Use AWS RDS instead of Docker PostgreSQL:

```bash
terraform apply -var-file="prod.tfvars" \
  -var="use_rds=true" \
  -var="rds_instance_class=db.t3.small" \
  -var-file="terraform.tfvars.local"
```

### SSL/TLS with Custom Domain

Enable HTTPS with ACM certificates:

```bash
terraform apply -var-file="prod.tfvars" \
  -var="domain_name=scanner.yourdomain.com" \
  -var="create_route53_records=true" \
  -var="route53_zone_id=Z1234567890" \
  -var-file="terraform.tfvars.local"
```

## Security Best Practices

1. **Restrict SSH Access**: Update `ssh_allowed_cidrs` in your tfvars:
   ```hcl
   ssh_allowed_cidrs = ["YOUR_IP/32"]
   ```

2. **Never Commit Secrets**: Keep `terraform.tfvars.local` gitignored

3. **Use Environment Variables** for CI/CD:
   ```bash
   export TF_VAR_openai_api_key=$OPENAI_API_KEY
   ```

4. **Enable EBS Encryption**: Already configured by default

5. **Review IAM Policies**: Minimal permissions are configured

## Updating/Redeploying

### Update Application Code

The EC2 instance clones the repo on first boot. To update:

```bash
# SSH into instance
ssh -i ~/.ssh/ventiapi-key.pem ec2-user@$(terraform output -raw public_ip)

# Pull latest code and restart
cd /opt/ventiapi
git pull
docker-compose down && docker-compose up -d
```

### Redeploy Infrastructure

```bash
# Taint the instance to force recreation
terraform taint aws_instance.ventiapi

# Apply to recreate
terraform apply -var-file="prod.tfvars" -var-file="terraform.tfvars.local"
```

### Update Secrets

1. Update variables in `terraform.tfvars.local`
2. Apply to update Secrets Manager:
   ```bash
   terraform apply -var-file="prod.tfvars" -var-file="terraform.tfvars.local"
   ```
3. Restart the instance or re-run user-data manually

## Disaster Recovery

### Backup State

```bash
# Local state backup
cp terraform.tfstate terraform.tfstate.backup

# Or use remote state (recommended)
```

### Recovery from State Loss

If state is lost but resources exist:

```bash
terraform import aws_instance.ventiapi i-1234567890abcdef0
terraform import aws_eip.ventiapi eipalloc-1234567890abcdef0
# ... import other resources
```

### Full Rebuild

```bash
terraform destroy -var-file="prod.tfvars" -var-file="terraform.tfvars.local"
terraform apply -var-file="prod.tfvars" -var-file="terraform.tfvars.local"
```

## Cost Estimation

| Resource | Monthly Cost (estimate) |
|----------|------------------------|
| EC2 t3.medium | ~$30 |
| Elastic IP | Free (when attached) |
| EBS 30GB gp3 | ~$2.50 |
| Secrets Manager | ~$0.40 |
| CloudWatch Logs | Variable |
| **Total (basic)** | **~$35/month** |

Optional additions:
- RDS db.t3.micro: ~$15/month
- Multi-AZ RDS: 2x base cost

## Troubleshooting

### Check Bootstrap Logs

```bash
ssh -i ~/.ssh/ventiapi-key.pem ec2-user@IP
cat /var/log/user-data.log
```

### Verify Services

```bash
docker-compose ps
docker-compose logs -f
```

### Check Secrets

```bash
aws secretsmanager get-secret-value \
  --secret-id ventiapi-scanner/prod/app-secrets \
  --region us-west-1
```

### Common Issues

1. **SSH Connection Refused**: Check security group rules
2. **Services Not Starting**: Check `/var/log/user-data.log`
3. **Database Errors**: Verify PostgreSQL container is healthy
4. **AI Features Not Working**: Verify `OPENAI_API_KEY` in Secrets Manager

## Cleanup

```bash
# Destroy all resources
terraform destroy -var-file="prod.tfvars" -var-file="terraform.tfvars.local"
```

**Warning**: This will delete all resources including data!
