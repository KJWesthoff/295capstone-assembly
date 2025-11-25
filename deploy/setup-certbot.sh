#!/bin/bash
# =============================================================================
# Let's Encrypt SSL Certificate Setup Script
# =============================================================================
# This script sets up Let's Encrypt SSL certificates using Certbot
# Run this on the EC2 instance after DNS is pointing to the server
# =============================================================================

set -e

DOMAIN="${1:-ventiapi.com}"
EMAIL="${2:-admin@ventiapi.com}"
WEBROOT="/opt/ventiapi/certbot-webroot"

echo "=============================================="
echo "Let's Encrypt SSL Certificate Setup"
echo "=============================================="
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo "=============================================="
echo ""

# Check if domain resolves to this server
echo "Step 1: Checking DNS resolution..."
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)

echo "  Server IP: $PUBLIC_IP"
echo "  Domain IP: $DOMAIN_IP"

if [ "$PUBLIC_IP" != "$DOMAIN_IP" ]; then
    echo ""
    echo "⚠️  WARNING: Domain does not resolve to this server!"
    echo "Please update your DNS A record to point to: $PUBLIC_IP"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install certbot
echo ""
echo "Step 2: Installing Certbot..."
if ! command -v certbot &> /dev/null; then
    sudo yum install -y certbot python3-certbot-nginx
    echo "✓ Certbot installed"
else
    echo "✓ Certbot already installed"
fi

# Create webroot directory for ACME challenge
echo ""
echo "Step 3: Creating webroot directory..."
mkdir -p "$WEBROOT/.well-known/acme-challenge"
chmod -R 755 "$WEBROOT"
echo "✓ Webroot directory created at $WEBROOT"

# Stop nginx container temporarily to free port 80
echo ""
echo "Step 4: Preparing for certificate generation..."
cd /opt/ventiapi
docker-compose stop nginx
echo "✓ Nginx stopped"

# Generate certificate using standalone mode (since nginx is stopped)
echo ""
echo "Step 5: Generating SSL certificate..."
echo "This will validate domain ownership and issue the certificate..."
echo ""

sudo certbot certonly \
    --standalone \
    --preferred-challenges http \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ SSL certificate generated successfully!"
    echo ""
    echo "Certificate location:"
    echo "  Certificate: /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    echo "  Private Key: /etc/letsencrypt/live/$DOMAIN/privkey.pem"
    echo "  Chain: /etc/letsencrypt/live/$DOMAIN/chain.pem"
else
    echo ""
    echo "❌ Certificate generation failed!"
    echo "Common issues:"
    echo "  - Domain not pointing to this server"
    echo "  - Port 80 not accessible from internet"
    echo "  - Firewall blocking connections"
    exit 1
fi

# Set correct permissions for docker access
echo ""
echo "Step 6: Setting permissions..."
sudo chmod -R 755 /etc/letsencrypt/live
sudo chmod -R 755 /etc/letsencrypt/archive
echo "✓ Permissions set"

# Update nginx configuration to use SSL
echo ""
echo "Step 7: Updating nginx configuration..."
cd /opt/ventiapi

# Backup current config
cp nginx.conf nginx.conf.backup

# Update server_name in nginx-ssl.conf
sed -i "s/server_name _;/server_name $DOMAIN www.$DOMAIN;/" nginx-ssl.conf

# Switch to SSL config
cp nginx-ssl.conf nginx.conf
echo "✓ Nginx configured for SSL"

# Restart nginx with SSL
echo ""
echo "Step 8: Starting nginx with SSL..."
docker-compose --env-file .env.remote up -d nginx
echo "✓ Nginx restarted"

# Set up auto-renewal
echo ""
echo "Step 9: Setting up auto-renewal..."

# Create renewal hook script
sudo tee /etc/letsencrypt/renewal-hooks/deploy/restart-nginx.sh > /dev/null <<'EOF'
#!/bin/bash
# Restart nginx after certificate renewal
cd /opt/ventiapi
docker-compose restart nginx
echo "$(date): Nginx restarted after certificate renewal" >> /var/log/certbot-renewal.log
EOF

sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/restart-nginx.sh

# Test renewal (dry run)
echo "Testing auto-renewal..."
sudo certbot renew --dry-run

if [ $? -eq 0 ]; then
    echo "✓ Auto-renewal test successful"
    echo ""
    echo "Certbot will automatically renew certificates via systemd timer"
    echo "Check renewal timer: systemctl list-timers | grep certbot"
else
    echo "⚠️  Auto-renewal test failed"
fi

# Verify HTTPS is working
echo ""
echo "Step 10: Verifying HTTPS..."
sleep 5

if curl -s -k -I https://localhost/ | grep -q "HTTP"; then
    echo "✓ HTTPS is responding"
else
    echo "⚠️  HTTPS may not be configured correctly"
fi

echo ""
echo "=============================================="
echo "✅ Let's Encrypt SSL Setup Complete!"
echo "=============================================="
echo ""
echo "Your site is now available at:"
echo "  https://$DOMAIN"
echo "  https://www.$DOMAIN"
echo ""
echo "Certificate details:"
echo "  Expires: $(sudo certbot certificates | grep 'Expiry Date' | head -1)"
echo "  Auto-renewal: Enabled (systemd timer)"
echo ""
echo "Useful commands:"
echo "  Check certificates: sudo certbot certificates"
echo "  Renew manually: sudo certbot renew"
echo "  Check renewal timer: systemctl list-timers | grep certbot"
echo "  View renewal log: sudo tail -f /var/log/letsencrypt/letsencrypt.log"
echo ""
echo "=============================================="
