# Building cuVS-Java for aarch64 (DGX Spark)

> **Status:** Feasible. The x86_64 restriction is a soft gate — platform checks + hardcoded paths, not a fundamental architectural limitation. The underlying cuVS C/C++ library already supports aarch64.

---

## The Problem: 3 Soft Gates

There are exactly **3 places** where x86_64 is hardcoded. None are fundamental — they're all gatekeeping code that assumes only x86_64 has been tested.

### Gate 1: `CuVSServiceProvider.java` — Platform Check

**File:** `java/cuvs-java/src/main/java/com/nvidia/cuvs/spi/CuVSServiceProvider.java:47,63-65`

```java
static CuVSProvider builtinProvider() {
  if (Runtime.version().feature() > 21 && isLinuxAmd64()) {  // ← GATE
    // ... loads JDKProvider (the real implementation)
  }
  return new UnsupportedProvider();  // ← Falls through to "throw UnsupportedOperationException"
}

static boolean isLinuxAmd64() {
  String name = System.getProperty("os.name");
  return (name.startsWith("Linux")) && System.getProperty("os.arch").equals("amd64");  // ← HARDCODED
}
```

**Fix:** Change `isLinuxAmd64()` to also accept `aarch64`:
```java
static boolean isSupportedPlatform() {
  String name = System.getProperty("os.name");
  String arch = System.getProperty("os.arch");
  return name.startsWith("Linux") && (arch.equals("amd64") || arch.equals("aarch64"));
}
```

### Gate 2: `LoaderUtils.java` — Native Library Path

**File:** `java/cuvs-java/src/main/java22/com/nvidia/cuvs/internal/common/LoaderUtils.java:52`

```java
return loadLibraryFromJar("/META-INF/native/linux_x64/libcuvs_java.so");  // ← HARDCODED PATH
```

**Fix:** Either:
- **Option A (env var bypass):** Set `CUVS_JAVA_SO_PATH=/path/to/libcuvs_java.so` — this is checked FIRST (line 39) and completely bypasses the JAR lookup. **This requires zero code changes.**
- **Option B (code change):** Add arch detection:
  ```java
  String arch = System.getProperty("os.arch").equals("aarch64") ? "linux_aarch64" : "linux_x64";
  return loadLibraryFromJar("/META-INF/native/" + arch + "/libcuvs_java.so");
  ```

### Gate 3: `pom.xml` — Native .so Packaging Path

**File:** `java/cuvs-java/pom.xml:180`

```xml
<outputDirectory>${project.build.directory}/classes/META-INF/native/linux_x64</outputDirectory>
```

**Fix:** Change to `linux_aarch64` when building on ARM, or package both.

### Gate 3b: `generate-bindings.sh` — CUDA Include Path

**File:** `java/panama-bindings/generate-bindings.sh:11`

```bash
TARGET_DIR="targets/x86_64-linux/include"
```

**Fix:** Detect arch:
```bash
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ]; then
  TARGET_DIR="targets/sbsa-linux/include"
else
  TARGET_DIR="targets/x86_64-linux/include"
fi
```

Also, the jextract download is x86_64 only — need an aarch64 build or generate bindings on x86 first.

---

## Two Approaches

### Approach A: Minimal — Use CUVS_JAVA_SO_PATH (Fastest)

This bypasses Gate 2 entirely and only requires fixing Gate 1:

1. **Build libcuvs C/C++ natively on DGX Spark** (already supported by RAPIDS)
2. **Build `libcuvs_java.so` natively on DGX Spark** (it's plain C, links to libcuvs)
3. **Generate Panama bindings on an x86 machine** (or use pre-generated from repo)
4. **Patch `CuVSServiceProvider.java`** to accept `aarch64` (one line change)
5. **Build the Java JAR** with Maven
6. **Set `CUVS_JAVA_SO_PATH`** to point to the natively-built `libcuvs_java.so`

### Approach B: Full Rebuild — Package Everything Properly

1. Build the entire cuVS stack from source on DGX Spark
2. Patch all 3 gates
3. Build cuvs-java JAR with aarch64 native lib embedded
4. Use the resulting JAR as a drop-in replacement for the x86_64 version in ES

---

## Step-by-Step: Approach A (on DGX Spark)

### Prerequisites on DGX Spark

The DGX Spark should already have most of these:

```bash
# Verify what's available
nvcc --version          # CUDA toolkit
cmake --version         # CMake 3.30+
java -version          # Need JDK 22+
mvn --version          # Maven 3.9.6+
```

### Step 1: Install Build Dependencies

```bash
# Install conda/mamba (if not present) for RAPIDS dependencies
curl -L -O https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-aarch64.sh
bash Miniforge3-Linux-aarch64.sh

# Create build environment
conda create -n cuvs-build -c conda-forge -c nvidia -c rapidsai \
  libcuvs cuda-toolkit=12 cmake ninja openblas openmp \
  python=3.12

conda activate cuvs-build

# Install JDK 22+ (if not present)
# Option: SDKMAN
curl -s "https://get.sdkman.io" | bash
sdk install java 22.0.2-open

# Install Maven
sdk install maven
```

### Step 2: Build libcuvs (C/C++ library)

```bash
git clone --branch branch-25.06 https://github.com/rapidsai/cuvs.git
cd cuvs

# Build just the C API (what Java needs)
./build.sh libcuvs --build-type Release

# Verify the built library
ls cpp/build/libcuvs*.so
ls cpp/build/libcuvs_c*.so
```

### Step 3: Build libcuvs_java.so (JNI/native wrapper)

```bash
cd java

# Set CMAKE_PREFIX_PATH to find the built libcuvs
export CMAKE_PREFIX_PATH=$(pwd)/../cpp/build

# Build the native wrapper
cmake -B ./internal/build -S ./internal
cmake --build ./internal/build

# Verify
ls ./internal/build/libcuvs_java.so
file ./internal/build/libcuvs_java.so
# Should show: ELF 64-bit LSB shared object, ARM aarch64
```

### Step 4: Patch CuVSServiceProvider.java

```bash
# One-line fix
sed -i 's/System.getProperty("os.arch").equals("amd64")/\
(System.getProperty("os.arch").equals("amd64") || System.getProperty("os.arch").equals("aarch64"))/' \
  cuvs-java/src/main/java/com/nvidia/cuvs/spi/CuVSServiceProvider.java
```

### Step 5: Generate Panama Bindings (or reuse existing)

The Panama bindings are generated Java source code — they're architecture-independent. If they're already in the repo (checked into `src/main/java22/`), skip this step.

```bash
# Check if bindings already exist
ls cuvs-java/src/main/java22/com/nvidia/cuvs/internal/panama/

# If they exist, skip generate-bindings.sh
# If not, you need to either:
#   a) Run generate-bindings.sh on an x86 machine and copy the generated files
#   b) Fix the script for aarch64 (see Gate 3b above)
```

### Step 6: Build Java JAR

```bash
# Install the native .so into local Maven
mvn install:install-file \
  -DgroupId=com.nvidia.cuvs \
  -DartifactId=cuvs-java-internal \
  -Dversion=25.06.0 \
  -Dpackaging=so \
  -Dfile=./internal/build/libcuvs_java.so

# Fix pom.xml to package for aarch64
sed -i 's|META-INF/native/linux_x64|META-INF/native/linux_aarch64|' \
  cuvs-java/pom.xml

# Build the JAR
cd cuvs-java
mvn verify -DskipTests
mvn install:install-file \
  -Dfile=./target/cuvs-java-25.06.0-jar-with-dependencies.jar \
  -DgroupId=com.nvidia.cuvs \
  -DartifactId=cuvs-java \
  -Dversion=25.06.0 \
  -Dpackaging=jar

# The JAR is at: ./target/cuvs-java-25.06.0-jar-with-dependencies.jar
```

### Step 7: Use with Elasticsearch

**Option A: CUVS_JAVA_SO_PATH (easiest)**

The Elasticsearch GPU plugin loads cuvs-java, which checks `CUVS_JAVA_SO_PATH` first. Set this in the ES startup environment:

```bash
# In elasticsearch.yml or via environment
export CUVS_JAVA_SO_PATH=/path/to/libcuvs_java.so
export LD_LIBRARY_PATH=/path/to/cuvs/lib:/usr/local/cuda/lib64:$LD_LIBRARY_PATH
```

**Option B: Replace the JAR in the ES plugin directory**

Replace the bundled `cuvs-java-25.12.0.jar` (x86_64) with the aarch64-built version in the ES plugin directory.

```bash
# Find the existing JAR
find /usr/share/elasticsearch -name "cuvs-java*.jar"

# Replace with aarch64 build
cp cuvs-java-25.06.0-jar-with-dependencies.jar \
  /usr/share/elasticsearch/modules/x-pack-gpu/cuvs-java-25.12.0.jar
```

**Note:** Version mismatch (25.06 vs 25.12) may cause issues. You may need to build from the `branch-25.12` tag to match ES 9.3's expected version.

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| cuVS C++ build fails on DGX Spark | Low | RAPIDS publishes aarch64 conda packages, so it's tested |
| Panama FFI bindings incompatible on aarch64 | Low | Panama FFI is architecture-independent at the Java source level |
| Blackwell GPU compute capability not recognized | Medium | cuVS may need updates for sm_121 (Blackwell). Test with `nvidia-smi` |
| Version mismatch (cuvs-java 25.06 vs ES expecting 25.12) | Medium | Build from matching branch, or test for compatibility |
| Performance differences on unified memory architecture | Low | Should actually be faster — no PCIe transfer overhead |
| ES GPU plugin has additional platform checks beyond cuvs-java | Low | `GPUSupport.java` only catches exceptions, doesn't check arch |

---

## Testing Plan

1. Build `libcuvs_java.so` on DGX Spark — verify with `file` command shows aarch64
2. Run cuVS Java examples (CAGRA, HNSW) standalone — verify GPU acceleration works
3. Start ES with modified JAR + `CUVS_JAVA_SO_PATH` — check logs for GPU detection
4. Create index with `vectors.indexing.use_gpu: true` — verify index creation succeeds
5. Index a small batch of vectors — verify GPU utilization in `nvidia-smi`
6. Compare indexing speed: GPU-enabled vs `vectors.indexing.use_gpu: false`

---

## Timeline Estimate

| Task | Time |
|------|------|
| Set up build environment on DGX Spark | 1-2 hours |
| Build libcuvs from source | 30-60 min (compile time) |
| Build libcuvs_java.so | 10 min |
| Patch + build Java JAR | 30 min |
| Integrate with ES + test | 1-2 hours |
| **Total** | **~4-5 hours** |
