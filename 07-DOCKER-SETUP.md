# 07 - Docker Setup

> **Goal:** Install Docker Engine and Docker Compose for container workloads.

## Why Docker?

- Consistent deployments across environments
- Easy Elasticsearch/Kibana management
- Portable configurations
- Simple updates and rollbacks

---

## Step 1: Remove Old Docker (if any)

```bash
sudo apt remove docker docker-engine docker.io containerd runc 2>/dev/null || true
```

---

## Step 2: Install Docker Engine

### Add Docker Repository

```bash
# Install prerequisites
sudo apt update
sudo apt install -y ca-certificates curl gnupg

# Add Docker GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### Install Docker

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

---

## Step 3: Post-Installation

### Add User to Docker Group

```bash
sudo usermod -aG docker $USER

# Apply group change (or logout/login)
newgrp docker
```

### Verify Installation

```bash
docker --version
docker compose version
docker run hello-world
```

Expected output:
```
Docker version 26.x.x
Docker Compose version v2.x.x
Hello from Docker! (success message)
```

---

## Step 4: Configure Docker Daemon

Create/edit Docker daemon configuration:

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<EOF
{
  "data-root": "/var/lib/docker",
  "storage-driver": "overlay2",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  },
  "default-ulimits": {
    "memlock": {
      "Hard": -1,
      "Soft": -1
    },
    "nofile": {
      "Hard": 65536,
      "Soft": 65536
    }
  }
}
EOF
```

### Restart Docker

```bash
sudo systemctl restart docker
sudo systemctl enable docker
```

---

## Step 5: Verify Storage Location

```bash
docker info | grep "Docker Root Dir"
# Should show: Docker Root Dir: /var/lib/docker
```

Check storage usage:

```bash
df -h /var/lib/docker
# Should show 300GB volume from LVM
```

---

## Step 6: Create Docker Network

Create dedicated network for DDIL stack:

```bash
docker network create \
  --driver bridge \
  --subnet 172.20.0.0/16 \
  --gateway 172.20.0.1 \
  ddil-net
```

Verify:

```bash
docker network ls
docker network inspect ddil-net
```

---

## Step 7: Create Project Directory

```bash
mkdir -p /opt/ddil
cd /opt/ddil

# Create subdirectories
mkdir -p config
mkdir -p data
mkdir -p logs
mkdir -p scripts
```

---

## Step 8: Create Base Docker Compose File

Create the foundation docker-compose.yml:

```bash
cat > /opt/ddil/docker-compose.yml <<'EOF'
version: "3.8"

# DDIL Demo Kit - Base Docker Compose
# Elasticsearch, Kibana, and supporting services

networks:
  ddil-net:
    external: true

volumes:
  es-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/elasticsearch
  es-snapshots:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/snapshots

services:
  # Elasticsearch will be added in 08-ELASTICSEARCH.md
  # Kibana will be added in 08-ELASTICSEARCH.md
  # Inference services in 09-AI-INFERENCE.md
  # Demo app in 11-DEMO-APP.md
  
  placeholder:
    image: alpine:latest
    command: echo "Docker Compose working"
EOF
```

Test:

```bash
cd /opt/ddil
docker compose up placeholder
# Should see "Docker Compose working"
```

---

## Step 9: Docker Utilities

### Install ctop (Container Top)

```bash
sudo wget https://github.com/bcicen/ctop/releases/download/v0.7.7/ctop-0.7.7-linux-amd64 \
  -O /usr/local/bin/ctop
sudo chmod +x /usr/local/bin/ctop
```

### Create Helper Scripts

```bash
# Restart all services
cat > /opt/ddil/scripts/restart-all.sh <<'EOF'
#!/bin/bash
cd /opt/ddil
docker compose down
docker compose up -d
EOF
chmod +x /opt/ddil/scripts/restart-all.sh

# View logs
cat > /opt/ddil/scripts/logs.sh <<'EOF'
#!/bin/bash
cd /opt/ddil
docker compose logs -f "$@"
EOF
chmod +x /opt/ddil/scripts/logs.sh

# Status check
cat > /opt/ddil/scripts/status.sh <<'EOF'
#!/bin/bash
echo "=== Docker Containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "=== Disk Usage ==="
df -h /var/lib/docker /var/lib/elasticsearch /opt/models
echo ""
echo "=== Memory ==="
free -h
EOF
chmod +x /opt/ddil/scripts/status.sh
```

---

## Step 10: Verify Docker Setup

### Run Verification

```bash
# Docker version
docker --version

# Docker Compose version
docker compose version

# Docker info
docker info

# Network
docker network ls | grep ddil

# Storage
docker system df
```

### Expected Results

```
Docker version: 26.x.x or higher
Compose version: 2.x.x or higher
Network: ddil-net exists
Storage driver: overlay2
Data root: /var/lib/docker
```

---

## Docker Setup Complete

### Verification Checklist

- [ ] Docker Engine installed
- [ ] Docker Compose plugin installed
- [ ] User added to docker group
- [ ] Docker daemon configured
- [ ] ddil-net network created
- [ ] /opt/ddil project directory created
- [ ] Base docker-compose.yml created
- [ ] Helper scripts created

### Quick Commands

```bash
# Start stack
cd /opt/ddil && docker compose up -d

# Stop stack
cd /opt/ddil && docker compose down

# View logs
cd /opt/ddil && docker compose logs -f

# Container status
docker ps

# System resources
ctop
```

---

## Next Step

Proceed to → [08-ELASTICSEARCH.md](08-ELASTICSEARCH.md)
