# 08 - Elasticsearch Stack Setup

> **Goal:** Deploy Elasticsearch 8.x and Kibana via Docker with security enabled.

## Stack Overview

| Component | Version | Port | Purpose |
|-----------|---------|------|---------|
| Elasticsearch | 8.x (latest) | 9200 | Search & vector DB |
| Kibana | 8.x (latest) | 5601 | Visualization & UI |

---

## Step 1: Set Elasticsearch Password

Generate and store the elastic superuser password:

```bash
# Generate random password
ES_PASSWORD=$(openssl rand -base64 24)
echo "Elasticsearch password: $ES_PASSWORD"

# Store in file (secure this!)
echo "$ES_PASSWORD" > /opt/ddil/config/.es_password
chmod 600 /opt/ddil/config/.es_password

# Export for docker-compose
export ELASTIC_PASSWORD="$ES_PASSWORD"
```

Record password: `_______________________________`

---

## Step 2: Create Elasticsearch Configuration

```bash
mkdir -p /opt/ddil/config/elasticsearch

cat > /opt/ddil/config/elasticsearch/elasticsearch.yml <<'EOF'
# Cluster
cluster.name: ddil-cluster
node.name: ddil-node-1

# Paths
path.data: /usr/share/elasticsearch/data
path.logs: /usr/share/elasticsearch/logs
path.repo: ["/usr/share/elasticsearch/snapshots"]

# Network
network.host: 0.0.0.0
http.port: 9200

# Discovery (single node)
discovery.type: single-node

# Security
xpack.security.enabled: true
xpack.security.enrollment.enabled: false

xpack.security.http.ssl:
  enabled: false

xpack.security.transport.ssl:
  enabled: false

# Memory
bootstrap.memory_lock: true

# Machine Learning (if using cuVS in future)
xpack.ml.enabled: true
xpack.ml.use_auto_machine_memory_percent: true
EOF
```

---

## Step 3: Create Kibana Configuration

```bash
mkdir -p /opt/ddil/config/kibana

cat > /opt/ddil/config/kibana/kibana.yml <<'EOF'
# Server
server.name: ddil-kibana
server.host: "0.0.0.0"
server.port: 5601

# Elasticsearch
elasticsearch.hosts: ["http://elasticsearch:9200"]
elasticsearch.username: "kibana_system"
elasticsearch.password: "${KIBANA_PASSWORD}"

# Encryption keys (generate unique ones for production)
xpack.security.encryptionKey: "ddil-demo-encryption-key-32char!"
xpack.encryptedSavedObjects.encryptionKey: "ddil-saved-objects-key-32chars!"
xpack.reporting.encryptionKey: "ddil-reporting-key-32-characters"

# Logging
logging.appenders.default:
  type: console
  layout:
    type: pattern

# Telemetry (disable for airgapped)
telemetry.enabled: false
EOF
```

---

## Step 4: Update Docker Compose

Update `/opt/ddil/docker-compose.yml`:

```bash
cat > /opt/ddil/docker-compose.yml <<'EOF'
version: "3.8"

networks:
  ddil-net:
    external: true

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.15.0
    container_name: ddil-elasticsearch
    hostname: elasticsearch
    environment:
      - ELASTIC_PASSWORD=${ELASTIC_PASSWORD}
      - ES_JAVA_OPTS=-Xms24g -Xmx24g
      - "bootstrap.memory_lock=true"
    ulimits:
      memlock:
        soft: -1
        hard: -1
      nofile:
        soft: 65536
        hard: 65536
    volumes:
      - /var/lib/elasticsearch:/usr/share/elasticsearch/data
      - /opt/snapshots:/usr/share/elasticsearch/snapshots
      - /opt/ddil/config/elasticsearch/elasticsearch.yml:/usr/share/elasticsearch/config/elasticsearch.yml:ro
    ports:
      - "9200:9200"
      - "9300:9300"
    networks:
      - ddil-net
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:9200/_cluster/health | grep -q '\"status\":\"green\"\\|\"status\":\"yellow\"'"]
      interval: 30s
      timeout: 10s
      retries: 5
    restart: unless-stopped

  kibana:
    image: docker.elastic.co/kibana/kibana:8.15.0
    container_name: ddil-kibana
    hostname: kibana
    depends_on:
      elasticsearch:
        condition: service_healthy
    environment:
      - KIBANA_PASSWORD=${KIBANA_PASSWORD}
    volumes:
      - /opt/ddil/config/kibana/kibana.yml:/usr/share/kibana/config/kibana.yml:ro
    ports:
      - "5601:5601"
    networks:
      - ddil-net
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:5601/api/status | grep -q 'available'"]
      interval: 30s
      timeout: 10s
      retries: 5
    restart: unless-stopped
EOF
```

---

## Step 5: Set Kibana System Password

Create a script to set up passwords after first boot:

```bash
cat > /opt/ddil/scripts/setup-passwords.sh <<'EOF'
#!/bin/bash
set -e

ES_HOST="http://localhost:9200"
ELASTIC_PASSWORD=$(cat /opt/ddil/config/.es_password)

echo "Waiting for Elasticsearch..."
until curl -s -u "elastic:${ELASTIC_PASSWORD}" "${ES_HOST}/_cluster/health" > /dev/null 2>&1; do
  sleep 5
done

echo "Setting kibana_system password..."
KIBANA_PASSWORD=$(openssl rand -base64 24)

curl -s -X POST -u "elastic:${ELASTIC_PASSWORD}" \
  "${ES_HOST}/_security/user/kibana_system/_password" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"${KIBANA_PASSWORD}\"}"

echo "$KIBANA_PASSWORD" > /opt/ddil/config/.kibana_password
chmod 600 /opt/ddil/config/.kibana_password

echo "Kibana password set and saved to /opt/ddil/config/.kibana_password"
echo ""
echo "Add this to your environment:"
echo "export KIBANA_PASSWORD='${KIBANA_PASSWORD}'"
EOF
chmod +x /opt/ddil/scripts/setup-passwords.sh
```

---

## Step 6: Start Elasticsearch

```bash
cd /opt/ddil

# Load password
export ELASTIC_PASSWORD=$(cat /opt/ddil/config/.es_password)

# Start Elasticsearch only first
docker compose up -d elasticsearch

# Wait and check health
sleep 30
curl -u "elastic:${ELASTIC_PASSWORD}" http://localhost:9200/_cluster/health?pretty
```

Expected output:
```json
{
  "cluster_name" : "ddil-cluster",
  "status" : "green",
  "number_of_nodes" : 1,
  ...
}
```

---

## Step 7: Set Up Kibana Password

```bash
# Run password setup
/opt/ddil/scripts/setup-passwords.sh

# Load Kibana password
export KIBANA_PASSWORD=$(cat /opt/ddil/config/.kibana_password)

# Save to bashrc for persistence
echo "export ELASTIC_PASSWORD='$(cat /opt/ddil/config/.es_password)'" >> ~/.bashrc
echo "export KIBANA_PASSWORD='$(cat /opt/ddil/config/.kibana_password)'" >> ~/.bashrc
```

---

## Step 8: Start Kibana

```bash
cd /opt/ddil
docker compose up -d kibana

# Wait and check
sleep 60
curl -s http://localhost:5601/api/status | jq '.status.overall.level'
# Should return "available"
```

---

## Step 9: Access Kibana

Open browser to: `http://192.168.1.10:5601`

Login:
- Username: `elastic`
- Password: (from /opt/ddil/config/.es_password)

---

## Step 10: Create Snapshot Repository

For backups and demo reset points:

```bash
ELASTIC_PASSWORD=$(cat /opt/ddil/config/.es_password)

curl -X PUT -u "elastic:${ELASTIC_PASSWORD}" \
  "http://localhost:9200/_snapshot/ddil_backup" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "fs",
    "settings": {
      "location": "/usr/share/elasticsearch/snapshots",
      "compress": true
    }
  }'
```

---

## Step 11: Verify Stack Health

```bash
# Cluster health
curl -u "elastic:${ELASTIC_PASSWORD}" http://localhost:9200/_cluster/health?pretty

# Node info
curl -u "elastic:${ELASTIC_PASSWORD}" http://localhost:9200/_nodes?pretty | head -50

# Kibana status
curl -s http://localhost:5601/api/status | jq '.status.overall'
```

### Create Health Check Script

```bash
cat > /opt/ddil/scripts/es-health.sh <<'EOF'
#!/bin/bash
ES_HOST="http://localhost:9200"
ELASTIC_PASSWORD=$(cat /opt/ddil/config/.es_password)

echo "=== Elasticsearch Cluster Health ==="
curl -s -u "elastic:${ELASTIC_PASSWORD}" "${ES_HOST}/_cluster/health?pretty"

echo ""
echo "=== Indices ==="
curl -s -u "elastic:${ELASTIC_PASSWORD}" "${ES_HOST}/_cat/indices?v"

echo ""
echo "=== Nodes ==="
curl -s -u "elastic:${ELASTIC_PASSWORD}" "${ES_HOST}/_cat/nodes?v"

echo ""
echo "=== Kibana Status ==="
curl -s http://localhost:5601/api/status | jq '.status.overall.level'
EOF
chmod +x /opt/ddil/scripts/es-health.sh
```

---

## Elasticsearch Stack Complete

### Verification Checklist

- [ ] Elasticsearch running on port 9200
- [ ] Kibana running on port 5601
- [ ] Cluster health green or yellow
- [ ] Can login to Kibana UI
- [ ] Snapshot repository created
- [ ] Passwords saved securely

### Quick Reference

| Service | URL | Credentials |
|---------|-----|-------------|
| Elasticsearch | http://192.168.1.10:9200 | elastic / (password) |
| Kibana | http://192.168.1.10:5601 | elastic / (password) |

### Useful Commands

```bash
# Start stack
cd /opt/ddil && docker compose up -d

# View logs
docker logs -f ddil-elasticsearch
docker logs -f ddil-kibana

# Health check
/opt/ddil/scripts/es-health.sh

# Restart
docker compose restart elasticsearch kibana
```

---

## Next Step

Proceed to → [09-AI-INFERENCE.md](09-AI-INFERENCE.md)
