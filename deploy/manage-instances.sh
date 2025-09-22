#!/bin/bash

# VentiAPI Scanner - Instance Management Script
# Helps manage AWS EC2 instances to avoid cost overruns

set -e

REGION="us-west-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# List all VentiAPI Scanner instances
list_instances() {
    print_header "VentiAPI Scanner Instances"
    
    instances=$(aws ec2 describe-instances \
        --region $REGION \
        --filters "Name=tag:Name,Values=VentiAPI-Scanner" \
        --query 'Reservations[].Instances[].[InstanceId,State.Name,PublicIpAddress,LaunchTime,InstanceType]' \
        --output table)
    
    if [[ "$instances" != *"None"* ]] && [[ -n "$instances" ]]; then
        echo "$instances"
        
        # Calculate costs
        echo
        print_status "Estimated monthly costs (running instances only):"
        
        running_instances=$(aws ec2 describe-instances \
            --region $REGION \
            --filters "Name=tag:Name,Values=VentiAPI-Scanner" "Name=instance-state-name,Values=running" \
            --query 'Reservations[].Instances[].InstanceType' \
            --output text)
        
        total_cost=0
        for instance_type in $running_instances; do
            case $instance_type in
                t3.small)  cost=15; echo "  $instance_type: ~\$15/month" ;;
                t3.medium) cost=30; echo "  $instance_type: ~\$30/month" ;;
                t3.large)  cost=60; echo "  $instance_type: ~\$60/month" ;;
                *)         cost=30; echo "  $instance_type: ~\$30/month (estimated)" ;;
            esac
            total_cost=$((total_cost + cost))
        done
        
        if [ $total_cost -gt 0 ]; then
            echo "  Total estimated: ~\$$total_cost/month"
            
            if [ $total_cost -gt 50 ]; then
                print_warning "High costs detected! Consider terminating unused instances."
            fi
        fi
    else
        print_status "No VentiAPI Scanner instances found"
    fi
}

# Terminate specific instances
terminate_instances() {
    print_header "Terminate Instances"
    
    # List instances first
    instances=$(aws ec2 describe-instances \
        --region $REGION \
        --filters "Name=tag:Name,Values=VentiAPI-Scanner" "Name=instance-state-name,Values=running,stopped,pending" \
        --query 'Reservations[].Instances[].[InstanceId,State.Name,PublicIpAddress,LaunchTime]' \
        --output text)
    
    if [ -z "$instances" ]; then
        print_status "No instances to terminate"
        return
    fi
    
    echo "Available instances:"
    echo "$instances" | nl -w2 -s'. '
    echo
    echo "Options:"
    echo "  a. Terminate ALL instances"
    echo "  #. Terminate specific instance by number"
    echo "  q. Quit"
    echo
    echo -n "Choose option: "
    read -r choice
    
    case $choice in
        a|A)
            print_warning "This will terminate ALL VentiAPI Scanner instances!"
            echo -n "Are you sure? (yes/no): "
            read -r confirm
            if [ "$confirm" = "yes" ]; then
                instance_ids=$(echo "$instances" | awk '{print $1}')
                for instance_id in $instance_ids; do
                    print_status "Terminating $instance_id..."
                    aws ec2 terminate-instances --region $REGION --instance-ids $instance_id
                done
                print_success "All instances terminated"
            else
                print_status "Operation cancelled"
            fi
            ;;
        q|Q)
            print_status "Operation cancelled"
            ;;
        [0-9]*)
            instance_line=$(echo "$instances" | sed -n "${choice}p")
            if [ -n "$instance_line" ]; then
                instance_id=$(echo "$instance_line" | awk '{print $1}')
                print_warning "This will terminate instance $instance_id"
                echo -n "Are you sure? (yes/no): "
                read -r confirm
                if [ "$confirm" = "yes" ]; then
                    print_status "Terminating $instance_id..."
                    aws ec2 terminate-instances --region $REGION --instance-ids $instance_id
                    print_success "Instance $instance_id terminated"
                else
                    print_status "Operation cancelled"
                fi
            else
                print_error "Invalid selection"
            fi
            ;;
        *)
            print_error "Invalid option"
            ;;
    esac
}

# Stop instances (saves money but preserves instance)
stop_instances() {
    print_header "Stop Instances"
    
    running_instances=$(aws ec2 describe-instances \
        --region $REGION \
        --filters "Name=tag:Name,Values=VentiAPI-Scanner" "Name=instance-state-name,Values=running" \
        --query 'Reservations[].Instances[].[InstanceId,PublicIpAddress]' \
        --output text)
    
    if [ -z "$running_instances" ]; then
        print_status "No running instances to stop"
        return
    fi
    
    print_status "Running instances:"
    echo "$running_instances"
    echo
    print_warning "Stopping instances will:"
    echo "  ✅ Stop hourly charges"
    echo "  ✅ Preserve the instance for later restart"
    echo "  ⚠️  Release public IP (use Elastic IP to keep it)"
    echo
    echo -n "Stop all running instances? (yes/no): "
    read -r confirm
    
    if [ "$confirm" = "yes" ]; then
        instance_ids=$(echo "$running_instances" | awk '{print $1}')
        for instance_id in $instance_ids; do
            print_status "Stopping $instance_id..."
            aws ec2 stop-instances --region $REGION --instance-ids $instance_id
        done
        print_success "All instances stopped"
    else
        print_status "Operation cancelled"
    fi
}

# Start stopped instances
start_instances() {
    print_header "Start Instances"
    
    stopped_instances=$(aws ec2 describe-instances \
        --region $REGION \
        --filters "Name=tag:Name,Values=VentiAPI-Scanner" "Name=instance-state-name,Values=stopped" \
        --query 'Reservations[].Instances[].[InstanceId,InstanceType]' \
        --output text)
    
    if [ -z "$stopped_instances" ]; then
        print_status "No stopped instances to start"
        return
    fi
    
    print_status "Stopped instances:"
    echo "$stopped_instances"
    echo
    echo -n "Start all stopped instances? (yes/no): "
    read -r confirm
    
    if [ "$confirm" = "yes" ]; then
        instance_ids=$(echo "$stopped_instances" | awk '{print $1}')
        for instance_id in $instance_ids; do
            print_status "Starting $instance_id..."
            aws ec2 start-instances --region $REGION --instance-ids $instance_id
        done
        print_success "All instances started"
        print_status "Note: Public IPs may have changed. Check with list command."
    else
        print_status "Operation cancelled"
    fi
}

# Show cost breakdown
show_costs() {
    print_header "Cost Analysis"
    
    # Running instances
    running_count=$(aws ec2 describe-instances \
        --region $REGION \
        --filters "Name=tag:Name,Values=VentiAPI-Scanner" "Name=instance-state-name,Values=running" \
        --query 'length(Reservations[].Instances[])' \
        --output text)
    
    # Stopped instances (still incur EBS costs)
    stopped_count=$(aws ec2 describe-instances \
        --region $REGION \
        --filters "Name=tag:Name,Values=VentiAPI-Scanner" "Name=instance-state-name,Values=stopped" \
        --query 'length(Reservations[].Instances[])' \
        --output text)
    
    # Elastic IPs
    eip_count=$(aws ec2 describe-addresses \
        --region $REGION \
        --filters "Name=tag:Name,Values=VentiAPI-EIP" \
        --query 'length(Addresses[])' \
        --output text)
    
    echo "Resource Summary:"
    echo "  Running instances: $running_count (~\$30/month each)"
    echo "  Stopped instances: $stopped_count (~\$3/month each for storage)"
    echo "  Elastic IPs: $eip_count (\$0 if attached, \$5/month if unattached)"
    echo
    
    total_cost=$((running_count * 30 + stopped_count * 3))
    echo "Estimated monthly cost: ~\$$total_cost"
    
    if [ $running_count -gt 1 ]; then
        print_warning "Multiple running instances detected!"
        print_status "Consider keeping only one instance running to save costs"
    fi
    
    if [ $stopped_count -gt 0 ]; then
        print_status "Stopped instances still incur storage costs (~\$3/month each)"
        print_status "Terminate unused instances to eliminate all costs"
    fi
}

# Main menu
show_menu() {
    print_header "VentiAPI Scanner - Instance Management"
    echo
    echo "Options:"
    echo "  1. List all instances"
    echo "  2. Terminate instances"
    echo "  3. Stop instances (save money, keep instance)"
    echo "  4. Start stopped instances"
    echo "  5. Show cost analysis"
    echo "  6. Exit"
    echo
    echo -n "Choose option (1-6): "
    read -r choice
    
    case $choice in
        1) list_instances ;;
        2) terminate_instances ;;
        3) stop_instances ;;
        4) start_instances ;;
        5) show_costs ;;
        6) print_status "Goodbye!"; exit 0 ;;
        *) print_error "Invalid option" ;;
    esac
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "VentiAPI Scanner - Instance Management"
        echo
        echo "Usage: $0 [command]"
        echo
        echo "Commands:"
        echo "  list          List all instances"
        echo "  terminate     Interactive termination"
        echo "  stop          Stop running instances"
        echo "  start         Start stopped instances"
        echo "  costs         Show cost analysis"
        echo "  cleanup       Quick cleanup of all instances"
        echo
        echo "If no command is provided, interactive menu is shown."
        exit 0
        ;;
    list)
        list_instances
        ;;
    terminate)
        terminate_instances
        ;;
    stop)
        stop_instances
        ;;
    start)
        start_instances
        ;;
    costs)
        show_costs
        ;;
    cleanup)
        print_warning "This will terminate ALL VentiAPI Scanner instances!"
        echo -n "Are you sure? (yes/no): "
        read -r confirm
        if [ "$confirm" = "yes" ]; then
            instance_ids=$(aws ec2 describe-instances \
                --region $REGION \
                --filters "Name=tag:Name,Values=VentiAPI-Scanner" "Name=instance-state-name,Values=running,stopped,pending" \
                --query 'Reservations[].Instances[].InstanceId' \
                --output text)
            
            if [ -n "$instance_ids" ]; then
                for instance_id in $instance_ids; do
                    print_status "Terminating $instance_id..."
                    aws ec2 terminate-instances --region $REGION --instance-ids $instance_id
                done
                print_success "All instances terminated"
            else
                print_status "No instances to terminate"
            fi
        else
            print_status "Operation cancelled"
        fi
        ;;
    "")
        while true; do
            show_menu
            echo
            echo -n "Press Enter to continue..."
            read -r
            clear
        done
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac