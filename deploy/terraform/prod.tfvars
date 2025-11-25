# Production Environment Configuration
# Usage: terraform apply -var-file="prod.tfvars"

environment    = "prod"
project_name   = "ventiapi-scanner"
aws_region     = "us-west-1"
aws_profile    = "ventiapi"
instance_type  = "t3.medium"
key_pair_name  = "ventiapi-key"

# Restrict SSH access in production (replace with your IP)
ssh_allowed_cidrs = ["0.0.0.0/0"]  # TODO: Restrict to specific IPs

# Git deployment
github_repo   = "https://github.com/KJWesthoff/295capstone-assembly.git"
github_branch = "deploy-develop2-aws"

# Database (using Docker-internal PostgreSQL)
postgres_user     = "rag_user"
postgres_password = "rag_pass"
postgres_db       = "rag_db"

# =============================================================================
# SENSITIVE VALUES - Set via environment variables or terraform.tfvars.local
# =============================================================================
#
# Create a terraform.tfvars.local file (gitignored) with:
#
#   openai_api_key  = "sk-proj-..."
#   admin_password  = "YourSecurePassword"
#   jwt_secret      = "your-32-char-jwt-secret"
#   mistral_api_key = "..."  # optional
#   github_token    = "ghp_..." # optional
#
# Or set environment variables:
#   export TF_VAR_openai_api_key="sk-proj-..."
#   export TF_VAR_admin_password="..."
# =============================================================================
