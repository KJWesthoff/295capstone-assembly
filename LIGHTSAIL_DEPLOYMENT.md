# AWS Lightsail Deployment Guide
## VentiAPI Scanner - Simple Docker Compose Deployment

This guide will help you deploy the VentiAPI Scanner application to AWS Lightsail using your existing `docker-compose.yml` file with full scanner functionality.

## Prerequisites

- AWS account with billing enabled
- AWS CLI installed and configured
- Your local development environment working

## Step 1: Install AWS CLI (if not already installed)

### macOS:
```bash
brew install awscli
```

### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install awscli
```

### Windows:
Download from: https://aws.amazon.com/cli/

## Step 2: Configure AWS CLI

```bash
# Configure your AWS credentials
aws configure

# Enter when prompted:
# AWS Access Key ID: [Your access key]
# AWS Secret Access Key: [Your secret key]  
# Default region name: us-east-1
# Default output format: json

# Verify configuration
aws sts get-caller-identity
```

## Step 3: Create Lightsail Instance

### Option A: Using AWS Console (Recommended for beginners)

1. **Go to AWS Lightsail Console**
   - Navigate to: https://lightsail.aws.amazon.com/
   - Click "Create instance"

2. **Choose Instance Configuration**
   - **Platform**: Linux/Unix
   - **Blueprint**: Ubuntu 20.04 LTS
   - **Instance plan**: $10 USD/month (2 GB RAM, 1 vCPU, 60 GB SSD)
   - **Instance name**: `ventiapi-scanner`

3. **Add Launch Script** (paste this in the "Launch script" section):
```bash
#!/bin/bash
# Update system
apt-get update -y

# Install Docker
apt-get install -y docker.io docker-compose git curl

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Add ubuntu user to docker group
usermod -aG docker ubuntu

# Install Docker Compose v2
curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create application directory
mkdir -p /home/ubuntu/app
chown ubuntu:ubuntu /home/ubuntu/app

# Set proper permissions for shared directories
mkdir -p /shared/results /shared/specs
chown -R 999:999 /shared
chmod -R 755 /shared

echo "Setup complete! Ready for application deployment."
```

4. **Click "Create instance"**

### Option B: Using AWS CLI

```bash
# Create Lightsail instance with setup script
aws lightsail create-instances \
  --instance-names ventiapi-scanner \
  --availability-zone us-east-1a \
  --blueprint-id ubuntu_20_04 \
  --bundle-id medium_2_0 \
  --user-data file://lightsail-setup.sh

# Create the setup script first
cat > lightsail-setup.sh << 'EOF'
#!/bin/bash
apt-get update -y
apt-get install -y docker.io docker-compose git curl
systemctl start docker
systemctl enable docker
usermod -aG docker ubuntu
curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
mkdir -p /home/ubuntu/app
chown ubuntu:ubuntu /home/ubuntu/app
mkdir -p /shared/results /shared/specs
chown -R 999:999 /shared
chmod -R 755 /shared
EOF
```

## Step 4: Wait for Instance to be Ready

```bash
# Check instance status
aws lightsail get-instances --query 'instances[?name==`ventiapi-scanner`].[name,state.name,publicIpAddress]' --output table

# Wait until state shows "running" (usually 2-3 minutes)
```

## Step 5: Get Instance Details

```bash
# Get the public IP address
export INSTANCE_IP=$(aws lightsail get-instance --instance-name ventiapi-scanner --query 'instance.publicIpAddress' --output text)
echo "Instance IP: $INSTANCE_IP"

# Download SSH key (if using CLI method)
aws lightsail download-default-key-pair --output text --query 'privateKeyBase64' | base64 --decode > lightsail-key.pem
chmod 600 lightsail-key.pem
```

## Step 6: Configure Firewall Rules

```bash
# Open port 3000 for the application
aws lightsail put-instance-public-ports \
  --instance-name ventiapi-scanner \
  --port-infos fromPort=3000,toPort=3000,protocol=tcp,cidrs=0.0.0.0/0

# Open SSH port (should already be open)
aws lightsail put-instance-public-ports \
  --instance-name ventiapi-scanner \
  --port-infos fromPort=22,toPort=22,protocol=tcp,cidrs=0.0.0.0/0

# Verify ports are open
aws lightsail get-instance-port-states --instance-name ventiapi-scanner
```

## Step 7: Connect to Instance and Deploy Application

### Connect via SSH:

```bash
# If you used AWS Console method
ssh ubuntu@$INSTANCE_IP

# If you used CLI method with downloaded key
ssh -i lightsail-key.pem ubuntu@$INSTANCE_IP
```

### Deploy the Application:

```bash
# Once connected to the instance, run these commands:

# 1. Clone your repository
cd /home/ubuntu/app
git clone https://github.com/yourusername/ScannerApp.git .

# Alternative: If repo is private, you can upload files
# Use SCP to copy files from local machine:
# scp -r ./ScannerApp ubuntu@$INSTANCE_IP:/home/ubuntu/app/

# 2. Set up environment variables
cp .env.local.example .env.local

# 3. Edit environment file with your credentials
nano .env.local

# Update these values:
# JWT_SECRET=your-secure-jwt-secret-here
# DEFAULT_ADMIN_USERNAME=your-admin-username
# DEFAULT_ADMIN_PASSWORD=your-secure-password
# REDIS_URL=redis://redis:6379

# 4. Make sure you're in the docker group (logout/login if needed)
sudo usermod -aG docker $USER
# If you get permission errors, logout and SSH back in

# 5. Build and start the application
docker-compose build
docker-compose up -d

# 6. Check if services are running
docker-compose ps

# 7. Check logs if needed
docker-compose logs
```

## Step 8: Verify Deployment

### Check Application Status:
```bash
# On the server
curl http://localhost:3000/health

# Check all services are running
docker ps
```

### Access from Your Browser:
```bash
# Your application should be available at:
echo "Application URL: http://$INSTANCE_IP:3000"
```

## Step 9: Test the Scanner

1. **Open your browser** and go to `http://YOUR_INSTANCE_IP:3000`
2. **Login** with the credentials you set in `.env.local`
3. **Test a scan** with a sample API:
   - Server URL: `http://vapi.herokuapp.com`
   - Or upload the VAmPI OpenAPI spec from your local files

## Maintenance Commands

### View Application Logs:
```bash
ssh ubuntu@$INSTANCE_IP
cd /home/ubuntu/app
docker-compose logs -f
```

### Restart Application:
```bash
ssh ubuntu@$INSTANCE_IP
cd /home/ubuntu/app
docker-compose restart
```

### Update Application:
```bash
ssh ubuntu@$INSTANCE_IP
cd /home/ubuntu/app
git pull origin main
docker-compose down
docker-compose build
docker-compose up -d
```

### Monitor Resources:
```bash
# Check disk usage
df -h

# Check memory usage
free -h

# Check Docker container stats
docker stats
```

## Automatic Deployment Script

Create this script on your local machine for easy deployment:

```bash
#!/bin/bash
# deploy-to-lightsail.sh

set -e

INSTANCE_NAME="ventiapi-scanner"
REGION="us-east-1"

echo "🚀 Deploying VentiAPI Scanner to AWS Lightsail..."

# Get instance IP
INSTANCE_IP=$(aws lightsail get-instance --instance-name $INSTANCE_NAME --query 'instance.publicIpAddress' --output text)

if [ "$INSTANCE_IP" == "None" ] || [ "$INSTANCE_IP" == "" ]; then
    echo "❌ Instance not found or not running"
    exit 1
fi

echo "📡 Found instance at: $INSTANCE_IP"

# Upload application files
echo "📁 Uploading application files..."
rsync -avz --exclude 'node_modules' --exclude '.git' \
    ./ ubuntu@$INSTANCE_IP:/home/ubuntu/app/

# Deploy application
echo "🐳 Deploying with Docker Compose..."
ssh ubuntu@$INSTANCE_IP << 'EOF'
cd /home/ubuntu/app
docker-compose down
docker-compose build
docker-compose up -d
echo "✅ Deployment complete!"
EOF

echo "🌐 Application available at: http://$INSTANCE_IP:3000"
echo "📊 Health check: http://$INSTANCE_IP:3000/health"
```

Make it executable:
```bash
chmod +x deploy-to-lightsail.sh
```

## Cost Management

### Monthly Costs:
- **Lightsail Instance**: $10/month (2GB RAM)
- **Data Transfer**: Usually free (1TB included)
- **Storage**: Included in instance price
- **Total**: ~$10/month

### Cost Optimization:
```bash
# Stop instance when not needed (you can restart anytime)
aws lightsail stop-instance --instance-name ventiapi-scanner

# Start instance when needed
aws lightsail start-instance --instance-name ventiapi-scanner

# Delete instance when done (⚠️ This deletes everything)
aws lightsail delete-instance --instance-name ventiapi-scanner
```

## Troubleshooting

### Common Issues:

1. **Can't connect via SSH**
   ```bash
   # Check if instance is running
   aws lightsail get-instance --instance-name ventiapi-scanner --query 'instance.state.name'
   
   # Check firewall rules
   aws lightsail get-instance-port-states --instance-name ventiapi-scanner
   ```

2. **Docker permission denied**
   ```bash
   # Add user to docker group and restart session
   sudo usermod -aG docker ubuntu
   # Logout and SSH back in
   ```

3. **Application not accessible**
   ```bash
   # Check if port 3000 is open
   netstat -tulpn | grep 3000
   
   # Check docker containers
   docker ps
   
   # Check nginx configuration
   docker logs ventiapi-nginx
   ```

4. **Scanner containers fail**
   ```bash
   # Check shared directory permissions
   ls -la /shared/
   
   # Fix permissions if needed
   sudo chown -R 999:999 /shared/
   sudo chmod -R 755 /shared/
   ```

## Security Best Practices

1. **Change default credentials** in `.env.local`
2. **Use strong JWT secret** (generate with `openssl rand -base64 32`)
3. **Restrict SSH access** to your IP only:
   ```bash
   aws lightsail put-instance-public-ports \
     --instance-name ventiapi-scanner \
     --port-infos fromPort=22,toPort=22,protocol=tcp,cidrs=YOUR.IP.ADDRESS/32
   ```
4. **Enable automatic security updates**:
   ```bash
   sudo apt install unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

## Success! 🎉

Your VentiAPI Scanner should now be running on AWS Lightsail with full Docker Compose functionality, including dynamic scanner container creation. The application will be accessible at `http://YOUR_INSTANCE_IP:3000` and ready for demonstration and testing.

For any issues, check the troubleshooting section or examine the Docker logs for more details.