# Agent Prompt: Complete VentiAPI Terraform Implementation

## Context

You are tasked with completing the Terraform infrastructure-as-code implementation for VentiAPI Scanner. A scaffold has been created with the core structure, but several features need to be fully implemented and tested.

## Current State

The following files exist in `deploy/terraform/`:
- `main.tf` - EC2, security groups, IAM roles, Elastic IP (partially complete)
- `variables.tf` - All variables defined with defaults
- `secrets.tf` - AWS Secrets Manager integration
- `user-data.sh` - Bootstrap script that pulls secrets and deploys app
- `dev.tfvars` / `prod.tfvars` - Environment-specific configurations
- `.gitignore` - Properly configured to exclude sensitive files

The following files exist in `deploy/local/`:
- `start-local.sh` - Script to start services locally without Terraform
- `README.md` - Local development documentation

## Tasks to Complete

### 1. Terraform Validation & Testing
- [ ] Run `terraform init` and fix any provider issues
- [ ] Run `terraform validate` and fix any syntax errors
- [ ] Run `terraform plan -var-file="prod.tfvars"` with test values
- [ ] Create a `terraform.tfvars.local` template with placeholder values for testing

### 2. Security Group Enhancements
- [ ] Add VPC ID to security group resource (currently missing)
- [ ] Consider adding HTTPS (443) redirect rule
- [ ] Add option to restrict SSH to specific IPs via variable

### 3. Remote State Backend (Optional but Recommended)
- [ ] Create S3 bucket for Terraform state: `ventiapi-terraform-state`
- [ ] Create DynamoDB table for state locking: `ventiapi-terraform-locks`
- [ ] Uncomment and configure the backend block in `main.tf`
- [ ] Create `backend.tf` with backend configuration

### 4. Additional Outputs
Create `outputs.tf` with:
- [ ] Instance ID
- [ ] Public IP (Elastic IP)
- [ ] SSH connection command
- [ ] All service URLs (scanner, cedar, mastra, api)
- [ ] Secrets Manager ARN (sensitive)
- [ ] Security Group ID

### 5. Database Options
Add optional RDS PostgreSQL support:
- [ ] Create `rds.tf` with conditional RDS instance
- [ ] Add variable `use_rds = false` (default to Docker PostgreSQL)
- [ ] Update `user-data.sh` to use RDS connection string if enabled
- [ ] Add RDS security group rules

### 6. SSL/TLS Support
- [ ] Create `acm.tf` for AWS Certificate Manager
- [ ] Add variable for domain name
- [ ] Create Route53 records (optional)
- [ ] Configure ALB with HTTPS listener (optional enhancement)

### 7. Monitoring & Logging
- [ ] Add CloudWatch log group for application logs

### 8. Documentation
Update `deploy/terraform/README.md` with:
- [ ] Prerequisites (Terraform, AWS CLI, credentials)
- [ ] Step-by-step deployment instructions
- [ ] How to set sensitive variables securely
- [ ] How to update/redeploy
- [ ] Disaster recovery procedures
- [ ] Cost estimation

## Files to Reference

### Existing Application Files
- `docker-compose.yml` - Service definitions
- `scanner-service/web-api/` - FastAPI backend
- `cedar-mastra/` - Next.js + Mastra application
- `database/init/` - Database migration scripts
- `database/dumps/` - Database dump for restore

### Current Deployment Documentation
- `DEPLOYMENT_HANDOFF.md` - Manual deployment steps
- `EC2_DEPLOYMENT_CHECKLIST.md` - Deployment verification
- `EC2_DEPLOYMENT_TROUBLESHOOTING.md` - Common issues

## Testing Procedure

1. **Local Validation**
   ```bash
   cd deploy/terraform
   terraform init
   terraform validate
   terraform plan -var-file="prod.tfvars" \
     -var="openai_api_key=test" \
     -var="admin_password=test"
   ```

2. **Dry Run Deployment**
   ```bash
   terraform apply -var-file="prod.tfvars" \
     -var="openai_api_key=$OPENAI_API_KEY" \
     -var="admin_password=$ADMIN_PASSWORD" \
     -auto-approve
   ```

3. **Verification**
   - SSH into instance
   - Check `/var/log/user-data.log` for bootstrap output
   - Verify all Docker services running
   - Test each service URL
   - Run a scan test

4. **Cleanup**
   ```bash
   terraform destroy -var-file="prod.tfvars" -auto-approve
   ```

## Important Considerations

### Security
- Never commit `.tfvars` files with real secrets
- Use environment variables or AWS credentials for sensitive values
- Restrict SSH access in production (`ssh_allowed_cidrs`)
- Enable EBS encryption (already configured)
- Consider VPC with private subnets for production

### Cost Optimization
- Use `t3.small` for dev, `t3.medium` for prod
- Consider Spot instances for non-production
- Set up billing alerts

### High Availability (Future)
- Multi-AZ deployment with ALB
- Auto Scaling Group
- RDS Multi-AZ

## Success Criteria

The implementation is complete when:
1. `terraform apply` successfully provisions all resources
2. Application is accessible at all service URLs
3. Secrets are properly loaded from Secrets Manager
4. Database is initialized with schema and data
5. Scans can be executed successfully
6. Cedar AI features work with proper API keys
7. Documentation is complete and accurate
8. CI/CD pipeline validates changes

## Notes

- The current implementation uses Docker Compose on EC2, which is appropriate for the project's scale
- Migration to ECS/EKS is possible but not necessary for the capstone
- Focus on making the current setup reproducible and well-documented
