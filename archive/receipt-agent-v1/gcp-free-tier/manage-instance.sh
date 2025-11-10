#!/bin/bash

# GCP Free Tier Instance Management Script
# Quick commands to manage your free tier VM instance

set -e

INSTANCE_NAME="free-tier-vm"
ZONE="us-central1-a"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gcloud is available
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: gcloud CLI is not installed${NC}"
    exit 1
fi

# Function to get instance status
get_status() {
    gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" \
        --format="value(status)" 2>/dev/null || echo "NOT_FOUND"
}

# Function to get instance IP
get_ip() {
    gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" \
        --format="value(networkInterfaces[0].accessConfigs[0].natIP)" 2>/dev/null
}

# Show usage
show_usage() {
    echo "Usage: $0 {start|stop|restart|status|ssh|delete|info}"
    echo ""
    echo "Commands:"
    echo "  start    - Start the VM instance"
    echo "  stop     - Stop the VM instance"
    echo "  restart  - Restart the VM instance"
    echo "  status   - Show instance status"
    echo "  ssh      - SSH into the instance"
    echo "  delete   - Delete the instance"
    echo "  info     - Show detailed instance information"
}

# Main command handler
case "${1:-}" in
    start)
        echo -e "${YELLOW}Starting instance...${NC}"
        gcloud compute instances start "$INSTANCE_NAME" --zone="$ZONE"
        echo -e "${GREEN}✅ Instance started${NC}"
        sleep 3
        IP=$(get_ip)
        echo -e "External IP: ${GREEN}$IP${NC}"
        ;;

    stop)
        echo -e "${YELLOW}Stopping instance...${NC}"
        gcloud compute instances stop "$INSTANCE_NAME" --zone="$ZONE"
        echo -e "${GREEN}✅ Instance stopped${NC}"
        echo "💡 This saves network egress while keeping the disk and configuration"
        ;;

    restart)
        echo -e "${YELLOW}Restarting instance...${NC}"
        gcloud compute instances stop "$INSTANCE_NAME" --zone="$ZONE"
        sleep 2
        gcloud compute instances start "$INSTANCE_NAME" --zone="$ZONE"
        echo -e "${GREEN}✅ Instance restarted${NC}"
        ;;

    status)
        STATUS=$(get_status)
        if [ "$STATUS" = "NOT_FOUND" ]; then
            echo -e "${RED}❌ Instance not found${NC}"
            exit 1
        fi

        if [ "$STATUS" = "RUNNING" ]; then
            IP=$(get_ip)
            echo -e "Status: ${GREEN}$STATUS${NC}"
            echo -e "External IP: ${GREEN}$IP${NC}"
        else
            echo -e "Status: ${YELLOW}$STATUS${NC}"
        fi
        ;;

    ssh)
        STATUS=$(get_status)
        if [ "$STATUS" != "RUNNING" ]; then
            echo -e "${RED}❌ Instance is not running (status: $STATUS)${NC}"
            echo "Start it first: $0 start"
            exit 1
        fi
        echo -e "${GREEN}Connecting to instance...${NC}"
        gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE"
        ;;

    delete)
        echo -e "${RED}⚠️  WARNING: This will permanently delete the instance and all data!${NC}"
        echo -n "Type 'DELETE' to confirm: "
        read -r CONFIRM
        if [ "$CONFIRM" = "DELETE" ]; then
            gcloud compute instances delete "$INSTANCE_NAME" --zone="$ZONE"
            echo -e "${GREEN}✅ Instance deleted${NC}"
        else
            echo "Cancelled"
        fi
        ;;

    info)
        STATUS=$(get_status)
        if [ "$STATUS" = "NOT_FOUND" ]; then
            echo -e "${RED}❌ Instance not found${NC}"
            exit 1
        fi

        echo "=================================================="
        echo "Instance Information"
        echo "=================================================="
        gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" \
            --format="table(name, zone, machineType.basename(), networkInterfaces[0].networkIP, networkInterfaces[0].accessConfigs[0].natIP, status)"

        echo ""
        echo "Disk Information:"
        gcloud compute disks describe "$INSTANCE_NAME" --zone="$ZONE" \
            --format="table(name, sizeGb, type.basename(), status)"

        echo ""
        echo "Network Usage (approximate):"
        echo "💡 Check detailed usage in GCP Console > Compute Engine > VM Instances"
        ;;

    *)
        show_usage
        exit 1
        ;;
esac
