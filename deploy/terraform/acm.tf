# =============================================================================
# SSL/TLS Support with AWS Certificate Manager
# =============================================================================
# Optional configuration for HTTPS support using ACM certificates.
# Set domain_name to enable SSL/TLS configuration.
# =============================================================================

variable "domain_name" {
  description = "Domain name for SSL certificate (leave empty to disable)"
  type        = string
  default     = ""
}

variable "create_route53_records" {
  description = "Create Route53 records for domain validation"
  type        = bool
  default     = false
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID (required if create_route53_records is true)"
  type        = string
  default     = ""
}

# Locals for conditional SSL
locals {
  enable_ssl = var.domain_name != ""
}

# ACM Certificate
resource "aws_acm_certificate" "ventiapi" {
  count             = local.enable_ssl ? 1 : 0
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.domain_name}"
  ]

  tags = {
    Name        = "${var.project_name}-cert"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Route53 DNS validation records (optional)
resource "aws_route53_record" "cert_validation" {
  for_each = local.enable_ssl && var.create_route53_records ? {
    for dvo in aws_acm_certificate.ventiapi[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id
}

# Certificate validation
resource "aws_acm_certificate_validation" "ventiapi" {
  count                   = local.enable_ssl && var.create_route53_records ? 1 : 0
  certificate_arn         = aws_acm_certificate.ventiapi[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# Route53 A records for services (optional)
resource "aws_route53_record" "scanner" {
  count   = local.enable_ssl && var.create_route53_records ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "scanner.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.ventiapi.public_ip]
}

resource "aws_route53_record" "cedar" {
  count   = local.enable_ssl && var.create_route53_records ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "cedar.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.ventiapi.public_ip]
}

resource "aws_route53_record" "api" {
  count   = local.enable_ssl && var.create_route53_records ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "api.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.ventiapi.public_ip]
}

# Output SSL configuration
output "acm_certificate_arn" {
  value       = local.enable_ssl ? aws_acm_certificate.ventiapi[0].arn : null
  description = "ACM certificate ARN"
}

output "ssl_domain_urls" {
  value = local.enable_ssl && var.create_route53_records ? {
    scanner = "https://scanner.${var.domain_name}"
    cedar   = "https://cedar.${var.domain_name}"
    api     = "https://api.${var.domain_name}"
  } : null
  description = "SSL-enabled service URLs"
}
