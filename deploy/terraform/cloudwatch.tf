# =============================================================================
# CloudWatch Monitoring & Logging
# =============================================================================

# CloudWatch Log Group for application logs
resource "aws_cloudwatch_log_group" "ventiapi" {
  name              = "/ventiapi/${var.environment}/application"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-logs-${var.environment}"
    Environment = var.environment
  }
}

# CloudWatch Log Group for user-data bootstrap logs
resource "aws_cloudwatch_log_group" "bootstrap" {
  name              = "/ventiapi/${var.environment}/bootstrap"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-bootstrap-logs-${var.environment}"
    Environment = var.environment
  }
}

# IAM policy for CloudWatch Logs access
resource "aws_iam_role_policy" "cloudwatch_logs" {
  name = "${var.project_name}-cloudwatch-policy"
  role = aws_iam_role.scanner.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = [
          aws_cloudwatch_log_group.ventiapi.arn,
          "${aws_cloudwatch_log_group.ventiapi.arn}:*",
          aws_cloudwatch_log_group.bootstrap.arn,
          "${aws_cloudwatch_log_group.bootstrap.arn}:*"
        ]
      }
    ]
  })
}

# Output log group names
output "cloudwatch_log_groups" {
  value = {
    application = aws_cloudwatch_log_group.ventiapi.name
    bootstrap   = aws_cloudwatch_log_group.bootstrap.name
  }
  description = "CloudWatch log group names"
}
