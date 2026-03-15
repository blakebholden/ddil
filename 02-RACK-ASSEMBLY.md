# 02 - Rack Assembly

> **Goal:** Assemble the 8U rack frame and install mounting rails.

## Rack Layout Plan

```
┌─────────────────────────────────────────┐
│ 8U │ DGX Spark                          │ ← Top (heaviest, most heat)
├─────────────────────────────────────────┤
│ 7U │ Network Shelf (UX7 + Switch)       │
├─────────────────────────────────────────┤
│ 6U │ Framework Desktop (2U)             │
│ 5U │                                    │
├─────────────────────────────────────────┤
│ 4U │ Airflow / Cable Management         │
├─────────────────────────────────────────┤
│ 3U │ Expansion (empty)                  │
│ 2U │                                    │
├─────────────────────────────────────────┤
│ 1U │ (reserved / future patch panel)    │
├─────────────────────────────────────────┤
│    │ PDU (bottom mount)                 │
└─────────────────────────────────────────┘
```

---

## Step 1: Assemble 8U Rack Frame

Follow the DeskPi RackMate T1 instructions:

1. [ ] Identify the four vertical posts
2. [ ] Attach top cross-members
3. [ ] Attach bottom cross-members
4. [ ] Verify frame is square (measure diagonals)
5. [ ] Tighten all bolts

### Verification
```bash
# Measure diagonals - should be equal (±2mm)
Diagonal A: _____ mm
Diagonal B: _____ mm
```

---

## Step 2: Install Cage Nuts

Install cage nuts at the following U positions (front and rear):

| Position | Front Left | Front Right | Rear Left | Rear Right | Purpose |
|----------|------------|-------------|-----------|------------|---------|
| 8U | ☐ | ☐ | ☐ | ☐ | DGX Spark |
| 7U | ☐ | ☐ | ☐ | ☐ | Network shelf |
| 6U | ☐ | ☐ | ☐ | ☐ | Framework (top) |
| 5U | ☐ | ☐ | ☐ | ☐ | Framework (bottom) |
| Bottom | ☐ | ☐ | ☐ | ☐ | PDU |

---

## Step 3: Install PDU

1. [ ] Position PDU at bottom of rack (below 1U)
2. [ ] Orient outlets facing rear (easier cable management)
3. [ ] Secure with mounting screws
4. [ ] Route power cord out the back

### PDU Outlet Assignment

| Outlet | Device | Notes |
|--------|--------|-------|
| #1 | DGX Spark | 500W max |
| #2 | Framework PSU | 400W max |
| #3 | Reserved | USB-C charger for network gear (optional) |
| #4 | Reserved | Spare |

---

## Step 4: Install 2U Framework Shelf

1. [ ] Align DeskPi 2U shelf at position 5U-6U
2. [ ] Insert screws through front mounting ears
3. [ ] Finger-tighten only (will adjust after mainboard install)
4. [ ] Verify shelf is level

---

## Step 5: Prepare Network Shelf Position (7U)

For now, just verify cage nuts are installed at 7U. The 3D printed shelf (or temporary solution) will be installed after printing.

**Temporary option:** Use a small piece of plywood or acrylic cut to 10" width, resting on the Framework shelf below.

---

## Step 6: Prepare DGX Spark Position (8U)

The DGX Spark will sit on top of the rack or on a simple shelf at 8U.

1. [ ] Verify top of rack can support DGX weight (~5kg)
2. [ ] If using shelf, install at 8U position
3. [ ] Ensure adequate clearance for airflow (top exhaust)

---

## Step 7: Cable Management Prep

Install cable management features:

1. [ ] Velcro straps or cable ties at each U position
2. [ ] Consider vertical cable channels on sides if included
3. [ ] Label PDU outlets

---

## Assembly Checklist

Before proceeding:

- [ ] Rack frame assembled and square
- [ ] All cage nuts installed
- [ ] PDU mounted and tested (plug in, verify LED)
- [ ] 2U Framework shelf installed
- [ ] Network shelf position prepared
- [ ] DGX position prepared
- [ ] Cable management ready

---

## Rack Dimensions Verification

| Measurement | Expected | Actual |
|-------------|----------|--------|
| External width | ~300mm (11.8") | _____ |
| Internal width (10") | 254mm (10") | _____ |
| External depth | ~450mm (17.7") | _____ |
| Height (8U) | ~400mm (15.7") | _____ |

---

## Next Step

Proceed to → [03-FRAMEWORK-SETUP.md](03-FRAMEWORK-SETUP.md)
