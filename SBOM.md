# Software Bill of Materials (SBOM)

> **Purpose:** Document all software components for security review, compliance, and airgap staging.

## Overview

| Category | Count |
|----------|-------|
| Operating Systems | 2 |
| Container Images | 4 |
| AI Models | 6 |
| Python Packages | 15+ |
| System Packages | 20+ |

---

## Operating Systems

### Framework Desktop

| Component | Version | Source | License |
|-----------|---------|--------|---------|
| Ubuntu Server | 24.04 LTS | ubuntu.com | GPL/Various |
| Linux Kernel | 6.8.x | ubuntu.com | GPL-2.0 |

### DGX Spark

| Component | Version | Source | License |
|-----------|---------|--------|---------|
| DGX OS | Ubuntu-based | NVIDIA | NVIDIA EULA |
| CUDA | 12.x | NVIDIA | NVIDIA EULA |
| cuDNN | 9.x | NVIDIA | NVIDIA EULA |

---

## Container Images

| Image | Version | Registry | Size | License |
|-------|---------|----------|------|---------|
| elasticsearch | 8.15.0 | docker.elastic.co | ~1.2GB | Elastic License 2.0 |
| kibana | 8.15.0 | docker.elastic.co | ~1.0GB | Elastic License 2.0 |
| open-webui | latest | ghcr.io | ~500MB | MIT |
| alpine | latest | docker.io | ~5MB | MIT |

### Pull Commands (for airgap staging)

```bash
# Pull images on internet-connected machine
docker pull docker.elastic.co/elasticsearch/elasticsearch:8.15.0
docker pull docker.elastic.co/kibana/kibana:8.15.0
docker pull ghcr.io/open-webui/open-webui:main
docker pull alpine:latest

# Save to tarball
docker save -o ddil-images.tar \
  docker.elastic.co/elasticsearch/elasticsearch:8.15.0 \
  docker.elastic.co/kibana/kibana:8.15.0 \
  ghcr.io/open-webui/open-webui:main \
  alpine:latest

# Load on airgapped system
docker load -i ddil-images.tar
```

---

## AI Models

### LLM Models (DGX Spark)

| Model | Parameters | Quantization | Size | License | Source |
|-------|------------|--------------|------|---------|--------|
| llama3.1:70b | 70B | Q4_K_M | ~40GB | Meta Llama 3.1 | ollama.com |
| llama3.1:8b | 8B | Q4_K_M | ~4.7GB | Meta Llama 3.1 | ollama.com |
| qwen2.5:72b | 72B | Q4_K_M | ~40GB | Apache 2.0 | ollama.com |

### Embedding Models (Framework)

| Model | Parameters | Size | License | Source |
|-------|------------|------|---------|--------|
| nomic-embed-text | 137M | ~274MB | Apache 2.0 | ollama.com |
| mxbai-embed-large | 335M | ~670MB | Apache 2.0 | ollama.com |

### Local LLM (Framework)

| Model | Parameters | Size | License | Source |
|-------|------------|------|---------|--------|
| mistral:7b | 7B | ~4.1GB | Apache 2.0 | ollama.com |
| phi3:mini | 3.8B | ~2.2GB | MIT | ollama.com |

### Model Download Commands

```bash
# On DGX Spark
ollama pull llama3.1:70b
ollama pull llama3.1:8b
ollama pull qwen2.5:72b

# On Framework
ollama pull nomic-embed-text
ollama pull mxbai-embed-large
ollama pull mistral:7b
ollama pull phi3:mini
```

### Airgap Model Staging

```bash
# Export models (on connected machine)
# Models are stored in ~/.ollama/models

# Copy to USB drive
cp -r ~/.ollama/models /media/usb/ollama-models/

# On airgapped system
cp -r /media/usb/ollama-models/* ~/.ollama/models/
```

---

## System Packages (Ubuntu)

### Core Packages

| Package | Version | Purpose |
|---------|---------|---------|
| docker-ce | 26.x | Container runtime |
| docker-compose-plugin | 2.x | Container orchestration |
| curl | 8.x | HTTP client |
| wget | 1.x | File download |
| git | 2.x | Version control |
| vim | 9.x | Text editor |
| jq | 1.7 | JSON processing |
| htop | 3.x | Process monitor |
| net-tools | 2.x | Network utilities |

### Installation

```bash
sudo apt install -y \
  curl wget git vim jq htop \
  net-tools dnsutils iotop \
  build-essential linux-tools-common \
  ca-certificates gnupg
```

---

## Python Environment

### Python Version

| Component | Version |
|-----------|---------|
| Python | 3.12.x |
| pip | 24.x |
| venv | built-in |

### Python Packages (Demo App)

| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| streamlit | 1.37.x | Web UI framework | Apache 2.0 |
| elasticsearch | 8.15.x | ES Python client | Apache 2.0 |
| requests | 2.32.x | HTTP library | Apache 2.0 |
| ollama | 0.3.x | Ollama Python client | MIT |
| numpy | 1.26.x | Numerical computing | BSD |
| pandas | 2.2.x | Data manipulation | BSD |

### Requirements File

```bash
cat > /opt/ddil/demo-app/requirements.txt <<EOF
streamlit>=1.37.0
elasticsearch>=8.15.0
requests>=2.32.0
ollama>=0.3.0
numpy>=1.26.0
pandas>=2.2.0
python-dotenv>=1.0.0
EOF
```

### Airgap Python Package Staging

```bash
# On connected machine
pip download -r requirements.txt -d ./python-packages/

# Copy to airgapped system
pip install --no-index --find-links=./python-packages/ -r requirements.txt
```

---

## Ollama Runtime

| Component | Version | Source | License |
|-----------|---------|--------|---------|
| Ollama | 0.3.x | ollama.com | MIT |

### Installation

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Airgap Installation

```bash
# Download binary on connected machine
curl -L https://ollama.com/download/ollama-linux-amd64 -o ollama

# Transfer and install
chmod +x ollama
sudo mv ollama /usr/local/bin/
```

---

## Network Firmware

| Device | Firmware | Source |
|--------|----------|--------|
| UniFi Express 7 | Latest | ui.com |
| Switch Flex Mini | Latest | ui.com |

### Firmware Update (Pre-deployment)

Update via UniFi app before airgapping.

---

## License Summary

| License | Components |
|---------|------------|
| Apache 2.0 | Qwen, Mistral, Elasticsearch clients, Streamlit |
| MIT | Ollama, Phi-3, Open WebUI |
| Meta Llama 3.1 | Llama 3.1 models |
| Elastic License 2.0 | Elasticsearch, Kibana |
| GPL-2.0 | Linux kernel |
| NVIDIA EULA | CUDA, cuDNN, DGX OS |
| BSD | NumPy, Pandas |

---

## Security Considerations

### Vulnerability Scanning

```bash
# Scan container images
docker scan docker.elastic.co/elasticsearch/elasticsearch:8.15.0

# Scan Python packages
pip-audit

# Scan system packages
sudo apt list --upgradable
```

### Hardening Checklist

- [ ] All packages from official sources
- [ ] No known critical CVEs
- [ ] SSH key-based auth only
- [ ] Firewall configured
- [ ] Audit logging enabled

---

## Airgap Staging Checklist

### Pre-Stage (Internet Connected)

- [ ] Download Ubuntu 24.04 ISO
- [ ] Pull all Docker images
- [ ] Download all Ollama models
- [ ] Download Python packages
- [ ] Download Ollama binary
- [ ] Export to USB/portable drive

### Files to Transfer

```
/airgap-staging/
├── ubuntu-24.04-live-server-amd64.iso
├── ddil-images.tar              # Docker images
├── ollama-models/               # AI models
│   ├── llama3.1-70b/
│   ├── llama3.1-8b/
│   ├── nomic-embed-text/
│   └── mistral-7b/
├── python-packages/             # pip packages
├── ollama                       # Ollama binary
└── scripts/
    ├── install-docker.sh
    └── setup-ddil.sh
```

### Transfer Media

| Media | Capacity | Purpose |
|-------|----------|---------|
| USB 3.0 Drive | 256GB+ | All staging files |
| SSD Enclosure | 1TB | Faster transfer |

---

## Version Control

This SBOM generated: `{{DATE}}`

Update this document when:
- Upgrading any component
- Adding new dependencies
- Patching security vulnerabilities
- Pre-deployment verification

---

## Compliance Notes

| Standard | Status |
|----------|--------|
| NIST 800-171 | Review required |
| FedRAMP | N/A (on-prem) |
| FIPS 140-2 | Not enabled by default |
| STIG | No official ES STIG |

For classified deployments, additional hardening may be required.
