#!/bin/bash

# Redeploy with authentication fix
PUBLIC_IP="54.176.205.155"
KEY_PAIR_NAME="ventiapi-key"

echo "🔧 Redeploying with authentication fix..."

# Upload the fixed security.py file
echo "📤 Uploading fixed security.py..."
scp -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no ../scanner-service/web-api/security.py ec2-user@$PUBLIC_IP:/opt/ventiapi/scanner-service/web-api/

# Rebuild and restart the web-api service
echo "🔄 Rebuilding and restarting services..."
ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no ec2-user@$PUBLIC_IP << 'EOF'
#!/bin/bash
set -e

cd /opt/ventiapi

echo "🐳 Rebuilding and restarting web-api service..."
sg docker -c "
    cd /opt/ventiapi
    docker-compose build web-api
    docker-compose up -d
"

echo "⏱️ Waiting for services to restart..."
sleep 10

# Check status
echo "📊 Service Status:"
sg docker -c "cd /opt/ventiapi && docker-compose ps"

echo "✅ Redeployment complete!"
echo "🌐 Application should be available at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
echo "🔑 Login with: MICS295 / MaryMcHale"
EOF

echo
echo "✅ Authentication fix deployed!"
echo "🌐 Try logging in at: http://$PUBLIC_IP:3000"
echo "🔑 Credentials: MICS295 / MaryMcHale"