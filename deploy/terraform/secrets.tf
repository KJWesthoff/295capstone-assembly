# AWS Secrets Manager - Centralized secret storage
#
# This file manages all application secrets in AWS Secrets Manager.
# Secrets are pulled by the EC2 instance at boot time via user_data.sh
#
# Benefits:
# - No secrets in .env files or git
# - Audit trail for secret access
# - Easy rotation without redeployment
# - Environment-specific secrets

resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "${var.project_name}/${var.environment}/app-secrets"
  description = "Application secrets for VentiAPI Scanner (${var.environment})"

  tags = {
    Name        = "${var.project_name}-secrets-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    # OpenAI Configuration
    OPENAI_API_KEY = var.openai_api_key
    MODEL          = var.openai_model

    # Authentication
    JWT_SECRET     = var.jwt_secret
    ADMIN_USERNAME = var.admin_username
    ADMIN_PASSWORD = var.admin_password

    # Database
    DATABASE_URL      = var.database_url
    POSTGRES_USER     = var.postgres_user
    POSTGRES_PASSWORD = var.postgres_password
    POSTGRES_DB       = var.postgres_db

    # Optional API Keys
    MISTRAL_API_KEY = var.mistral_api_key
    GITHUB_TOKEN    = var.github_token
  })
}

