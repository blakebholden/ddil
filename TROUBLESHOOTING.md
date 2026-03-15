# Troubleshooting Guide

## Quick Diagnostics

```bash
# Run full diagnostic
/opt/ddil/scripts/run-all-tests.sh

# Check all services
docker ps
systemctl status ollama
systemctl status ddil-demo
```

---

## Common Issues

### Network Issues

#### No network connectivity

**Symptoms:** Can't ping gateway or other devices

**Check:**
```bash
# Check interface status
ip link show
ip addr show

# Check cable connection
ethtool enp1s0  # Replace with actual interface

# Restart networking
sudo systemctl restart NetworkManager
# or
sudo netplan apply
```

**Fix:**
1. Verify cables are seated properly
2. Check switch port LEDs
3. Verify netplan configuration
4. Reboot if necessary

#### Can't reach DGX Spark

**Symptoms:** `ping 192.168.1.20` fails

**Check:**
```bash
# From Framework
ping 192.168.1.20
ssh nvidia@192.168.1.20

# Check ARP table
arp -a | grep 192.168.1.20
```

**Fix:**
1. Verify DGX is powered on
2. Check cable from Switch P3 to DGX
3. Verify DGX network config
4. Check switch port status in UniFi app

---

### Elasticsearch Issues

#### ES won't start

**Symptoms:** Container exits immediately

**Check:**
```bash
docker logs ddil-elasticsearch
docker inspect ddil-elasticsearch
```

**Common causes:**
1. **Memory lock failed:**
   ```bash
   # Verify memlock ulimit
   ulimit -l
   # Should be unlimited
   ```

2. **vm.max_map_count too low:**
   ```bash
   sysctl vm.max_map_count
   # Should be 262144
   sudo sysctl -w vm.max_map_count=262144
   ```

3. **Disk permissions:**
   ```bash
   ls -la /var/lib/elasticsearch
   sudo chown -R 1000:1000 /var/lib/elasticsearch
   ```

#### ES cluster health RED

**Symptoms:** Cluster shows red status

**Check:**
```bash
curl -u elastic:$ELASTIC_PASSWORD http://localhost:9200/_cluster/health?pretty
curl -u elastic:$ELASTIC_PASSWORD http://localhost:9200/_cat/shards?v
```

**Fix:**
```bash
# Check for unassigned shards
curl -u elastic:$ELASTIC_PASSWORD http://localhost:9200/_cluster/allocation/explain?pretty

# Force allocation if needed
curl -X POST -u elastic:$ELASTIC_PASSWORD \
  "http://localhost:9200/_cluster/reroute?retry_failed=true"
```

#### Kibana can't connect to ES

**Symptoms:** Kibana shows "Unable to connect"

**Check:**
```bash
docker logs ddil-kibana
# Look for authentication errors
```

**Fix:**
1. Verify kibana_system password:
   ```bash
   # Reset password
   curl -X POST -u elastic:$ELASTIC_PASSWORD \
     "http://localhost:9200/_security/user/kibana_system/_password" \
     -H "Content-Type: application/json" \
     -d '{"password":"NEW_PASSWORD"}'
   ```
2. Update KIBANA_PASSWORD environment variable
3. Restart Kibana

---

### Ollama Issues

#### Ollama not responding

**Symptoms:** `curl localhost:11434` fails

**Check:**
```bash
systemctl status ollama
journalctl -u ollama -f
```

**Fix:**
```bash
sudo systemctl restart ollama
```

#### Model not found

**Symptoms:** "model not found" error

**Check:**
```bash
ollama list
```

**Fix:**
```bash
# Re-pull the model
ollama pull llama3.1:70b
```

#### DGX inference slow

**Symptoms:** Tokens/second much lower than expected

**Check:**
```bash
# On DGX
nvidia-smi
# Check GPU utilization, memory, temperature
```

**Causes:**
1. **Thermal throttling:** Check temp > 80°C
2. **Memory pressure:** Too many models loaded
3. **Power throttling:** Check power draw

**Fix:**
```bash
# Unload unused models
curl -X DELETE http://localhost:11434/api/delete -d '{"name":"unused-model"}'

# Restart Ollama
sudo systemctl restart ollama
```

---

### Demo App Issues

#### Streamlit won't start

**Symptoms:** Port 8501 not accessible

**Check:**
```bash
systemctl status ddil-demo
journalctl -u ddil-demo -f
```

**Fix:**
```bash
# Check Python environment
source /opt/ddil/demo-app/venv/bin/activate
pip list

# Reinstall if needed
pip install -r /opt/ddil/demo-app/requirements.txt

# Restart service
sudo systemctl restart ddil-demo
```

#### Chat not generating responses

**Symptoms:** Spinner spins forever

**Check:**
1. Elasticsearch connected? (sidebar indicator)
2. DGX Ollama connected? (sidebar indicator)
3. Browser console for errors

**Fix:**
1. Verify both services responding
2. Check network between Framework and DGX
3. Try simpler query to isolate issue

---

### Docker Issues

#### Containers won't start

**Check:**
```bash
docker compose -f /opt/ddil/docker-compose.yml config
docker compose logs
```

**Fix:**
```bash
# Reset Docker
docker compose down
docker system prune -f
docker compose up -d
```

#### Out of disk space

**Check:**
```bash
df -h
docker system df
```

**Fix:**
```bash
# Clean up Docker
docker system prune -a
docker volume prune

# Check large files
du -sh /var/lib/docker/*
du -sh /var/lib/elasticsearch/*
```

---

### Hardware Issues

#### Framework not booting

**Symptoms:** No display, no POST

**Check:**
1. Power LED on?
2. Fan spinning?
3. RAM/SSD seated properly?

**Fix:**
1. Reseat power connections
2. Clear CMOS (remove battery, wait 30s)
3. Try with minimal config (one SSD, no Wi-Fi)

#### DGX overheating

**Symptoms:** Thermal throttling, shutdowns

**Check:**
```bash
nvidia-smi -q -d TEMPERATURE
```

**Fix:**
1. Ensure 2"+ clearance above DGX
2. Add exhaust fans to rack
3. Reduce ambient temperature
4. Limit concurrent model loading

---

## Recovery Procedures

### Restore from Snapshot

```bash
ELASTIC_PASSWORD=$(cat /opt/ddil/config/.es_password)

# List available snapshots
curl -u elastic:$ELASTIC_PASSWORD \
  http://localhost:9200/_snapshot/ddil_backup/_all?pretty

# Restore
curl -X POST -u elastic:$ELASTIC_PASSWORD \
  "http://localhost:9200/_snapshot/ddil_backup/golden_20240301/_restore" \
  -H "Content-Type: application/json" \
  -d '{"indices": "*", "include_global_state": true}'
```

### Factory Reset

```bash
# Stop everything
cd /opt/ddil && docker compose down

# Remove data
sudo rm -rf /var/lib/elasticsearch/*
sudo rm -rf /var/lib/docker/*

# Re-deploy
docker compose up -d
```

### Emergency Contact

If issues persist:
- Framework support: frame.work/support
- NVIDIA Enterprise: enterprisesupport.nvidia.com
- Elastic support: elastic.co/support
