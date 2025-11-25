# =============================================================================
# Core Configuration
# =============================================================================

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "ventiapi-scanner"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-1"
}

variable "aws_profile" {
  description = "AWS CLI profile"
  type        = string
  default     = "ventiapi"
}

# =============================================================================
# EC2 Configuration
# =============================================================================

variable "ami_id" {
  description = "Amazon Linux 2023 AMI ID (leave empty to auto-detect latest)"
  type        = string
  default     = "" # Will use data source if empty
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "root_volume_size" {
  description = "Root EBS volume size in GB"
  type        = number
  default     = 30
}

variable "key_pair_name" {
  description = "SSH key pair name (without .pem extension)"
  type        = string
  default     = "ventiapi-key"
}

variable "ssh_allowed_cidrs" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Restrict in production!
}

# =============================================================================
# Network Configuration (optional - uses default VPC if not specified)
# =============================================================================

variable "vpc_id" {
  description = "VPC ID (leave empty to use default VPC)"
  type        = string
  default     = null
}

variable "subnet_id" {
  description = "Subnet ID (leave empty to use default)"
  type        = string
  default     = null
}

# =============================================================================
# Application Secrets (stored in AWS Secrets Manager)
# =============================================================================

variable "openai_api_key" {
  description = "OpenAI API key for Cedar/Mastra"
  type        = string
  sensitive   = true
}

variable "openai_model" {
  description = "OpenAI model to use"
  type        = string
  default     = "gpt-4o-mini"
}

variable "admin_username" {
  description = "Admin username for scanner"
  type        = string
  default     = "MICS295"
}

variable "admin_password" {
  description = "Admin password for scanner"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
  default     = "" # Will generate random if empty
}

# =============================================================================
# Database Configuration
# =============================================================================

variable "database_url" {
  description = "PostgreSQL connection URL"
  type        = string
  default     = "postgresql://rag_user:rag_pass@postgres:5432/rag_db?sslmode=require"
}

variable "postgres_user" {
  description = "PostgreSQL username"
  type        = string
  default     = "rag_user"
}

variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
  default     = "rag_pass"
}

variable "postgres_db" {
  description = "PostgreSQL database name"
  type        = string
  default     = "rag_db"
}

# =============================================================================
# Optional API Keys
# =============================================================================

variable "mistral_api_key" {
  description = "Mistral API key (optional)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_token" {
  description = "GitHub token for advisory ingestion (optional)"
  type        = string
  sensitive   = true
  default     = ""
}

# =============================================================================
# Deployment Configuration
# =============================================================================

variable "github_repo" {
  description = "GitHub repository URL for application code"
  type        = string
  default     = "https://github.com/KJWesthoff/295capstone-assembly.git"
}

variable "github_branch" {
  description = "Git branch to deploy"
  type        = string
  default     = "deploy-develop2-aws"
}

# =============================================================================
# Monitoring Configuration
# =============================================================================

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}
