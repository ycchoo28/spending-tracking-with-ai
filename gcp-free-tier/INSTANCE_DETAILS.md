# GCP Free Tier Instance Details

**Created:** [TO BE UPDATED AFTER DEPLOYMENT]

## Account & Project Information

- **GCP Account:** [YOUR_ACCOUNT_EMAIL]
- **Project ID:** [YOUR_PROJECT_ID]
- **Project Number:** [YOUR_PROJECT_NUMBER]

## Instance Configuration

| Property | Value |
|----------|-------|
| **Instance Name** | free-tier-vm |
| **Status** | RUNNING |
| **Zone** | us-central1-a |
| **Region** | us-central1 (Iowa) |
| **Machine Type** | e2-micro (Free Tier) |
| **CPU** | 0.25-2 vCPU (burstable) |
| **Memory** | 1 GB RAM |
| **Boot Disk Size** | 30 GB |
| **Disk Type** | pd-standard (Standard persistent disk) |
| **Operating System** | Debian 12 |
| **External IP** | [TO BE UPDATED] |
| **Internal IP** | [TO BE UPDATED] |

## Network Configuration

- **Network Tier:** Standard
- **VPC Network:** default
- **Subnet:** default (us-central1)
- **Firewall:** Default rules applied

## Connection Instructions

### SSH via gcloud CLI (Recommended)

```bash
# Connect to the instance
gcloud compute ssh free-tier-vm --zone=us-central1-a --project=[YOUR_PROJECT_ID]

# Or using the management script
cd gcp-free-tier
./manage-instance.sh ssh
```

### SSH via External IP

```bash
# Generate SSH keys if not already done
gcloud compute config-ssh

# Connect using the external IP
ssh [YOUR_USERNAME]@[EXTERNAL_IP]
```

### GCP Console

View instance in browser:
```
https://console.cloud.google.com/compute/instancesDetail/zones/us-central1-a/instances/free-tier-vm?project=[YOUR_PROJECT_ID]
```

## Management Commands

Using the `manage-instance.sh` script:

```bash
# Check instance status
./manage-instance.sh status

# Start the instance (if stopped)
./manage-instance.sh start

# Stop the instance (to save network egress)
./manage-instance.sh stop

# Restart the instance
./manage-instance.sh restart

# Show detailed information
./manage-instance.sh info

# Delete the instance (permanent)
./manage-instance.sh delete
```

## Firewall Configuration

To allow HTTP/HTTPS traffic:

```bash
# Allow HTTP (port 80)
gcloud compute firewall-rules create allow-http-free-tier \
  --allow=tcp:80 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=http-server \
  --description="Allow HTTP traffic"

# Allow HTTPS (port 443)
gcloud compute firewall-rules create allow-https-free-tier \
  --allow=tcp:443 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=https-server \
  --description="Allow HTTPS traffic"

# Apply tags to the instance
gcloud compute instances add-tags free-tier-vm \
  --zone=us-central1-a \
  --tags=http-server,https-server
```

## Free Tier Compliance

✅ This instance is configured to stay within GCP's Always Free tier:

- ✅ **Machine Type:** e2-micro (eligible for free tier)
- ✅ **Region:** us-central1 (eligible region)
- ✅ **Boot Disk:** 30 GB standard persistent disk (within limit)
- ✅ **Network Tier:** Standard (free tier compatible)
- ⚠️ **Network Egress:** Monitor usage - limit is 1 GB/month to North America

**Monthly Costs:** $0 (if staying within limits)

## Usage Monitoring

Monitor your usage to ensure you stay within free tier limits:

```bash
# View instance details
gcloud compute instances describe free-tier-vm --zone=us-central1-a

# Check disk usage
gcloud compute disks describe free-tier-vm --zone=us-central1-a

# View in billing dashboard
open "https://console.cloud.google.com/billing?project=[YOUR_PROJECT_ID]"
```

**Set up billing alerts:**
1. Go to: https://console.cloud.google.com/billing/budgets
2. Create a budget alert for $0.01 to get notified immediately if any charges occur

## Next Steps

### 1. Install Docker (Optional)

```bash
# SSH into the instance
gcloud compute ssh free-tier-vm --zone=us-central1-a

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in for changes to take effect
exit
gcloud compute ssh free-tier-vm --zone=us-central1-a

# Test Docker
docker run hello-world
```

Or use the provided installation script:
```bash
# Copy the script to the instance
gcloud compute scp install-docker.sh free-tier-vm:~ --zone=us-central1-a

# SSH and run it
gcloud compute ssh free-tier-vm --zone=us-central1-a
chmod +x install-docker.sh
./install-docker.sh
```

### 2. Deploy n8n (Optional)

After installing Docker:

```bash
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# Access receipt tracker at: http://[EXTERNAL_IP]:3000
# (Remember to open port 3000 in firewall if needed)
```

### 3. Set Up Automatic Backups

Consider setting up snapshots for your instance:

```bash
# Create a snapshot
gcloud compute disks snapshot free-tier-vm \
  --zone=us-central1-a \
  --snapshot-names=free-tier-vm-snapshot-$(date +%Y%m%d)
```

## Important Notes

⚠️ **Free Tier Limitations:**
- Only 1 e2-micro instance per month is free
- Must be in us-west1, us-central1, or us-east1
- Network egress limit: 1 GB/month (North America)
- External IP is free only when instance is running

💡 **Cost Saving Tips:**
- Stop the instance when not in use: `./manage-instance.sh stop`
- Monitor network usage in GCP Console
- Set up billing alerts
- Delete unused resources

🔒 **Security Recommendations:**
- Keep the OS updated: `sudo apt update && sudo apt upgrade -y`
- Only open necessary firewall ports
- Use strong SSH keys
- Enable OS Login for better security
- Review security best practices: https://cloud.google.com/compute/docs/instances/security-best-practices

## Support & Resources

- **GCP Console:** https://console.cloud.google.com
- **Free Tier Docs:** https://cloud.google.com/free/docs/free-cloud-features
- **Compute Engine Docs:** https://cloud.google.com/compute/docs
- **Billing Dashboard:** https://console.cloud.google.com/billing?project=[YOUR_PROJECT_ID]

---

**Last Updated:** October 2, 2025
