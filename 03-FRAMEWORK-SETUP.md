# 03 - Framework Desktop Hardware Setup

> **Goal:** Assemble Framework Desktop mainboard with storage, cooling, Wi-Fi, and PSU.

## Components Checklist

- [ ] Framework Desktop Mainboard (Ryzen AI Max+ 395 / 64GB)
- [ ] Samsung 990 EVO Plus 1TB (OS drive)
- [ ] Samsung 990 EVO Plus 2TB (Data drive)
- [ ] Noctua NF-A12x25 HS-PWM 120mm Fan
- [ ] AMD RZ717 Wi-Fi 7 Module + Antennas
- [ ] FSP FlexGURU Pro 500W PSU
- [ ] DeskPi 2U Shelf (already installed in rack)

---

## Step 1: Prepare Workspace

1. [ ] Ground yourself (ESD wrist strap)
2. [ ] Remove mainboard from packaging
3. [ ] Place on anti-static surface
4. [ ] Locate M.2 slots (2x on board)

---

## Step 2: Install NVMe SSDs

### Slot Identification
- **M.2 Slot 1 (Primary):** Near CPU - Install 1TB (OS)
- **M.2 Slot 2 (Secondary):** Near edge - Install 2TB (Data)

### Installation

1. [ ] Remove M.2 slot covers/heatsinks if present
2. [ ] Insert 1TB SSD into Slot 1 at 30° angle
3. [ ] Press down and secure with screw
4. [ ] Insert 2TB SSD into Slot 2
5. [ ] Press down and secure with screw
6. [ ] Replace heatsinks if applicable

### Verification
```
Slot 1: Samsung 990 EVO Plus 1TB ☐
Slot 2: Samsung 990 EVO Plus 2TB ☐
```

---

## Step 3: Install Wi-Fi 7 Module

1. [ ] Locate M.2 E-key slot (Wi-Fi slot)
2. [ ] Insert AMD RZ717 module at 30° angle
3. [ ] Press down and secure with screw
4. [ ] Connect antenna cables (2x):
   - Main antenna → Main connector
   - Aux antenna → Aux connector
5. [ ] Route antenna cables to mounting points

---

## Step 4: Install Cooling Fan

The Noctua NF-A12x25 provides chassis airflow:

1. [ ] Identify fan mounting position on 2U shelf
2. [ ] Orient fan for exhaust (air out of case)
3. [ ] Connect fan to mainboard PWM header
4. [ ] Secure fan with included mounting hardware

### Fan Orientation
```
Airflow direction (exhaust):
┌──────────────┐
│   ┌─────┐    │
│   │ FAN │→→→ │ → Hot air out
│   └─────┘    │
│   Framework  │
└──────────────┘
```

---

## Step 5: Install PSU

### FSP FlexGURU Pro 500W Specifications
- Form factor: Flex ATX (81.5 x 40.5 x 150mm)
- Efficiency: 80+ Gold
- Modular cables

### Installation

1. [ ] Position PSU in 2U shelf (check clearance)
2. [ ] Connect 24-pin ATX cable to mainboard
3. [ ] Connect 8-pin CPU power cable to mainboard
4. [ ] Route cables cleanly (zip tie excess)
5. [ ] Connect AC inlet side toward rear of rack

### Cable Connections
| Cable | From | To |
|-------|------|-----|
| 24-pin ATX | PSU | Mainboard main power |
| 8-pin CPU | PSU | Mainboard CPU power |
| AC Power | PDU Outlet #2 | PSU inlet |

---

## Step 6: Mount Mainboard in 2U Shelf

1. [ ] Identify standoff positions in DeskPi shelf
2. [ ] Install standoffs (if not pre-installed)
3. [ ] Lower mainboard onto standoffs
4. [ ] Align I/O ports with rear cutout
5. [ ] Secure with screws (don't overtighten)
6. [ ] Verify no shorts (board not touching metal)

---

## Step 7: Install Antennas

1. [ ] Route antenna cables to rear panel
2. [ ] Attach external antennas to bulkhead connectors
3. [ ] Position antennas for best reception (vertical, spread apart)

---

## Step 8: Cable Management

1. [ ] Bundle excess cables with zip ties
2. [ ] Ensure no cables block airflow
3. [ ] Verify fan has clearance
4. [ ] Route power cables to rear

---

## Step 9: Install Assembly in Rack

1. [ ] Slide 2U shelf assembly into rack (if removed)
2. [ ] Align with cage nuts at 5U-6U
3. [ ] Secure front mounting screws
4. [ ] Connect PDU outlet #2 to PSU

---

## Step 10: Initial Power Test

**⚠️ Do not connect monitor/keyboard yet - just verify power**

1. [ ] Verify all power connections secure
2. [ ] Turn on PDU
3. [ ] Press Framework power button briefly
4. [ ] Observe:
   - [ ] PSU fan spins
   - [ ] Mainboard power LED illuminates
   - [ ] Noctua fan spins
5. [ ] If no issues, power off (hold power button 5s)

### Troubleshooting

| Symptom | Check |
|---------|-------|
| No power at all | PDU on? PSU switch on? |
| PSU fan only | 24-pin fully seated? |
| No POST beep | 8-pin CPU connected? RAM issues? |

---

## Hardware Assembly Complete

### Verification Checklist

- [ ] 1TB NVMe installed (OS drive)
- [ ] 2TB NVMe installed (Data drive)
- [ ] Wi-Fi module installed with antennas
- [ ] Fan installed and connected
- [ ] PSU installed and cabled
- [ ] Assembly mounted in rack
- [ ] Initial power test passed

### Component Summary

| Component | Status | Notes |
|-----------|--------|-------|
| CPU | Ryzen AI Max+ 395 | Pre-installed, 16C/32T |
| RAM | 64GB LPDDR5x-8000 | Soldered, not upgradeable |
| GPU | Radeon 8060S (40 CU) | Integrated |
| NPU | 50 TOPS XDNA 2 | Integrated |
| SSD 1 | Samsung 990 EVO 1TB | OS drive |
| SSD 2 | Samsung 990 EVO 2TB | Data drive |
| Network | 5GbE + Wi-Fi 7 | RZ717 module |
| PSU | FSP 500W | 80+ Gold |

---

## Next Step

Proceed to → [04-DGX-SPARK-SETUP.md](04-DGX-SPARK-SETUP.md)
