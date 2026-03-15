# DDIL Demo Kit Build Guide

> **Purpose:** Step-by-step instructions for building a Disconnected, Degraded, Intermittent, Limited (DDIL) demonstration kit for GPU-accelerated AI search and RAG in airgapped environments.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      8U Mini Rack                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ DGX Spark (GB10 Blackwell, 128GB, 1 PFLOP)               │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ Network Shelf: UniFi Express 7 + Switch Flex Mini        │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ Framework Desktop (Ryzen AI Max+ 395, 64GB) [2U]         │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ Airflow / Expansion [3U]                                 │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ PDU (4-outlet, surge protected)                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                    Pelican Air 1615 Transport                   │
└─────────────────────────────────────────────────────────────────┘
```

## Hardware Summary

| Component | Specs | Role |
|-----------|-------|------|
| **Framework Desktop** | Ryzen AI Max+ 395, 64GB, 3TB NVMe | Elasticsearch, Kibana, local inference |
| **NVIDIA DGX Spark** | GB10 Grace Blackwell, 128GB, 4TB | Large LLM inference (70B-405B) |
| **UniFi Express 7** | Wi-Fi 7 AP, Router, 2.5GbE | Gateway, DHCP, wireless access |
| **Switch Flex Mini** | 5-port GbE managed | Internal network switching |

## Build Phases

| Phase | Guide | Est. Time |
|-------|-------|-----------|
| 1. Inventory & Unboxing | [01-HARDWARE-INVENTORY.md](01-HARDWARE-INVENTORY.md) | 30 min |
| 2. Rack Assembly | [02-RACK-ASSEMBLY.md](02-RACK-ASSEMBLY.md) | 2 hrs |
| 3. Framework Hardware | [03-FRAMEWORK-SETUP.md](03-FRAMEWORK-SETUP.md) | 1 hr |
| 4. DGX Spark Setup | [04-DGX-SPARK-SETUP.md](04-DGX-SPARK-SETUP.md) | 1 hr |
| 5. Network Configuration | [05-NETWORK-CONFIG.md](05-NETWORK-CONFIG.md) | 1 hr |
| 6. Framework OS Install | [06-FRAMEWORK-OS.md](06-FRAMEWORK-OS.md) | 1 hr |
| 7. Docker & Containers | [07-DOCKER-SETUP.md](07-DOCKER-SETUP.md) | 30 min |
| 8. Elasticsearch Stack | [08-ELASTICSEARCH.md](08-ELASTICSEARCH.md) | 1 hr |
| 9. AI Inference Setup | [09-AI-INFERENCE.md](09-AI-INFERENCE.md) | 2 hrs |
| 10. RAG Pipeline | [10-RAG-PIPELINE.md](10-RAG-PIPELINE.md) | 2 hrs |
| 11. Demo Application | [11-DEMO-APP.md](11-DEMO-APP.md) | 2 hrs |
| 12. Validation & Testing | [12-VALIDATION.md](12-VALIDATION.md) | 2 hrs |

**Total Estimated Time:** 2 days

## Reference Documents

| Document | Purpose |
|----------|---------|
| [SBOM.md](SBOM.md) | Software Bill of Materials |
| [NETWORK-DIAGRAM.md](NETWORK-DIAGRAM.md) | IP addresses, ports, topology |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues and fixes |

## Success Criteria

- [ ] Cold boot to operational in <5 minutes
- [ ] Semantic search queries <2 seconds
- [ ] RAG chat responses <10 seconds (first token <2s)
- [ ] Fully disconnected operation (no internet required)
- [ ] Entire kit fits in Pelican 1615, <50 lbs
- [ ] 2+ hour continuous demo runtime

## IP Address Quick Reference

```
192.168.1.1   - UniFi Express 7 (Gateway)
192.168.1.10  - Framework Desktop
192.168.1.20  - DGX Spark
192.168.1.100+- DHCP clients (demo laptops)
```

## Credentials (Set During Build)

| Service | Default User | Password |
|---------|--------------|----------|
| Ubuntu (Framework) | `ddil` | *set during install* |
| DGX Spark | `nvidia` | *set during setup* |
| Elasticsearch | `elastic` | *generated* |
| Kibana | `elastic` | *same as ES* |
| UniFi | *setup via app* | *set during setup* |
| Wi-Fi SSID | `DDIL-Demo` | *set during setup* |
