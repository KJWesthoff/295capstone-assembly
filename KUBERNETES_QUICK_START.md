# Kubernetes Quick Start Guide
## VentiAPI Scanner - Get Running in 2 Minutes

This is a simplified guide to get VentiAPI Scanner running on Kubernetes as quickly as possible.

## Prerequisites (30 seconds)

```bash
# Check if you have the required tools
docker --version    # Docker installed?
kubectl version     # kubectl installed?
k3d version         # k3d installed?

# If missing, install k3d (most common missing piece):
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
```

## First Time Setup (2 minutes)

```bash
# 1. Deploy everything automatically
./kubernetes_deploy.sh

# 2. That's it! Access your app at:
# Frontend: http://localhost:3000
# API: http://localhost:8000
# Username: MICS295
# Password: MaryMcHale
```

## Daily Usage (10 seconds)

```bash
# Start the app
./start-kubernetes.sh

# Stop the app (keeps cluster for next time)
./start-kubernetes.sh stop

# Check if everything is working
./start-kubernetes.sh status

# View logs if something's wrong
./start-kubernetes.sh logs web-api
```

## Common Operations

### Scaling
```bash
# Scale up web API for high load
kubectl scale deployment web-api --replicas=3 -n ventiapi

# Scale back down
kubectl scale deployment web-api --replicas=1 -n ventiapi
```

### Monitoring
```bash
# Watch pod status in real-time
kubectl get pods -n ventiapi -w

# Check resource usage
kubectl top pods -n ventiapi
```

### Troubleshooting
```bash
# Check pod logs
./start-kubernetes.sh logs web-api
./start-kubernetes.sh logs frontend
./start-kubernetes.sh logs redis

# Restart a problematic pod
kubectl rollout restart deployment/web-api -n ventiapi

# Check events for issues
kubectl get events -n ventiapi --sort-by='.lastTimestamp'
```

## Cleanup

```bash
# Stop but keep cluster for next time
./start-kubernetes.sh stop

# Delete everything (will need to redeploy next time)
./start-kubernetes.sh delete
```

## What's Happening Under the Hood?

- **k3d cluster**: Lightweight Kubernetes cluster running locally
- **3 pods**: frontend (nginx+React), web-api (FastAPI), redis (cache)
- **NodePort services**: Maps localhost:3000→frontend, localhost:8000→API
- **Auto-scaling ready**: Can scale pods based on CPU/memory usage
- **Health checks**: Automatic restart if pods fail

## Benefits Over Docker Compose

✅ **Production-like**: Same environment as enterprise Kubernetes  
✅ **Auto-healing**: Pods restart automatically if they crash  
✅ **Easy scaling**: Scale individual services up/down  
✅ **Resource limits**: Prevent services from using too much CPU/memory  
✅ **Rolling updates**: Update services without downtime  
✅ **Job orchestration**: Dynamic scanner container creation  

## Next Steps

Once you're comfortable with local Kubernetes:

1. **Learn kubectl**: `kubectl get all -n ventiapi`
2. **Try scaling**: `kubectl scale deployment web-api --replicas=3 -n ventiapi`
3. **Explore monitoring**: Install k9s for a nice UI
4. **Deploy to cloud**: Use same manifests on AWS EKS/GKE/AKS

The beauty of Kubernetes is that everything you learn locally applies to production clusters!