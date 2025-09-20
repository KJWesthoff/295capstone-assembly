# Deployment Options Comparison
## VentiAPI Scanner - Choose the Right Deployment Method

This guide helps you choose the best deployment option for your needs.

## Quick Comparison

| Feature | Kubernetes (k3d) | Kubernetes (EKS) | Docker Compose | AWS Lightsail |
|---------|-------------------|------------------|----------------|---------------|
| **Setup Time** | 2 minutes | 30 minutes | 1 minute | 15 minutes |
| **Monthly Cost** | Free | $150+ | Free | $10-20 |
| **Complexity** | Low | High | Very Low | Low |
| **Auto-scaling** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **High Availability** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Scanner Jobs** | ✅ Dynamic | ✅ Dynamic | 🟡 Simulated | ✅ Full Docker |
| **Production Ready** | 🟡 Local only | ✅ Enterprise | ❌ Development | ✅ Small scale |

## Recommendations by Use Case

### 🎓 **Learning & Development**
**Recommended: Kubernetes (k3d)**
```bash
./kubernetes_deploy.sh
```
- ✅ Learn industry-standard orchestration
- ✅ Identical to production environment
- ✅ Free and runs locally
- ✅ Easy cleanup

### 🚀 **Production (Small Scale)**
**Recommended: AWS Lightsail**
```bash
# See LIGHTSAIL_DEPLOYMENT.md
aws lightsail create-instances --instance-names ventiapi-scanner
```
- ✅ $10-20/month cost
- ✅ Full Docker support
- ✅ Simple management
- ✅ AWS ecosystem integration

### 🏢 **Production (Enterprise Scale)**
**Recommended: Kubernetes (EKS)**
```bash
# See KUBERNETES_DEPLOYMENT.md production section
eksctl create cluster --name ventiapi-prod
```
- ✅ Auto-scaling and high availability
- ✅ Enterprise security and compliance
- ✅ Dynamic scanner job orchestration
- ⚠️ Higher cost and complexity

### 🛠️ **Quick Testing**
**Recommended: Docker Compose**
```bash
./start-dev.sh
```
- ✅ Fastest setup (1 minute)
- ✅ Familiar Docker workflow
- ✅ Good for quick demos
- ⚠️ Limited production capabilities

## Feature Details

### Auto-scaling
- **Kubernetes**: Horizontal Pod Autoscaler scales pods based on CPU/memory
- **Docker Compose**: Manual scaling with `docker compose up --scale`
- **Lightsail**: Manual instance resizing

### Scanner Execution
- **Kubernetes**: Dynamic Jobs for true parallel container execution
- **Docker Compose**: Simulated parallel progress with single container
- **Lightsail**: Full Docker support with container spawning

### High Availability
- **Kubernetes**: Multiple replicas, automatic failover, rolling updates
- **Docker Compose**: Single point of failure
- **Lightsail**: Single instance (can create multiple manually)

### Cost Analysis

#### Local Development (Free)
- **k3d**: Free, runs on your machine
- **Docker Compose**: Free, runs on your machine

#### Small Production ($10-50/month)
- **Lightsail**: $10-20/month for 2-4GB instance
- **DigitalOcean VPS**: $12-24/month for similar specs

#### Enterprise Production ($150+/month)
- **EKS**: ~$150/month (control plane + nodes + load balancers)
- **GKE/AKS**: Similar pricing to EKS

## Migration Path

```
Development → Small Production → Enterprise Production

Docker Compose → AWS Lightsail → Kubernetes (EKS)
     ↓              ↓                ↓
   k3d (local) → Docker on VPS → EKS/GKE/AKS
```

You can start with any option and migrate as your needs grow. The containerized architecture makes migration straightforward.

## Quick Commands

### Start Kubernetes (Local)
```bash
# First time setup
./kubernetes_deploy.sh

# Daily usage
./start-kubernetes.sh        # Start
./start-kubernetes.sh stop   # Stop
./start-kubernetes.sh status # Check status

# Access: http://localhost:3000
```

### Start Docker Compose
```bash
./start-dev.sh
# Access: http://localhost:3000
```

### Deploy to Lightsail
```bash
# Follow LIGHTSAIL_DEPLOYMENT.md
# Access: http://your-instance-ip:3000
```

### Deploy to EKS
```bash
# Follow KUBERNETES_DEPLOYMENT.md production section
# Access: https://your-domain.com
```

## Cleanup Commands

```bash
# Kubernetes (local)
./start-kubernetes.sh stop    # Stop pods (keeps cluster)
./start-kubernetes.sh delete  # Delete entire cluster

# Docker Compose
docker compose down

# Lightsail
aws lightsail delete-instance --instance-name ventiapi-scanner

# EKS
eksctl delete cluster --name ventiapi-prod
```

Choose the option that best fits your current needs - you can always migrate later!