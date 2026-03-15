# Network Diagram Reference

## Physical Topology

```
                              ┌─────────────────────────┐
                              │      Demo Laptop        │
                              │   DHCP: 192.168.1.100+  │
                              └───────────┬─────────────┘
                                          │
                           Wi-Fi 7 (DDIL-Demo) or Wired
                                          │
┌─────────────────────────────────────────┴──────────────────────────────────┐
│                                                                            │
│    ┌──────────────────────────────────────────────────────────────────┐   │
│    │                     UniFi Express 7                              │   │
│    │                     192.168.1.1 (Gateway)                        │   │
│    │    [WAN]           [LAN 2.5GbE]            [Wi-Fi 7 AP]         │   │
│    │     │                   │                      │                │   │
│    │  (unused)               │                 SSID: DDIL-Demo       │   │
│    └─────────────────────────┼──────────────────────────────────────┘   │
│                              │                                           │
│                              │ Cat6a (1ft)                               │
│                              ▼                                           │
│    ┌──────────────────────────────────────────────────────────────────┐   │
│    │                    Switch Flex Mini                              │   │
│    │         [P1]      [P2]      [P3]      [P4]      [P5]            │   │
│    │        Uplink     FW       DGX      Client    Spare             │   │
│    │          │         │        │         │         │               │   │
│    └──────────┼─────────┼────────┼─────────┼─────────┼───────────────┘   │
│               │         │        │         │         │                   │
│               │   Cat6a │  Cat6a │         │         │                   │
│               │   (1ft) │  (1ft) │         │         │                   │
│               │         ▼        ▼         │         │                   │
│               │    ┌─────────┐ ┌─────────┐ │         │                   │
│               │    │Framework│ │  DGX    │ │         │                   │
│               │    │ Desktop │ │  Spark  │ │         │                   │
│               │    │.1.10    │ │ .1.20   │ │         │                   │
│               │    └────┬────┘ └────┬────┘ │         │                   │
│               │         │           │      │         │                   │
│               │         └─────┬─────┘      │         │                   │
│               │               │            │         │                   │
│               │          USB4 (Optional)   │         │                   │
│               │          40 Gbps           │         │                   │
│                                                                          │
│    8U Rack (DeskPi RackMate T1)                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

## IP Address Map

| IP Address | Device | MAC Address | Interface | Notes |
|------------|--------|-------------|-----------|-------|
| 192.168.1.1 | UniFi Express 7 | (auto) | LAN | Gateway, DHCP, DNS |
| 192.168.1.2 | Switch Flex Mini | (auto) | mgmt | Optional static |
| 192.168.1.10 | Framework Desktop | (record) | enp1s0 | Static |
| 192.168.1.20 | DGX Spark | (record) | eth0 | Static |
| 192.168.1.100-199 | DHCP Pool | — | — | Demo clients |

## Port Reference

### Service Ports (Framework - 192.168.1.10)

| Port | Service | Protocol | Access |
|------|---------|----------|--------|
| 22 | SSH | TCP | Admin |
| 9200 | Elasticsearch | TCP | Internal |
| 9300 | ES Transport | TCP | Internal |
| 5601 | Kibana | TCP | Web UI |
| 8501 | Streamlit Demo | TCP | Web UI |
| 11434 | Ollama | TCP | API |
| 3000 | Open WebUI | TCP | Web UI |

### Service Ports (DGX Spark - 192.168.1.20)

| Port | Service | Protocol | Access |
|------|---------|----------|--------|
| 22 | SSH | TCP | Admin |
| 11434 | Ollama | TCP | API |

## Cable Schedule

| ID | From | To | Type | Length | Color |
|----|------|-----|------|--------|-------|
| C1 | UX7 LAN | Switch P1 | Cat6a | 1 ft | Blue |
| C2 | Switch P2 | Framework 5GbE | Cat6a | 1 ft | Orange |
| C3 | Switch P3 | DGX 10GbE-1 | Cat6a | 1 ft | Green |
| C4 | DGX USB4-1 | FW USB4-1 | USB4 | 1 ft | Purple (optional) |

## Wi-Fi Configuration

| Setting | Value |
|---------|-------|
| SSID | DDIL-Demo |
| Security | WPA3 Personal |
| Password | (set during setup) |
| Bands | 6GHz, 5GHz, 2.4GHz |
| Channel Width | 160MHz (6GHz) |

## Firewall Rules (if enabled)

### Framework (ufw)

```bash
sudo ufw allow ssh
sudo ufw allow 9200/tcp    # Elasticsearch
sudo ufw allow 5601/tcp    # Kibana
sudo ufw allow 8501/tcp    # Streamlit
sudo ufw allow 11434/tcp   # Ollama
sudo ufw allow from 192.168.1.0/24
```

## DNS Resolution

Local DNS handled by UniFi Express 7. For custom hostnames, add to `/etc/hosts`:

```
192.168.1.10    ddil-framework framework
192.168.1.20    ddil-dgx dgx
192.168.1.1     gateway
```

## Access URLs

| Service | URL |
|---------|-----|
| Kibana | http://192.168.1.10:5601 |
| Elasticsearch | http://192.168.1.10:9200 |
| Demo App | http://192.168.1.10:8501 |
| Open WebUI | http://192.168.1.10:3000 |
| UniFi Console | http://192.168.1.1 |
