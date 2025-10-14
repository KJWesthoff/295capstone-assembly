#!/bin/bash

# AWS Inventory Script
# This script provides a comprehensive overview of all AWS resources across regions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored headers
print_header() {
    echo
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
}

print_subheader() {
    echo
    echo -e "${BLUE}--- $1 ---${NC}"
}

print_region() {
    echo -e "${PURPLE}Region: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

# Check if AWS CLI is configured
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured"
        exit 1
    fi
}

# Get AWS account info
get_account_info() {
    print_header "AWS Account Information"
    
    ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
    USER_ARN=$(aws sts get-caller-identity --query 'Arn' --output text)
    USER_ID=$(aws sts get-caller-identity --query 'UserId' --output text)
    
    echo "Account ID: $ACCOUNT_ID"
    echo "User ARN: $USER_ARN"
    echo "User ID: $USER_ID"
}

# Get all available regions
get_regions() {
    aws ec2 describe-regions --query 'Regions[].RegionName' --output text
}

# Check billing information
get_billing_info() {
    print_header "Billing Information"
    
    # Try to get billing info (requires billing permissions)
    if aws ce get-dimension-values --dimension SERVICE --time-period Start=2025-09-01,End=2025-09-30 &>/dev/null; then
        print_success "Getting current month costs..."
        aws ce get-cost-and-usage \
            --time-period Start=2025-09-01,End=2025-09-30 \
            --granularity MONTHLY \
            --metrics BlendedCost \
            --query 'ResultsByTime[0].Total.BlendedCost.Amount' \
            --output text 2>/dev/null | head -1 | xargs -I {} echo "Estimated month-to-date cost: \${}"
    else
        print_warning "No billing permissions or Cost Explorer not enabled"
    fi
}

# Inventory EC2 instances
inventory_ec2() {
    print_subheader "EC2 Instances"
    
    for region in $(get_regions); do
        instances=$(aws ec2 describe-instances --region $region --query 'Reservations[].Instances[].[InstanceId,InstanceType,State.Name,PublicIpAddress,PrivateIpAddress,Tags[?Key==`Name`].Value|[0]]' --output table 2>/dev/null)
        
        if [[ "$instances" != *"None"* ]] && [[ -n "$instances" ]]; then
            print_region $region
            echo "$instances"
        fi
    done
}

# Inventory RDS instances
inventory_rds() {
    print_subheader "RDS Instances"
    
    for region in $(get_regions); do
        rds_instances=$(aws rds describe-db-instances --region $region --query 'DBInstances[].[DBInstanceIdentifier,DBInstanceClass,Engine,DBInstanceStatus,Endpoint.Address]' --output table 2>/dev/null)
        
        if [[ "$rds_instances" != *"None"* ]] && [[ -n "$rds_instances" ]]; then
            print_region $region
            echo "$rds_instances"
        fi
    done
}

# Inventory S3 buckets
inventory_s3() {
    print_subheader "S3 Buckets"
    
    buckets=$(aws s3api list-buckets --query 'Buckets[].[Name,CreationDate]' --output table 2>/dev/null)
    if [[ "$buckets" != *"None"* ]] && [[ -n "$buckets" ]]; then
        echo "$buckets"
        
        echo
        echo "Bucket Details:"
        aws s3api list-buckets --query 'Buckets[].Name' --output text | while read bucket; do
            if [ -n "$bucket" ]; then
                size=$(aws s3 ls s3://$bucket --recursive --summarize 2>/dev/null | grep "Total Size" | awk '{print $3 " " $4}' || echo "Unable to calculate")
                region=$(aws s3api get-bucket-location --bucket $bucket --query 'LocationConstraint' --output text 2>/dev/null || echo "us-east-1")
                if [ "$region" = "None" ]; then region="us-east-1"; fi
                echo "  $bucket (Region: $region, Size: $size)"
            fi
        done
    else
        echo "No S3 buckets found"
    fi
}

# Inventory Lambda functions
inventory_lambda() {
    print_subheader "Lambda Functions"
    
    for region in $(get_regions); do
        functions=$(aws lambda list-functions --region $region --query 'Functions[].[FunctionName,Runtime,LastModified,CodeSize]' --output table 2>/dev/null)
        
        if [[ "$functions" != *"None"* ]] && [[ -n "$functions" ]]; then
            print_region $region
            echo "$functions"
        fi
    done
}

# Inventory VPCs
inventory_vpc() {
    print_subheader "VPCs"
    
    for region in $(get_regions); do
        vpcs=$(aws ec2 describe-vpcs --region $region --query 'Vpcs[].[VpcId,CidrBlock,State,IsDefault,Tags[?Key==`Name`].Value|[0]]' --output table 2>/dev/null)
        
        if [[ "$vpcs" != *"None"* ]] && [[ -n "$vpcs" ]]; then
            print_region $region
            echo "$vpcs"
        fi
    done
}

# Inventory Security Groups
inventory_security_groups() {
    print_subheader "Security Groups"
    
    for region in $(get_regions); do
        sgs=$(aws ec2 describe-security-groups --region $region --query 'SecurityGroups[].[GroupId,GroupName,Description,VpcId]' --output table 2>/dev/null)
        
        if [[ "$sgs" != *"None"* ]] && [[ -n "$sgs" ]]; then
            print_region $region
            echo "$sgs" | head -20  # Limit output as there can be many
            sg_count=$(aws ec2 describe-security-groups --region $region --query 'length(SecurityGroups[])' --output text 2>/dev/null)
            if [ "$sg_count" -gt 15 ]; then
                echo "... and $(($sg_count - 15)) more security groups"
            fi
        fi
    done
}

# Inventory Elastic IPs
inventory_eips() {
    print_subheader "Elastic IPs"
    
    for region in $(get_regions); do
        eips=$(aws ec2 describe-addresses --region $region --query 'Addresses[].[PublicIp,InstanceId,AllocationId,AssociationId]' --output table 2>/dev/null)
        
        if [[ "$eips" != *"None"* ]] && [[ -n "$eips" ]]; then
            print_region $region
            echo "$eips"
        fi
    done
}

# Inventory EBS Volumes
inventory_ebs() {
    print_subheader "EBS Volumes"
    
    for region in $(get_regions); do
        volumes=$(aws ec2 describe-volumes --region $region --query 'Volumes[].[VolumeId,VolumeType,Size,State,Attachments[0].InstanceId]' --output table 2>/dev/null)
        
        if [[ "$volumes" != *"None"* ]] && [[ -n "$volumes" ]]; then
            print_region $region
            echo "$volumes"
        fi
    done
}

# Inventory IAM Users and Roles
inventory_iam() {
    print_subheader "IAM Users"
    
    users=$(aws iam list-users --query 'Users[].[UserName,CreateDate,PasswordLastUsed]' --output table 2>/dev/null)
    if [[ "$users" != *"None"* ]] && [[ -n "$users" ]]; then
        echo "$users"
    else
        echo "No IAM users found"
    fi
    
    print_subheader "IAM Roles (Top 10)"
    
    roles=$(aws iam list-roles --query 'Roles[].[RoleName,CreateDate]' --output table 2>/dev/null | head -15)
    if [[ "$roles" != *"None"* ]] && [[ -n "$roles" ]]; then
        echo "$roles"
        role_count=$(aws iam list-roles --query 'length(Roles[])' --output text 2>/dev/null)
        if [ "$role_count" -gt 10 ]; then
            echo "... and $(($role_count - 10)) more roles"
        fi
    else
        echo "No IAM roles found"
    fi
}

# Inventory CloudFormation Stacks
inventory_cloudformation() {
    print_subheader "CloudFormation Stacks"
    
    for region in $(get_regions); do
        stacks=$(aws cloudformation describe-stacks --region $region --query 'Stacks[].[StackName,StackStatus,CreationTime]' --output table 2>/dev/null)
        
        if [[ "$stacks" != *"None"* ]] && [[ -n "$stacks" ]]; then
            print_region $region
            echo "$stacks"
        fi
    done
}

# Inventory Load Balancers
inventory_load_balancers() {
    print_subheader "Load Balancers"
    
    for region in $(get_regions); do
        # Application/Network Load Balancers (ALB/NLB)
        albs=$(aws elbv2 describe-load-balancers --region $region --query 'LoadBalancers[].[LoadBalancerName,Type,State.Code,DNSName]' --output table 2>/dev/null)
        
        if [[ "$albs" != *"None"* ]] && [[ -n "$albs" ]]; then
            print_region $region
            echo "Application/Network Load Balancers:"
            echo "$albs"
        fi
        
        # Classic Load Balancers (ELB)
        elbs=$(aws elb describe-load-balancers --region $region --query 'LoadBalancerDescriptions[].[LoadBalancerName,DNSName,CreatedTime]' --output table 2>/dev/null)
        
        if [[ "$elbs" != *"None"* ]] && [[ -n "$elbs" ]]; then
            if [[ "$albs" == *"None"* ]] || [[ -z "$albs" ]]; then
                print_region $region
            fi
            echo "Classic Load Balancers:"
            echo "$elbs"
        fi
    done
}

# Inventory Route53 Hosted Zones
inventory_route53() {
    print_subheader "Route53 Hosted Zones"
    
    zones=$(aws route53 list-hosted-zones --query 'HostedZones[].[Name,Id,ResourceRecordSetCount]' --output table 2>/dev/null)
    if [[ "$zones" != *"None"* ]] && [[ -n "$zones" ]]; then
        echo "$zones"
    else
        echo "No Route53 hosted zones found"
    fi
}

# Summary of costs by service
cost_summary() {
    print_header "Resource Summary"
    
    echo "Counting resources across all regions..."
    
    # Count EC2 instances
    ec2_count=0
    for region in $(get_regions); do
        count=$(aws ec2 describe-instances --region $region --query 'length(Reservations[].Instances[])' --output text 2>/dev/null || echo 0)
        ec2_count=$((ec2_count + count))
    done
    
    # Count RDS instances
    rds_count=0
    for region in $(get_regions); do
        count=$(aws rds describe-db-instances --region $region --query 'length(DBInstances[])' --output text 2>/dev/null || echo 0)
        rds_count=$((rds_count + count))
    done
    
    # Count S3 buckets
    s3_count=$(aws s3api list-buckets --query 'length(Buckets[])' --output text 2>/dev/null || echo 0)
    
    # Count Lambda functions
    lambda_count=0
    for region in $(get_regions); do
        count=$(aws lambda list-functions --region $region --query 'length(Functions[])' --output text 2>/dev/null || echo 0)
        lambda_count=$((lambda_count + count))
    done
    
    # Count VPCs
    vpc_count=0
    for region in $(get_regions); do
        count=$(aws ec2 describe-vpcs --region $region --query 'length(Vpcs[])' --output text 2>/dev/null || echo 0)
        vpc_count=$((vpc_count + count))
    done
    
    # Count CloudFormation stacks
    cf_count=0
    for region in $(get_regions); do
        count=$(aws cloudformation describe-stacks --region $region --query 'length(Stacks[])' --output text 2>/dev/null || echo 0)
        cf_count=$((cf_count + count))
    done
    
    echo
    echo "Resource Counts:"
    echo "  EC2 Instances: $ec2_count"
    echo "  RDS Instances: $rds_count"
    echo "  S3 Buckets: $s3_count"
    echo "  Lambda Functions: $lambda_count"
    echo "  VPCs: $vpc_count"
    echo "  CloudFormation Stacks: $cf_count"
}

# Main execution
main() {
    echo -e "${GREEN}🔍 AWS Resource Inventory${NC}"
    echo "Starting comprehensive AWS inventory scan..."
    echo
    
    check_aws_cli
    get_account_info
    get_billing_info
    
    print_header "Compute Resources"
    inventory_ec2
    inventory_lambda
    
    print_header "Storage Resources"
    inventory_s3
    inventory_ebs
    
    print_header "Database Resources"
    inventory_rds
    
    print_header "Network Resources"
    inventory_vpc
    inventory_security_groups
    inventory_eips
    inventory_load_balancers
    inventory_route53
    
    print_header "Security & Access"
    inventory_iam
    
    print_header "Infrastructure as Code"
    inventory_cloudformation
    
    cost_summary
    
    echo
    print_success "Inventory scan complete!"
    echo
    echo "💡 Tips:"
    echo "  - Review unused resources to reduce costs"
    echo "  - Check security groups for overly permissive rules"
    echo "  - Consider terminating stopped EC2 instances"
    echo "  - Review EBS volumes not attached to instances"
    echo "  - Clean up old CloudFormation stacks"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "AWS Inventory Script"
        echo
        echo "Usage: $0 [options]"
        echo
        echo "Options:"
        echo "  --help, -h       Show this help message"
        echo "  --quick          Quick scan (EC2, S3, RDS only)"
        echo "  --ec2            EC2 instances only"
        echo "  --s3             S3 buckets only"
        echo "  --costs          Show cost summary only"
        echo
        exit 0
        ;;
    --quick)
        check_aws_cli
        get_account_info
        inventory_ec2
        inventory_s3
        inventory_rds
        cost_summary
        ;;
    --ec2)
        check_aws_cli
        inventory_ec2
        ;;
    --s3)
        check_aws_cli
        inventory_s3
        ;;
    --costs)
        check_aws_cli
        get_billing_info
        cost_summary
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac