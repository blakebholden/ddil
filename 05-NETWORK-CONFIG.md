# 05 - Network Configuration

> **Goal:** Configure UniFi Express 7, Switch Flex Mini, and establish internal network.

## Network Topology

```
                    ┌─────────────────┐
                    │   Demo Laptop   │
                    │ (Wi-Fi/Wired)   │
                    └────────┬────────┘
                             │
              Wi-Fi 7 ───────┼─────── or Wired (P4)
                             │
┌────────────────────────────┴────────────────────────────────┐
│                    UniFi Express 7                          │
│                    192.168.1.1 (Gateway)                    │
│              [WAN - unused]  [LAN 2.5GbE]                   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ Cat6a
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Switch Flex Mini                         │
│    [P1 Uplink]  [P2 FW]  [P3 DGX]  [P4 Client]  [P5 Spare]  │
└─────────┬───────────┬────────┬──────────────────────────────┘
          │           │        │
          │           │        └──────────────────┐
          │           │                           │
          ▼           ▼                           ▼
    ┌──────────┐  ┌──────────────────┐  ┌─────────────────┐
    │  (uplink)│  │ Framework Desktop│  │   DGX Spark     │
    │          │  │   192.168.1.10   │  │   192.168.1.20  │
    └──────────┘  └──────────────────┘  └─────────────────┘
```

---

## IP Address Plan

| Device | IP Address | MAC | Notes |
|--------|------------|-----|-------|
| UniFi Express 7 | 192.168.1.1 | Auto | Gateway, DHCP, DNS |
| Switch Flex Mini | 192.168.1.2 | Auto | Managed switch (optional static) |
| Framework Desktop | 192.168.1.10 | Record | Static |
| DGX Spark | 192.168.1.20 | Record | Static |
| DHCP Range | 192.168.1.100-199 | — | Demo laptops |

---

## Step 1: UniFi Express 7 Initial Setup

### Power On

1. [ ] Connect USB-C power adapter to UX7
2. [ ] Wait for status ring to pulse blue (~2 min)
3. [ ] Status ring meanings:
   - Pulsing blue: Ready for setup
   - Solid blue: Connected to cloud
   - White: Standalone mode

### Setup via UniFi App

1. [ ] Download UniFi app on smartphone (iOS/Android)
2. [ ] Create Ubiquiti account (or use existing)
3. [ ] Open app, tap "+" to add device
4. [ ] Follow on-screen setup wizard

### Standalone Mode (No Internet Required)

For airgapped operation, UX7 can run standalone:

1. [ ] During setup, choose "Standalone" mode
2. [ ] Access web UI at https://192.168.1.1
3. [ ] Complete setup via browser

---

## Step 2: Configure UniFi Express 7

### Basic Settings

Access UniFi web UI: `https://192.168.1.1`

1. [ ] **Network Name:** Set to `192.168.1.0/24`
2. [ ] **DHCP Server:** Enable
   - Range: 192.168.1.100 - 192.168.1.199
   - Lease time: 24 hours
3. [ ] **DNS:** Use router as DNS (192.168.1.1)
4. [ ] **Gateway IP:** 192.168.1.1 (default)

### Wi-Fi Configuration

1. [ ] **SSID:** `DDIL-Demo`
2. [ ] **Security:** WPA3 Personal (or WPA2 for compatibility)
3. [ ] **Password:** Set strong password, record below
4. [ ] **Band:** Enable 6GHz (Wi-Fi 7), 5GHz, 2.4GHz
5. [ ] **Channel Width:** 160MHz (6GHz), 80MHz (5GHz)

### Record Credentials

```
Wi-Fi SSID: DDIL-Demo
Wi-Fi Password: ________________________
Admin Password: ________________________
```

---

## Step 3: Cable Connections

### Direct Cabling (No Patch Panel)

| Cable | From | To | Length |
|-------|------|-----|--------|
| C1 | UX7 LAN | Switch P1 | 1 ft |
| C2 | Switch P2 | Framework 5GbE | 1 ft |
| C3 | Switch P3 | DGX 10GbE-1 | 1 ft |

### Connect Cables

1. [ ] Connect Cat6a from **UX7 LAN** to **Switch P1**
2. [ ] Verify link LED on both devices
3. [ ] Connect Cat6a from **Switch P2** to **Framework 5GbE**
4. [ ] Connect Cat6a from **Switch P3** to **DGX 10GbE-1**

---

## Step 4: Switch Flex Mini Configuration

### Power On

1. [ ] Connect USB-C power to Switch Flex Mini
2. [ ] Wait for port LEDs to initialize

### Adopt in UniFi

1. [ ] Open UniFi web UI or app
2. [ ] Switch should appear as "Pending Adoption"
3. [ ] Click "Adopt"
4. [ ] Wait for provisioning (~1-2 min)

### Verify Port Status

In UniFi UI, check Ports tab:

| Port | Status | Device |
|------|--------|--------|
| P1 | ✓ Connected | Uplink to UX7 |
| P2 | ✓ Connected | Framework |
| P3 | ✓ Connected | DGX Spark |
| P4 | — | (Demo client) |
| P5 | — | (Spare) |

---

## Step 5: Configure Static IPs

### Framework Desktop (192.168.1.10)

On Framework, edit netplan:

```bash
sudo nano /etc/netplan/01-network.yaml
```

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    enp1s0:  # Adjust interface name as needed
      addresses:
        - 192.168.1.10/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses:
          - 192.168.1.1
```

Apply:

```bash
sudo netplan apply
```

### DGX Spark (192.168.1.20)

Already configured in [04-DGX-SPARK-SETUP.md](04-DGX-SPARK-SETUP.md).

---

## Step 6: DHCP Reservations (Optional)

For consistent IPs even with DHCP, create reservations in UniFi:

1. [ ] Go to UniFi → Settings → Networks → LAN
2. [ ] Add DHCP reservation:
   - Framework: MAC → 192.168.1.10
   - DGX: MAC → 192.168.1.20

---

## Step 7: Verify Connectivity

### From Framework

```bash
# Check own IP
ip addr show

# Ping gateway
ping -c 3 192.168.1.1

# Ping DGX
ping -c 3 192.168.1.20

# DNS test
nslookup google.com 192.168.1.1
```

### From DGX

```bash
# Ping gateway
ping -c 3 192.168.1.1

# Ping Framework
ping -c 3 192.168.1.10
```

### From Demo Laptop

1. [ ] Connect to Wi-Fi `DDIL-Demo`
2. [ ] Verify IP in 192.168.1.100-199 range
3. [ ] Ping:
   ```bash
   ping 192.168.1.1    # Gateway
   ping 192.168.1.10   # Framework
   ping 192.168.1.20   # DGX
   ```

---

## Step 8: Firewall Rules (Optional)

For demo purposes, no firewall rules needed on internal network.

For production/security, consider:

```bash
# On Framework - allow only necessary ports
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 9200/tcp   # Elasticsearch
sudo ufw allow 5601/tcp   # Kibana
sudo ufw allow 11434/tcp  # Ollama
```

---

## Network Configuration Complete

### Verification Checklist

- [ ] UX7 configured and broadcasting `DDIL-Demo`
- [ ] Switch adopted and all ports showing connected
- [ ] Framework has static IP 192.168.1.10
- [ ] DGX has static IP 192.168.1.20
- [ ] All devices can ping each other
- [ ] Demo laptop can connect via Wi-Fi
- [ ] Demo laptop can reach all internal devices

### Quick Reference

| Device | IP | Access |
|--------|-----|--------|
| Gateway | 192.168.1.1 | https://192.168.1.1 |
| Framework | 192.168.1.10 | ssh ddil@192.168.1.10 |
| DGX Spark | 192.168.1.20 | ssh nvidia@192.168.1.20 |
| Wi-Fi | DDIL-Demo | Password: ______ |

---

## Next Step

Proceed to → [06-FRAMEWORK-OS.md](06-FRAMEWORK-OS.md)
