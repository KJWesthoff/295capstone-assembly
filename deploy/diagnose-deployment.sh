#!/bin/bash

# Quick deployment diagnostic script
# Usage: ./diagnose-deployment.sh [EC2-IP]

EC2_IP=${1:-52.53.43.122}
KEY_PAIR_NAME="ventiapi-key"

echo "🔍 Diagnosing deployment on $EC2_IP"
echo "================================="

echo
echo "📡 Testing basic connectivity..."
if ping -c 1 -W 5 $EC2_IP >/dev/null 2>&1; then
    echo "✅ Instance is reachable"
else
    echo "❌ Instance is not reachable"
    exit 1
fi

echo
echo "🔐 Testing SSH connectivity..."
if ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no -o ConnectTimeout=10 ec2-user@$EC2_IP "echo 'SSH working'" 2>/dev/null; then
    echo "✅ SSH is working"
else
    echo "❌ SSH is not working"
    exit 1
fi

echo
echo "🐳 Checking Docker services on remote instance..."
ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no ec2-user@$EC2_IP << 'EOF'
echo "Docker status:"
sudo systemctl status docker --no-pager -l

echo
echo "Docker Compose version:"
docker-compose --version || echo "docker-compose not found"

echo
echo "Application directory:"
ls -la /opt/ventiapi/ || echo "/opt/ventiapi/ not found"

echo
echo "Environment file:"
ls -la /opt/ventiapi/.env.local || echo ".env.local not found"

echo
echo "Docker containers:"
cd /opt/ventiapi 2>/dev/null && docker-compose ps || echo "Cannot run docker-compose ps"

echo
echo "Docker images:"
docker images | head -10

echo
echo "Running processes on application ports:"
ss -tlnp | grep -E "(3000|3001|4111|8000)" || echo "No services on application ports"

echo
echo "System resources:"
df -h /
free -h

echo
echo "Last 20 lines of system log:"
sudo tail -20 /var/log/messages || sudo tail -20 /var/log/syslog || echo "No system logs found"
EOF

echo
echo "🌐 Testing specific service ports..."
for port in 3000 3001 4111 8000; do
    if curl -I --connect-timeout 5 http://$EC2_IP:$port >/dev/null 2>&1; then
        echo "✅ Port $port is responding"
    else
        echo "❌ Port $port is not responding"
    fi
done