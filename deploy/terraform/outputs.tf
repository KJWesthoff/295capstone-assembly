# =============================================================================
# Terraform Outputs
# =============================================================================

output "instance_id" {
  value       = aws_instance.ventiapi.id
  description = "EC2 instance ID"
}

output "public_ip" {
  value       = aws_eip.ventiapi.public_ip
  description = "Public IP address (Elastic IP)"
}

output "ssh_command" {
  value       = "ssh -i ~/.ssh/${var.key_pair_name}.pem ec2-user@${aws_eip.ventiapi.public_ip}"
  description = "SSH connection command"
}

output "urls" {
  value = {
    production_scanner = "http://${aws_eip.ventiapi.public_ip}:3000"
    cedar_dashboard    = "http://${aws_eip.ventiapi.public_ip}:3001"
    scanner_api        = "http://${aws_eip.ventiapi.public_ip}:8000"
    mastra_backend     = "http://${aws_eip.ventiapi.public_ip}:4111"
  }
  description = "Service URLs"
}

output "security_group_id" {
  value       = aws_security_group.ventiapi.id
  description = "Security group ID"
}

output "secrets_manager_arn" {
  value       = aws_secretsmanager_secret.app_secrets.arn
  description = "ARN of the Secrets Manager secret"
  sensitive   = true
}

output "iam_role_arn" {
  value       = aws_iam_role.scanner.arn
  description = "IAM role ARN for EC2 instance"
}

output "ami_id" {
  value       = aws_instance.ventiapi.ami
  description = "AMI ID used for the instance"
}
