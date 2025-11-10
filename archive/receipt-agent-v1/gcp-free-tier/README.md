# GCP Free Tier Compute Engine Setup

Scripts to set up and manage a Google Cloud Platform (GCP) Compute Engine instance within the **Always Free** tier limits.

## 📋 Free Tier Specifications

- **Instance Type**: e2-micro (0.25-2 vCPU, 1 GB RAM)
- **Storage**: 30 GB standard persistent disk
- **Network**: 1 GB/month egress (North America)
- **Regions**: us-west1, us-central1, or us-east1
- **External IP**: Included (free)
- **Cost**: $0/month (if you stay within limits)

## 🚀 Quick Start

### 1. Prerequisites

Install the gcloud CLI:
```bash
# macOS
brew install google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash

# Windows
# Download from: https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate with GCP

```bash
# Login to your Google account
gcloud auth login

# Set your project ID
gcloud config set project YOUR_PROJECT_ID

# List your projects if you don't know the ID
gcloud projects list
```

### 3. Create the Free Tier VM

```bash
cd gcp-free-tier
./setup-gcp-free-tier.sh
```

The script will:
- ✅ Create an e2-micro instance in us-central1-a
- ✅ Set up 30 GB standard persistent disk
- ✅ Configure network with external IP
- ✅ Optionally configure HTTP/HTTPS firewall rules
- ✅ Display connection instructions

## 🛠️ Instance Management

Use the management script for common operations:

```bash
# Start the instance
./manage-instance.sh start

# Stop the instance (saves network egress)
./manage-instance.sh stop

# Check status
./manage-instance.sh status

# SSH into the instance
./manage-instance.sh ssh

# Restart the instance
./manage-instance.sh restart

# Show detailed information
./manage-instance.sh info

# Delete the instance
./manage-instance.sh delete
```

## 🐳 Install Docker (Optional)

To run containerized applications (like n8n):

```bash
# SSH into your instance
./manage-instance.sh ssh

# Download and run the Docker installation script
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/gcp-free-tier/install-docker.sh | bash

# Or if you've copied the script to the instance
./install-docker.sh
```

After installation:
```bash
# Log out and back in, then test
docker run hello-world
```

## 📊 Staying Within Free Tier Limits

### ✅ What's Free
- 1 e2-micro instance running 24/7 in eligible regions
- 30 GB standard persistent disk
- 1 GB network egress per month (North America → most destinations)
- External static IP (if instance is running)

### ⚠️ What Costs Money
- Multiple instances or different machine types
- Storage over 30 GB
- Network egress over 1 GB/month
- GPU/TPU usage
- Premium network tier
- Traffic to China or Australia

### 💡 Tips to Minimize Costs
1. **Stop when not in use**: `./manage-instance.sh stop`
2. **Monitor network usage**: Check GCP Console regularly
3. **Keep one instance**: Delete unused instances
4. **Use standard networking**: Avoid premium tier
5. **Stay in eligible regions**: us-west1/central1/east1

## 🔒 Security Best Practices

1. **SSH Keys**: GCP manages SSH keys automatically via metadata
2. **Firewall**: Only open necessary ports
3. **Updates**: Keep OS and packages updated
   ```bash
   sudo apt-get update && sudo apt-get upgrade -y
   ```
4. **Monitoring**: Enable GCP monitoring for alerts

## 📝 Common Use Cases

### Hosting Receipt Tracker Agent

**Two deployment options available:**

```bash
# Option 1: Standard deployment (uses .env file)
./deploy-with-env.sh

# Option 2: Secure deployment (uses PM2 env vars) ⭐ RECOMMENDED
./deploy-secure.sh
```

📖 **See [DEPLOYMENT_OPTIONS.md](./DEPLOYMENT_OPTIONS.md) for detailed comparison**

**Quick comparison:**
- `deploy-with-env.sh`: Simple, creates .env file on server
- `deploy-secure.sh`: More secure, stores secrets in PM2 memory only

### Hosting a Web Server
```bash
# Install nginx
sudo apt-get update
sudo apt-get install -y nginx

# Ensure HTTP firewall rule is configured
# Access via external IP
```

### Receipt Tracker Agent Deployment
The e2-micro is perfect for:
- Telegram bot applications
- Node.js/TypeScript applications
- AI-powered receipt processing
- Small-scale expense tracking
- Personal finance automation

## 🆘 Troubleshooting

### Application Issues (Supabase Connection, etc.)

If you're experiencing issues with the deployed application (like "TypeError: fetch failed"):

📖 **See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed diagnostics and solutions**

Quick test:
```bash
# SSH into instance
./manage-instance.sh ssh

# Run connection test
cd ~/receipt-tracker
./test-supabase-connection.sh
```

### Instance won't start
```bash
# Check quota limits
gcloud compute project-info describe --project=YOUR_PROJECT_ID

# Check instance status
gcloud compute instances describe free-tier-vm --zone=us-central1-a
```

### Can't SSH
```bash
# Regenerate SSH keys
gcloud compute config-ssh

# Use gcloud SSH (automatic key management)
gcloud compute ssh free-tier-vm --zone=us-central1-a
```

### Exceeded free tier
- Check usage: GCP Console → Billing → Reports
- Stop instance to prevent further egress
- Review firewall rules for unnecessary traffic

## 📚 Additional Resources

- [GCP Free Tier Documentation](https://cloud.google.com/free/docs/free-cloud-features)
- [Compute Engine Pricing](https://cloud.google.com/compute/all-pricing)
- [gcloud CLI Reference](https://cloud.google.com/sdk/gcloud/reference)
- [GCP Billing Dashboard](https://console.cloud.google.com/billing)

## 🗑️ Cleanup

To completely remove everything:
```bash
# Delete the instance
./manage-instance.sh delete

# Delete firewall rules (if created)
gcloud compute firewall-rules delete allow-http-free-tier
gcloud compute firewall-rules delete allow-https-free-tier
```

---

**Note**: Always monitor your GCP billing dashboard to ensure you're staying within free tier limits. Set up billing alerts to get notified if costs occur.
