# Let's Encrypt SSL Setup Guide

This guide walks you through setting up free SSL certificates with Let's Encrypt for ventiapi.com.

## Prerequisites

1. **DNS must be configured** - Your domain must point to your EC2 instance
2. **Port 80 and 443 must be open** - Security group already configured ✓
3. **Instance must be running** - EC2 instance deployed ✓

## Step 1: Configure DNS

Before running the SSL setup, configure your DNS A record:

```
Type: A
Name: ventiapi.com (or @)
Value: 54.151.110.243
TTL: 300 (5 minutes)

Type: A
Name: www
Value: 54.151.110.243
TTL: 300 (5 minutes)
```

**Verify DNS propagation:**
```bash
dig +short ventiapi.com
# Should return: 54.151.110.243

dig +short www.ventiapi.com
# Should return: 54.151.110.243
```

Wait for DNS to propagate (usually 5-15 minutes).

## Step 2: Run the SSL Setup Script

SSH into your EC2 instance and run the setup script:

```bash
# SSH into EC2
ssh -i ~/.ssh/ventiapi-key.pem ec2-user@54.151.110.243

# Navigate to project directory
cd /opt/ventiapi

# Make setup script executable
chmod +x deploy/setup-certbot.sh

# Run the setup script
sudo ./deploy/setup-certbot.sh ventiapi.com admin@ventiapi.com
```

The script will:
1. ✓ Check DNS resolution
2. ✓ Install Certbot
3. ✓ Generate SSL certificate from Let's Encrypt
4. ✓ Configure nginx for HTTPS
5. ✓ Set up auto-renewal
6. ✓ Test HTTPS connection

## Step 3: Verify HTTPS is Working

After the script completes, test your site:

```bash
# Test from EC2
curl -I https://ventiapi.com/

# Test from your local machine
curl -I https://ventiapi.com/
```

Visit in your browser:
- https://ventiapi.com
- https://www.ventiapi.com

You should see:
- ✓ Padlock icon in browser
- ✓ Valid certificate from Let's Encrypt
- ✓ HTTP automatically redirects to HTTPS

## Auto-Renewal

Certbot automatically sets up renewal via systemd timer. Certificates renew every 60 days (they expire in 90 days).

**Check renewal timer:**
```bash
systemctl list-timers | grep certbot
```

**Test renewal (dry run):**
```bash
sudo certbot renew --dry-run
```

**Manual renewal:**
```bash
sudo certbot renew
```

**Check certificate status:**
```bash
sudo certbot certificates
```

## Troubleshooting

### DNS not resolving to server

**Error:** `Domain does not resolve to this server`

**Solution:**
- Verify DNS A record points to: 54.151.110.243
- Wait for DNS propagation (use `dig +short ventiapi.com`)
- Check with multiple DNS servers: `nslookup ventiapi.com 8.8.8.8`

### Port 80 not accessible

**Error:** `Failed authorization procedure... Connection refused`

**Solution:**
- Check security group allows port 80: `AWS_PROFILE=ventiapi aws ec2 describe-security-groups --group-ids sg-0962d3cda5f8bf563`
- Check nginx is stopped: `docker ps | grep nginx`
- Check firewall: `sudo iptables -L -n | grep 80`

### Certificate generation failed

**Error:** `Certbot failed to authenticate`

**Solution:**
1. Verify domain resolves: `dig +short ventiapi.com`
2. Check port 80 is accessible: `curl -I http://ventiapi.com/health`
3. Try running certbot with verbose: `sudo certbot certonly --standalone -d ventiapi.com -v`

### Nginx won't start with SSL

**Error:** `nginx: [emerg] cannot load certificate`

**Solution:**
- Check certificate files exist: `sudo ls -la /etc/letsencrypt/live/ventiapi.com/`
- Check permissions: `sudo chmod -R 755 /etc/letsencrypt/live/`
- Check nginx logs: `docker logs ventiapi-nginx`

### Browser shows "Not Secure"

**Issue:** Certificate not trusted or mixed content

**Solution:**
- Clear browser cache
- Check certificate: `openssl s_client -connect ventiapi.com:443`
- Verify all resources load via HTTPS (check browser console)

## Certificate Details

**Issuer:** Let's Encrypt
**Validity:** 90 days
**Auto-Renewal:** Every 60 days
**Cost:** FREE

**Certificate Files:**
- Certificate: `/etc/letsencrypt/live/ventiapi.com/fullchain.pem`
- Private Key: `/etc/letsencrypt/live/ventiapi.com/privkey.pem`
- Chain: `/etc/letsencrypt/live/ventiapi.com/chain.pem`

## Switching Back to HTTP (for testing)

If you need to temporarily disable HTTPS:

```bash
cd /opt/ventiapi

# Restore HTTP-only config
git checkout nginx.conf

# Restart nginx
docker-compose restart nginx
```

## Re-enabling HTTPS

```bash
cd /opt/ventiapi

# Copy SSL config
cp nginx-ssl.conf nginx.conf

# Update domain name
sed -i "s/server_name _;/server_name ventiapi.com www.ventiapi.com;/" nginx.conf

# Restart nginx
docker-compose restart nginx
```

## Security Best Practices

The SSL configuration includes:
- ✓ TLS 1.2 and TLS 1.3 only (no older protocols)
- ✓ Strong cipher suites
- ✓ HSTS (HTTP Strict Transport Security)
- ✓ OCSP stapling
- ✓ Security headers (X-Frame-Options, X-Content-Type-Options, etc.)

Test your SSL configuration:
- https://www.ssllabs.com/ssltest/analyze.html?d=ventiapi.com

## Monitoring

**Check renewal logs:**
```bash
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

**Check nginx logs:**
```bash
docker logs -f ventiapi-nginx
```

**Check certificate expiration:**
```bash
sudo certbot certificates
```

Set up monitoring to alert 14 days before expiration (though auto-renewal should handle it).

## Need Help?

- Let's Encrypt documentation: https://letsencrypt.org/docs/
- Certbot documentation: https://eff-certbot.readthedocs.io/
- Check `/var/log/letsencrypt/` for detailed logs
