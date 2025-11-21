# Development Environment Configuration
# Usage: terraform apply -var-file="dev.tfvars"

environment    = "dev"
project_name   = "ventiapi-scanner"
aws_region     = "us-west-1"
aws_profile    = "ventiapi"
instance_type  = "t3.small"  # Smaller for dev
key_pair_name  = "ventiapi-key"

# More permissive SSH for development
ssh_allowed_cidrs = ["0.0.0.0/0"]

# Git deployment - can use feature branches
github_repo   = "https://github.com/KJWesthoff/295capstone-assembly.git"
github_branch = "main"

# Database
postgres_user     = "rag_user"
postgres_password = "rag_pass"
postgres_db       = "rag_db"

# =============================================================================
# SENSITIVE VALUES - Same as prod.tfvars, set via environment or .local file
# =============================================================================
