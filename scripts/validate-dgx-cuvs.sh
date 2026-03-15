#!/bin/bash
# ============================================================
# DGX Spark cuVS Feasibility Validation
# Run this on the DGX Spark to determine if the aarch64
# cuVS build path is viable.
# ============================================================

set -euo pipefail

echo "╔════════════════════════════════════════════════╗"
echo "║  DGX Spark cuVS Feasibility Check              ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

PASS=0
WARN=0
FAIL=0

check() {
  local label="$1"
  local status="$2"  # pass, warn, fail
  local detail="$3"
  case "$status" in
    pass) echo "  ✓ $label: $detail"; ((PASS++)) ;;
    warn) echo "  ⚠ $label: $detail"; ((WARN++)) ;;
    fail) echo "  ✗ $label: $detail"; ((FAIL++)) ;;
  esac
}

# ── 1. Architecture ──────────────────────────────────────────
echo "── Architecture ──"
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ]; then
  check "CPU Architecture" "pass" "$ARCH (confirmed ARM)"
else
  check "CPU Architecture" "fail" "$ARCH (expected aarch64)"
fi

OS=$(uname -s)
check "OS" "pass" "$OS $(uname -r)"

echo ""

# ── 2. GPU Info ──────────────────────────────────────────────
echo "── GPU ──"
if command -v nvidia-smi &>/dev/null; then
  GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
  GPU_MEM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader 2>/dev/null | head -1)
  GPU_DRIVER=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1)
  GPU_COMPUTE=$(nvidia-smi --query-gpu=compute_cap --format=csv,noheader 2>/dev/null | head -1)
  CUDA_VER=$(nvidia-smi | grep "CUDA Version" | awk '{print $9}' 2>/dev/null || echo "unknown")

  check "GPU" "pass" "$GPU_NAME"
  check "GPU Memory" "pass" "$GPU_MEM"
  check "Driver" "pass" "$GPU_DRIVER"
  check "CUDA Version" "pass" "$CUDA_VER"

  # Compute capability check (need >= 8.0 for cuVS)
  if [ -n "$GPU_COMPUTE" ]; then
    MAJOR=$(echo "$GPU_COMPUTE" | cut -d. -f1)
    if [ "$MAJOR" -ge 8 ]; then
      check "Compute Capability" "pass" "$GPU_COMPUTE (>= 8.0 required)"
    else
      check "Compute Capability" "fail" "$GPU_COMPUTE (need >= 8.0)"
    fi
  else
    check "Compute Capability" "warn" "Could not detect"
  fi
else
  check "nvidia-smi" "fail" "Not found"
fi

echo ""

# ── 3. CUDA Toolkit ──────────────────────────────────────────
echo "── CUDA Toolkit ──"
if command -v nvcc &>/dev/null; then
  NVCC_VER=$(nvcc --version | grep "release" | awk '{print $5}' | tr -d ',')
  check "nvcc" "pass" "Version $NVCC_VER"
else
  check "nvcc" "warn" "Not in PATH (may need: export PATH=/usr/local/cuda/bin:\$PATH)"
  if [ -f /usr/local/cuda/bin/nvcc ]; then
    NVCC_VER=$(/usr/local/cuda/bin/nvcc --version | grep "release" | awk '{print $5}' | tr -d ',')
    check "nvcc (at /usr/local/cuda)" "pass" "Version $NVCC_VER"
  fi
fi

echo ""

# ── 4. Java ──────────────────────────────────────────────────
echo "── Java ──"
if command -v java &>/dev/null; then
  JAVA_VER=$(java -version 2>&1 | head -1)
  JAVA_MAJOR=$(java -version 2>&1 | head -1 | grep -oP '"\K[0-9]+' | head -1)
  if [ "$JAVA_MAJOR" -ge 22 ]; then
    check "Java" "pass" "$JAVA_VER (>= 22 required)"
  else
    check "Java" "warn" "$JAVA_VER (need >= 22, will need to install)"
  fi
else
  check "Java" "warn" "Not installed (will need JDK 22+)"
fi

echo ""

# ── 5. Build Tools ───────────────────────────────────────────
echo "── Build Tools ──"
if command -v cmake &>/dev/null; then
  CMAKE_VER=$(cmake --version | head -1)
  check "cmake" "pass" "$CMAKE_VER"
else
  check "cmake" "warn" "Not installed (need 3.30+)"
fi

if command -v mvn &>/dev/null; then
  MVN_VER=$(mvn --version 2>/dev/null | head -1)
  check "maven" "pass" "$MVN_VER"
else
  check "maven" "warn" "Not installed (need 3.9.6+)"
fi

if command -v gcc &>/dev/null; then
  GCC_VER=$(gcc --version | head -1)
  check "gcc" "pass" "$GCC_VER"
else
  check "gcc" "warn" "Not installed"
fi

echo ""

# ── 6. Conda / RAPIDS Packages ──────────────────────────────
echo "── RAPIDS aarch64 Packages ──"
if command -v conda &>/dev/null || command -v mamba &>/dev/null; then
  CONDA_CMD=$(command -v mamba || command -v conda)
  check "Conda/Mamba" "pass" "$(basename $CONDA_CMD) found"

  # Check for libcuvs aarch64 packages
  echo "  Searching for libcuvs aarch64 packages (this may take a moment)..."
  PKGS=$($CONDA_CMD search -c rapidsai -c conda-forge -c nvidia libcuvs 2>/dev/null | grep -i "linux-aarch64\|linux-64" | tail -10 || echo "")
  if [ -n "$PKGS" ]; then
    check "libcuvs packages" "pass" "Found:"
    echo "$PKGS" | sed 's/^/      /'
  else
    check "libcuvs packages" "warn" "No results (may need to check manually)"
  fi
else
  check "Conda/Mamba" "warn" "Not installed (recommended for dependency management)"
fi

echo ""

# ── 7. Existing Libraries ───────────────────────────────────
echo "── Existing cuVS / RAPIDS Libraries ──"
CUVS_LIBS=$(find /usr -name "libcuvs*" 2>/dev/null || true)
if [ -n "$CUVS_LIBS" ]; then
  check "libcuvs" "pass" "Found:"
  echo "$CUVS_LIBS" | sed 's/^/      /'
else
  check "libcuvs" "warn" "Not pre-installed (will build from source or conda)"
fi

RMM_LIBS=$(find /usr -name "librmm*" 2>/dev/null || true)
RAFT_LIBS=$(find /usr -name "libraft*" 2>/dev/null || true)
[ -n "$RMM_LIBS" ] && check "librmm" "pass" "Found" || check "librmm" "warn" "Not pre-installed"
[ -n "$RAFT_LIBS" ] && check "libraft" "pass" "Found" || check "libraft" "warn" "Not pre-installed"

echo ""

# ── 8. Elasticsearch ────────────────────────────────────────
echo "── Elasticsearch ──"
ES_INSTALLED=$(find /usr/share/elasticsearch /opt -name "elasticsearch" -type f 2>/dev/null | head -1 || true)
if [ -n "$ES_INSTALLED" ]; then
  check "Elasticsearch" "pass" "Found at $(dirname $ES_INSTALLED)"
else
  check "Elasticsearch" "warn" "Not yet installed"
fi

DOCKER_INSTALLED=$(command -v docker 2>/dev/null || true)
if [ -n "$DOCKER_INSTALLED" ]; then
  check "Docker" "pass" "$(docker --version 2>/dev/null)"
else
  check "Docker" "warn" "Not installed"
fi

echo ""

# ── 9. Memory & Storage ────────────────────────────────────
echo "── Resources ──"
TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
check "Total Memory" "pass" "${TOTAL_MEM}GB"

DISK_FREE=$(df -h / | awk 'NR==2{print $4}')
check "Root Disk Free" "pass" "$DISK_FREE"

echo ""

# ── 10. DGX OS Info ─────────────────────────────────────────
echo "── OS Details ──"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  check "OS" "pass" "$PRETTY_NAME"
fi
check "Kernel" "pass" "$(uname -r)"

echo ""

# ── Summary ─────────────────────────────────────────────────
echo "════════════════════════════════════════════════"
echo "Results: $PASS passed, $WARN warnings, $FAIL failed"
echo "════════════════════════════════════════════════"

if [ $FAIL -eq 0 ] && [ $WARN -le 3 ]; then
  echo ""
  echo "VERDICT: cuVS aarch64 build looks FEASIBLE"
  echo ""
  echo "Next steps:"
  echo "  1. Install any missing build tools (JDK 22, cmake, maven)"
  echo "  2. Install libcuvs via conda (if aarch64 packages available)"
  echo "     OR build from source"
  echo "  3. Build libcuvs_java.so + patched JAR"
  echo "  4. Test with Elasticsearch"
elif [ $FAIL -eq 0 ]; then
  echo ""
  echo "VERDICT: LIKELY FEASIBLE but several dependencies need installing"
else
  echo ""
  echo "VERDICT: BLOCKERS FOUND — review failed checks above"
fi
