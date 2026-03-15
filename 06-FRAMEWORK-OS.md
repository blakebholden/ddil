# 06 - Framework OS Installation

> **Goal:** Install Ubuntu 24.04 LTS Server on Framework Desktop with optimized partitioning.

## OS Choice: Ubuntu 24.04 LTS Server

| Reason | Benefit |
|--------|---------|
| LTS support | 5 years of updates |
| Server edition | No GUI overhead |
| AMD support | Excellent Ryzen/Radeon drivers |
| Docker native | First-class container support |
| Elasticsearch certified | Official support |

---

## Step 1: Create Bootable USB

### Download Ubuntu 24.04 LTS Server

```bash
# On another machine, download ISO
wget https://releases.ubuntu.com/24.04/ubuntu-24.04-live-server-amd64.iso

# Verify checksum
sha256sum ubuntu-24.04-live-server-amd64.iso
```

### Create USB Installer

Using Balena Etcher, Rufus, or dd:

```bash
# Linux/Mac (replace /dev/sdX with your USB device)
sudo dd if=ubuntu-24.04-live-server-amd64.iso of=/dev/sdX bs=4M status=progress
sync
```

---

## Step 2: Boot from USB

1. [ ] Insert USB into Framework
2. [ ] Power on, press F12 (or Del) for boot menu
3. [ ] Select USB device
4. [ ] Choose "Install Ubuntu Server"

---

## Step 3: Installation Wizard

### Language & Keyboard
- [ ] Language: English
- [ ] Keyboard: US (or your preference)

### Network Configuration
- [ ] Select ethernet interface (enp1s0 or similar)
- [ ] Configure IPv4: Manual
  - Address: 192.168.1.10/24
  - Gateway: 192.168.1.1
  - DNS: 192.168.1.1, 8.8.8.8

### Storage Configuration

**Choose: Custom storage layout**

#### Partition Scheme

**Disk 1: 1TB NVMe (OS Drive - /dev/nvme0n1)**

| Partition | Size | Type | Mount Point |
|-----------|------|------|-------------|
| nvme0n1p1 | 512 MB | EFI | /boot/efi |
| nvme0n1p2 | 2 GB | ext4 | /boot |
| nvme0n1p3 | 997 GB | LVM PV | (vg_os) |

**LVM Volume Group: vg_os**

| Logical Volume | Size | Mount Point |
|----------------|------|-------------|
| lv_root | 100 GB | / |
| lv_home | 50 GB | /home |
| lv_var_log | 30 GB | /var/log |
| lv_tmp | 20 GB | /tmp |
| lv_swap | 16 GB | swap |
| (unallocated) | ~780 GB | (future use) |

**Disk 2: 2TB NVMe (Data Drive - /dev/nvme1n1)**

| Partition | Size | Type | Mount Point |
|-----------|------|------|-------------|
| nvme1n1p1 | 2 TB | LVM PV | (vg_data) |

**LVM Volume Group: vg_data**

| Logical Volume | Size | Mount Point |
|----------------|------|-------------|
| lv_elasticsearch | 800 GB | /var/lib/elasticsearch |
| lv_docker | 300 GB | /var/lib/docker |
| lv_models | 200 GB | /opt/models |
| lv_artifacts | 200 GB | /opt/artifacts |
| lv_snapshots | 300 GB | /opt/snapshots |
| (unallocated) | ~200 GB | (future use) |

### Profile Setup

- [ ] Your name: DDIL Admin
- [ ] Server name: `ddil-framework`
- [ ] Username: `ddil`
- [ ] Password: (set strong password)

### SSH Setup

- [ ] Install OpenSSH server: **Yes**
- [ ] Import SSH keys: (optional - from GitHub)

### Featured Snaps

- [ ] Skip all snaps (we'll install Docker via apt)

---

## Step 4: Complete Installation

1. [ ] Review configuration
2. [ ] Confirm and begin installation
3. [ ] Wait for installation (~10-15 min)
4. [ ] Remove USB when prompted
5. [ ] Reboot

---

## Step 5: First Boot Configuration

### Login and Verify

```bash
# Login with ddil user
# Verify hostname
hostname

# Verify IP
ip addr show

# Verify storage
lsblk
df -h
```

### Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### Install Essential Packages

```bash
sudo apt install -y \
  curl \
  wget \
  git \
  vim \
  htop \
  iotop \
  net-tools \
  dnsutils \
  jq \
  unzip \
  build-essential \
  linux-tools-common \
  linux-tools-generic
```

---

## Step 6: Configure LVM Volumes

If not done during install, create data LVM:

```bash
# Create physical volume on data drive
sudo pvcreate /dev/nvme1n1

# Create volume group
sudo vgcreate vg_data /dev/nvme1n1

# Create logical volumes
sudo lvcreate -L 800G -n lv_elasticsearch vg_data
sudo lvcreate -L 300G -n lv_docker vg_data
sudo lvcreate -L 200G -n lv_models vg_data
sudo lvcreate -L 200G -n lv_artifacts vg_data
sudo lvcreate -L 300G -n lv_snapshots vg_data

# Format volumes
sudo mkfs.ext4 /dev/vg_data/lv_elasticsearch
sudo mkfs.ext4 /dev/vg_data/lv_docker
sudo mkfs.ext4 /dev/vg_data/lv_models
sudo mkfs.ext4 /dev/vg_data/lv_artifacts
sudo mkfs.ext4 /dev/vg_data/lv_snapshots

# Create mount points
sudo mkdir -p /var/lib/elasticsearch
sudo mkdir -p /var/lib/docker
sudo mkdir -p /opt/models
sudo mkdir -p /opt/artifacts
sudo mkdir -p /opt/snapshots

# Add to fstab
echo '/dev/vg_data/lv_elasticsearch /var/lib/elasticsearch ext4 defaults 0 2' | sudo tee -a /etc/fstab
echo '/dev/vg_data/lv_docker /var/lib/docker ext4 defaults 0 2' | sudo tee -a /etc/fstab
echo '/dev/vg_data/lv_models /opt/models ext4 defaults 0 2' | sudo tee -a /etc/fstab
echo '/dev/vg_data/lv_artifacts /opt/artifacts ext4 defaults 0 2' | sudo tee -a /etc/fstab
echo '/dev/vg_data/lv_snapshots /opt/snapshots ext4 defaults 0 2' | sudo tee -a /etc/fstab

# Mount all
sudo mount -a

# Verify
df -h
```

---

## Step 7: System Tuning

### Elasticsearch Requirements

```bash
# Increase virtual memory for Elasticsearch
echo 'vm.max_map_count=262144' | sudo tee -a /etc/sysctl.conf

# Increase file descriptors
echo '* soft nofile 65536' | sudo tee -a /etc/security/limits.conf
echo '* hard nofile 65536' | sudo tee -a /etc/security/limits.conf

# Apply sysctl
sudo sysctl -p
```

### Disable Swap (for Elasticsearch)

```bash
# Temporarily
sudo swapoff -a

# Permanently (comment out swap in fstab)
sudo sed -i '/swap/d' /etc/fstab
```

### Set Timezone

```bash
sudo timedatectl set-timezone America/New_York
```

---

## Step 8: AMD GPU Drivers (Optional)

For ROCm support (if using iGPU for inference):

```bash
# Add AMD ROCm repository
wget https://repo.radeon.com/amdgpu-install/latest/ubuntu/noble/amdgpu-install_6.0.0-1_all.deb
sudo dpkg -i amdgpu-install_6.0.0-1_all.deb
sudo amdgpu-install --usecase=rocm

# Add user to render group
sudo usermod -aG render,video $USER

# Reboot required
sudo reboot
```

Verify after reboot:

```bash
rocm-smi
```

---

## Step 9: Verify Installation

### System Check

```bash
# CPU
lscpu | grep "Model name"

# Memory
free -h

# Storage
df -h

# Network
ip addr

# GPU (if ROCm installed)
rocm-smi
```

### Expected Output

```
CPU: AMD Ryzen AI Max+ 395
Memory: ~62GB available
Storage: 
  / (root): 100GB
  /var/lib/elasticsearch: 800GB
  /var/lib/docker: 300GB
Network: 192.168.1.10
```

---

## OS Installation Complete

### Verification Checklist

- [ ] Ubuntu 24.04 LTS installed
- [ ] Static IP configured (192.168.1.10)
- [ ] SSH accessible
- [ ] LVM volumes created and mounted
- [ ] System updated
- [ ] Essential packages installed
- [ ] Elasticsearch sysctl tuning applied
- [ ] Swap disabled

### Credentials Record

```
Hostname: ddil-framework
Username: ddil
Password: ________________________
SSH: ssh ddil@192.168.1.10
```

---

## Next Step

Proceed to → [07-DOCKER-SETUP.md](07-DOCKER-SETUP.md)
