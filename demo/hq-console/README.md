# DDIL HQ Console (CesiumJS globe)

The **command/HQ** half of the Edge Federation demo. Runs on a separate device
(a laptop/screen at the demo), NOT on the iPad. A CesiumJS globe shows two nodes
— **HQ (Elastic Cloud)** and the **Forward Edge Node (the DDIL kit)** — and a
**Synchronise Now** button that registers the edge as a remote cluster on ECH
and runs cross-cluster search down into it. The result set expands cloud → cloud
+ edge, and the globe's edge marker + connection arc light up.

The iPad runs the kit's main frontend showing the **Edge Collection** scene (the
`ccs` adventure): field reports being collected + embedded on the Spark, writing
the very index this console federates into.

Adopted from `~/Desktop/CCS/elastic-cross-cluster-demo/client` — the
`CesiumGlobe.tsx` component and Cesium build setup are reused; the mock 10-node
IC narrative and demo-mode chooser were replaced with two live nodes wired to
the kit backend's `/api/ccs/*`.

## Architecture

```
HQ Console (this app, on a laptop)
  → /api/ccs/* (proxied to the DDIL kit backend)
      → ECH cluster (synchronise = register edge remote; search = CCS)
            └── edge: → the DDIL box ES (field-reports, collected on the iPad)
```

## Run

```bash
cd demo/hq-console
npm install                      # pulls cesium + vite-plugin-cesium (needs network once)
VITE_API_URL=http://<kit-backend-host>:8001 npm run dev   # → http://localhost:5180
```

- `VITE_API_URL` points the `/api` proxy at the kit's backend (the box). Default
  `http://localhost:8001`.
- `VITE_CESIUM_ION_TOKEN` (optional) for Cesium World Imagery. Leave empty for
  the offline/default imagery — appropriate for an airgapped kit.
- `vite-plugin-cesium` handles all Cesium static assets automatically.

## Demo flow

1. Globe shows **HQ online**, **Edge offline** (gray marker, no arc).
2. The iPad collects field reports (edge index grows).
3. Hit **Synchronise Now** → edge marker goes gray → **orange (connecting)** →
   **green (online)**, the cyan arc appears, and the count jumps from cloud-only
   to cloud + edge.
4. **Disconnect edge** removes the remote; the arc + edge docs drop away.

## Wiring notes (the seams changed from the source app)

- `src/services/api.ts` — replaces the old axios `elasticsearch.ts`; two calls:
  `POST /api/ccs/synchronise`, `GET /api/ccs/search?scope=federated` (+ state/status).
- `src/App.tsx` — lean 2-node orchestration (the source's 775-line mock app was
  not carried over); the OFFLINE→CONNECTING→ONLINE reveal is driven by the real
  backend calls.
- `src/components/CesiumGlobe.tsx` — kept from source, with three fixes: Ion
  token from env (not a committed JWT); `billboard.color` now actually applied
  (status tint shows); the HQ hub id is `hq` and the connection arc only draws
  when the edge is non-offline, tinted by its state.

Backend prerequisites + the remote-cluster/trust networking are in
`demo/scripts/ccs/CCS-SETUP.md`.
