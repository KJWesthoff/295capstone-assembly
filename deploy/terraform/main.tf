terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment for remote state (recommended for teams)
  # backend "s3" {
  #   bucket = "ventiapi-terraform-state"
  #   key    = "scanner/terraform.tfstate"
  #   region = "us-west-1"
  # }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Data source for latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Get default VPC if not specified
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Security Group
resource "aws_security_group" "ventiapi" {
  name        = "ventiapi-scanner-sg"
  description = "Security group for VentiAPI Scanner"
  vpc_id      = var.vpc_id != null ? var.vpc_id : data.aws_vpc.default.id

  # SSH (restricted by variable)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_cidrs
    description = "SSH access"
  }

  # HTTPS (for future SSL/TLS support)
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS access"
  }

  # Production Scanner (nginx)
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Production Scanner UI"
  }

  # Cedar Dashboard
  ingress {
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Cedar Security Dashboard"
  }

  # Scanner API
  ingress {
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Scanner API"
  }

  # Mastra Backend
  ingress {
    from_port   = 4111
    to_port     = 4111
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Mastra AI Backend"
  }

  # Outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name = "ventiapi-scanner"
  }
}

# IAM Role for EC2 to access Secrets Manager
resource "aws_iam_role" "scanner" {
  name = "${var.project_name}-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "secrets_access" {
  name = "${var.project_name}-secrets-policy"
  role = aws_iam_role.scanner.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.app_secrets.arn
        ]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "scanner" {
  name = "${var.project_name}-profile-${var.environment}"
  role = aws_iam_role.scanner.name
}

# EC2 Instance
resource "aws_instance" "ventiapi" {
  ami                    = var.ami_id != "" ? var.ami_id : data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  key_name               = var.key_pair_name
  iam_instance_profile   = aws_iam_instance_profile.scanner.name
  vpc_security_group_ids = [aws_security_group.ventiapi.id]
  subnet_id              = var.subnet_id != null ? var.subnet_id : data.aws_subnets.default.ids[0]

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = true
  }

  user_data = templatefile("${path.module}/user-data.sh", {
    environment   = var.environment
    project_name  = var.project_name
    secrets_arn   = aws_secretsmanager_secret.app_secrets.arn
    aws_region    = var.aws_region
    github_repo   = var.github_repo
    github_branch = var.github_branch
  })

  tags = {
    Name = "${var.project_name}-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Elastic IP (optional but recommended)
resource "aws_eip" "ventiapi" {
  instance = aws_instance.ventiapi.id
  domain   = "vpc"

  tags = {
    Name = "ventiapi-scanner"
  }
}

