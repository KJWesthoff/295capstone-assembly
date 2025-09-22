#!/bin/bash

# Quick script to continue the deployment that failed

PUBLIC_IP="54.176.205.155"
KEY_PAIR_NAME="ventiapi-key"

echo "🚀 Continuing deployment to $PUBLIC_IP..."

# Upload the missing .env.local file
echo "Creating and uploading environment file..."
scp -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no .env.production ec2-user@$PUBLIC_IP:/opt/ventiapi/.env.local

# Deploy the application
echo "Deploying application..."
ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no ec2-user@$PUBLIC_IP << 'EOF'
#!/bin/bash
set -e

echo "Starting application deployment..."

# Change to app directory
cd /opt/ventiapi

# Verify we have the required files
if [ ! -f "docker-compose.yml" ]; then
    echo "ERROR: docker-compose.yml not found!"
    exit 1
fi

echo "Environment file found: $(ls -la .env.local)"

# Make sure Docker is running
sudo systemctl start docker
sudo systemctl enable docker

# Add ec2-user to docker group if not already
sudo usermod -a -G docker ec2-user

# Build and start services (run with current user in docker group)
echo "Building and starting Docker services..."
newgrp docker << 'DOCKEREOF'
cd /opt/ventiapi
docker-compose down || true
docker-compose build
docker-compose up -d
DOCKEREOF

# Wait a moment for services to start
sleep 10

# Show status
echo "Checking service status..."
newgrp docker << 'STATUSEOF'
cd /opt/ventiapi
docker-compose ps
STATUSEOF

echo "Deployment complete!"
echo "Application should be available at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
EOF

echo
echo "🎉 Deployment Complete!"
echo
echo "Application Access:"
echo "  🌐 Application URL: http://$PUBLIC_IP:3000"
echo "  📚 API Documentation: http://$PUBLIC_IP:3000/api/docs"
echo "  🔑 Admin Login: MICS295 / MaryMcHale"
echo