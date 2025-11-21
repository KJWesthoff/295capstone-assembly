# =============================================================================
# Optional RDS PostgreSQL Configuration
# =============================================================================
# By default, the application uses Docker-internal PostgreSQL.
# Set use_rds = true to provision an AWS RDS PostgreSQL instance instead.
# =============================================================================

variable "use_rds" {
  description = "Use AWS RDS instead of Docker PostgreSQL"
  type        = bool
  default     = false
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "rds_multi_az" {
  description = "Enable Multi-AZ deployment for RDS"
  type        = bool
  default     = false
}

# RDS Subnet Group (using default VPC subnets)
resource "aws_db_subnet_group" "ventiapi" {
  count      = var.use_rds ? 1 : 0
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = data.aws_subnets.default.ids

  tags = {
    Name        = "${var.project_name}-db-subnet-group"
    Environment = var.environment
  }
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  count       = var.use_rds ? 1 : 0
  name        = "${var.project_name}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = var.vpc_id != null ? var.vpc_id : data.aws_vpc.default.id

  # PostgreSQL from EC2 instance
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ventiapi.id]
    description     = "PostgreSQL from VentiAPI EC2"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-rds-sg"
    Environment = var.environment
  }
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "ventiapi" {
  count = var.use_rds ? 1 : 0

  identifier = "${var.project_name}-${var.environment}"

  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = var.rds_instance_class
  allocated_storage    = var.rds_allocated_storage
  storage_type         = "gp3"
  storage_encrypted    = true

  db_name  = var.postgres_db
  username = var.postgres_user
  password = var.postgres_password

  db_subnet_group_name   = aws_db_subnet_group.ventiapi[0].name
  vpc_security_group_ids = [aws_security_group.rds[0].id]

  multi_az               = var.rds_multi_az
  publicly_accessible    = false
  skip_final_snapshot    = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${var.project_name}-final-snapshot" : null

  backup_retention_period = var.environment == "prod" ? 7 : 1
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Enable Performance Insights for prod
  performance_insights_enabled = var.environment == "prod"

  tags = {
    Name        = "${var.project_name}-rds-${var.environment}"
    Environment = var.environment
  }

  lifecycle {
    prevent_destroy = false # Set to true for production
  }
}

# Output RDS connection details
output "rds_endpoint" {
  value       = var.use_rds ? aws_db_instance.ventiapi[0].endpoint : null
  description = "RDS PostgreSQL endpoint"
}

output "rds_connection_string" {
  value       = var.use_rds ? "postgresql://${var.postgres_user}:${var.postgres_password}@${aws_db_instance.ventiapi[0].endpoint}/${var.postgres_db}?sslmode=require" : null
  description = "RDS PostgreSQL connection string"
  sensitive   = true
}
