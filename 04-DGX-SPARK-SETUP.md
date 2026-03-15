# 04 - DGX Spark Setup

> **Goal:** Unbox, position, and perform initial boot of NVIDIA DGX Spark.

## DGX Spark Specifications

| Spec | Value |
|------|-------|
| SoC | GB10 Grace Blackwell Superchip |
| CPU | 20 ARM Neoverse cores |
| GPU | Blackwell GPU (1 PFLOP FP4) |
| Memory | 128GB unified LPDDR5x |
| Storage | 4TB NVMe |
| Network | 2x 10GbE, 2x USB4 (40Gbps) |
| Display | 2x DisplayPort 1.4 |
| Power | ~500W max |

---

## Step 1: Unbox DGX Spark

1. [ ] Remove from shipping container
2. [ ] Inspect for shipping damage
3. [ ] Verify contents:
   - [ ] DGX Spark unit
   - [ ] Power cable (IEC C13)
   - [ ] Quick start guide
   - [ ] Documentation
4. [ ] Record serial number: `_____________________`

---

## Step 2: Physical Inspection

Check all ports on rear panel:

- [ ] 2x 10GbE RJ45 ports (no damage to connectors)
- [ ] 2x USB4/Thunderbolt ports (no bent pins)
- [ ] 2x DisplayPort outputs
- [ ] AC power inlet
- [ ] Ventilation grilles clear

---

## Step 3: Position in Rack

1. [ ] Place DGX Spark at 8U position (top of rack)
2. [ ] Ensure ventilation clearance:
   - Minimum 2" above for exhaust
   - Sides unobstructed
3. [ ] Verify stable placement
4. [ ] Do NOT connect power yet

### Placement Diagram
```
     ↑↑↑ Hot air exhaust ↑↑↑
┌─────────────────────────────┐
│         DGX Spark           │
│  [10G][10G][USB4][USB4][DP] │ ← Rear I/O
└─────────────────────────────┘
         Rack top (8U)
```

---

## Step 4: Connect Network

Connect 10GbE to Switch Flex Mini:

1. [ ] Take one Cat6a cable (1ft)
2. [ ] Connect DGX **10GbE-1** port
3. [ ] Connect other end to Switch Flex Mini **Port 3**
4. [ ] Verify cable clicks into place

```
DGX 10GbE-1 ←──Cat6a──→ Switch P3
```

---

## Step 5: Connect Power

1. [ ] Connect IEC C13 power cable to DGX
2. [ ] Connect other end to PDU **Outlet #1**
3. [ ] Do NOT power on yet

---

## Step 6: Optional - USB4 Direct Link

For maximum bandwidth to Framework (40Gbps):

1. [ ] Take USB4 cable (if available)
2. [ ] Connect DGX **USB4-1** to Framework **USB4-1**
3. [ ] This creates a direct PCIe link

> **Note:** This is optional. Network-only setup works fine for most demos.

---

## Step 7: First Boot

### Pre-boot Checklist
- [ ] 10GbE connected to switch
- [ ] Power connected to PDU
- [ ] PDU powered on
- [ ] Monitor connected to DisplayPort (optional)
- [ ] USB keyboard connected (optional)

### Boot Sequence

1. [ ] Press power button on DGX Spark
2. [ ] Observe boot indicators:
   - Power LED illuminates
   - Fan spins up
   - Display shows boot sequence (if connected)
3. [ ] Wait for boot to complete (~2-3 minutes)

---

## Step 8: Initial DGX Configuration

If monitor/keyboard connected, perform initial setup:

### Network Configuration

The DGX runs a customized Ubuntu-based OS. Configure static IP:

```bash
# Check current IP (likely DHCP assigned)
ip addr show

# Edit netplan configuration
sudo nano /etc/netplan/01-netcfg.yaml
```

Set static IP:

```yaml
network:
  version: 2
  ethernets:
    eth0:
      addresses:
        - 192.168.1.20/24
      gateway4: 192.168.1.1
      nameservers:
        addresses:
          - 192.168.1.1
          - 8.8.8.8
```

Apply configuration:

```bash
sudo netplan apply
```

### Verify Network

```bash
# Check IP
ip addr show eth0

# Ping gateway
ping -c 3 192.168.1.1

# Ping Framework (once configured)
ping -c 3 192.168.1.10
```

---

## Step 9: SSH Access Setup

Enable SSH for remote management:

```bash
# Verify SSH is running
sudo systemctl status ssh

# If not running
sudo systemctl enable ssh
sudo systemctl start ssh
```

From another machine, verify SSH access:

```bash
ssh nvidia@192.168.1.20
```

---

## Step 10: Verify GPU Status

```bash
# Check NVIDIA GPU
nvidia-smi

# Expected output should show:
# - Blackwell GPU
# - 128GB memory
# - Driver version
# - CUDA version
```

### Expected nvidia-smi Output

```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI xxx.xx       Driver Version: xxx.xx       CUDA Version: xx.x    |
|-------------------------------+----------------------+----------------------+
| GPU  Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr. ECC |
| Fan  Temp  Perf  Pwr:Usage/Cap|         Memory-Usage | GPU-Util  Compute M. |
|===============================+======================+======================|
|   0  Blackwell GB10      On   | 00000000:XX:00.0 Off |                    0 |
| N/A   45C    P0    50W / 500W |      0MiB / 131072MiB|      0%      Default |
+-------------------------------+----------------------+----------------------+
```

---

## Step 11: System Information

Record system details:

```bash
# OS version
cat /etc/os-release

# Kernel
uname -r

# CPU info
lscpu

# Memory
free -h

# Storage
lsblk
df -h
```

---

## DGX Spark Setup Complete

### Verification Checklist

- [ ] DGX Spark positioned in rack
- [ ] 10GbE connected to switch
- [ ] Power connected to PDU
- [ ] Successfully booted
- [ ] Static IP configured (192.168.1.20)
- [ ] SSH access working
- [ ] nvidia-smi shows GPU

### Quick Reference

| Setting | Value |
|---------|-------|
| IP Address | 192.168.1.20 |
| Subnet | 255.255.255.0 |
| Gateway | 192.168.1.1 |
| SSH User | nvidia |
| SSH Port | 22 |

---

## Next Step

Proceed to → [05-NETWORK-CONFIG.md](05-NETWORK-CONFIG.md)
