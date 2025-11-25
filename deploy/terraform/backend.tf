# =============================================================================
# Remote State Backend Configuration (Optional)
# =============================================================================
# This file creates the S3 bucket and DynamoDB table for Terraform remote state.
# Remote state is recommended for team collaboration and state locking.
#
# To enable:
# 1. Run `terraform apply` to create the S3 bucket and DynamoDB table
# 2. Uncomment the backend block in main.tf
# 3. Run `terraform init -migrate-state` to migrate local state to S3
# =============================================================================

variable "enable_remote_state_resources" {
  description = "Create S3 bucket and DynamoDB table for remote state"
  type        = bool
  default     = false
}

# S3 Bucket for Terraform state
resource "aws_s3_bucket" "terraform_state" {
  count  = var.enable_remote_state_resources ? 1 : 0
  bucket = "ventiapi-terraform-state-${var.environment}"

  tags = {
    Name        = "ventiapi-terraform-state"
    Environment = var.environment
    Purpose     = "Terraform state storage"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Enable versioning for state history
resource "aws_s3_bucket_versioning" "terraform_state" {
  count  = var.enable_remote_state_resources ? 1 : 0
  bucket = aws_s3_bucket.terraform_state[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  count  = var.enable_remote_state_resources ? 1 : 0
  bucket = aws_s3_bucket.terraform_state[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  count  = var.enable_remote_state_resources ? 1 : 0
  bucket = aws_s3_bucket.terraform_state[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB table for state locking
resource "aws_dynamodb_table" "terraform_locks" {
  count        = var.enable_remote_state_resources ? 1 : 0
  name         = "ventiapi-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name        = "ventiapi-terraform-locks"
    Environment = var.environment
    Purpose     = "Terraform state locking"
  }
}

# Output remote state configuration
output "remote_state_bucket" {
  value       = var.enable_remote_state_resources ? aws_s3_bucket.terraform_state[0].id : null
  description = "S3 bucket for Terraform remote state"
}

output "remote_state_dynamodb_table" {
  value       = var.enable_remote_state_resources ? aws_dynamodb_table.terraform_locks[0].name : null
  description = "DynamoDB table for Terraform state locking"
}
