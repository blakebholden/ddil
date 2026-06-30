# Edge Federation (CCS) — Setup

**Adventure 4 — Edge Federation.** An Elastic Cloud Hosted (ECH) cluster in AWS
adds the DDIL box as a **remote cluster** and runs cross-cluster search down into
it. "Synchronise Now" registers that remote over the uplink; the federated result
set expands from cloud-only → cloud + edge.

> Why ECH and not Serverless: Elasticsearch **Serverless cannot CCS into a
> self-managed cluster** (its federation is Cross-Project Search, Serverless↔
> Serverless only). Real CCS into the box needs a **stateful** coordinating
> cluster — ECH or self-managed.

Roles:
- **ECH cluster (AWS)** — coordinating/querying cluster; runs the search.
- **DDIL box (`192.168.1.20:9200`)** — the **remote** (`edge`); holds edge data.
- **App backend (on the box)** — orchestrates ECH over the uplink via `/api/ccs/*`.

**Two-device demo:**
- **HQ console** (`demo/hq-console/`, a CesiumJS globe) — runs on a laptop; the
  *querying* side. **Synchronise Now** registers the edge remote + runs CCS; the
  globe lights up the edge node + arc and the count expands. See its README.
- **iPad** — runs the kit's main frontend, **Edge Federation** card → the **Edge
  Collection** scene: field reports collected + embedded on the Spark
  (`POST /api/ccs/collect`), writing the edge `field-reports` index that HQ
  federates into. So edge docs can be generated live during the demo instead of
  (or in addition to) the seed script.

## 1. Seed the demo index (`field-reports`) on BOTH clusters

```bash
cd demo/scripts/ccs
# cloud docs on ECH
ES_URL="https://<deployment>.es...:443" AK="<ech-api-key>" ORIGIN=cloud N=40 bash seed-field-reports.sh
# edge docs on the box
ES_URL="http://192.168.1.20:9200" EP="<es-password>" ORIGIN=edge N=33 bash seed-field-reports.sh
```
(The live ECH cluster has already been seeded with 40 cloud docs during build.)

## 2. Make the box reachable as a remote cluster from ECH

CCS connects the **coordinator (ECH) → remote (box)**, so the box's
remote-cluster interface must be reachable from ECH during the uplink. Use
**API-key based remote clusters (RCS 2.0)**:

1. **On the box**, enable the remote cluster server and expose it:
   - `remote_cluster_server.enabled: true` + a `remote_cluster.port` (9443).
   - During the uplink, publish that port to a host ECH can reach — a reverse
     proxy / tunnel (e.g. cloudflared, SSH `-R`, or a UniFi WAN forward). The
     reachable address is your `CCS_BOX_PROXY` (`<host>:9443`).
2. **On the box**, mint a **cross-cluster API key** scoped to `field-reports`
   (Kibana → Security → API keys → cross-cluster, or `POST /_security/cross_cluster/api_key`).
3. **On ECH**, store that key in the keystore for the remote and trust the box's
   CA: `cluster.remote.edge.credentials` (via the Cloud console "Remote clusters"
   UI is easiest, or the keystore API). This establishes trust **once**.

After trust is established, the live connect/disconnect is just the
`proxy_address` + `mode` setting — which is what the **Synchronise Now** button
toggles (`POST /api/ccs/synchronise` → `PUT _cluster/settings`).

## 3. Point the backend at ECH

In the gitignored `demo/backend/.env` (NOT `.env.airgapped`):
```
VINEYARD_ECH_ES_URL=https://<deployment>.es...:443
VINEYARD_ECH_API_KEY=<ech-api-key>
VINEYARD_CCS_REMOTE_ALIAS=edge
VINEYARD_CCS_BOX_PROXY=<box-proxy-host>:9443
VINEYARD_CCS_INDEX=field-reports
```
Restart the backend. Verify (validated against the live ECH cluster during build):
```bash
curl -s localhost:8000/api/ccs/status              # connected:false until synced
curl -s 'localhost:8000/api/ccs/search?scope=federated' | python3 -m json.tool
#   → degrades to cloud-only (edge_registered:false) until Synchronise Now
```

## 4. Demo flow (two devices)

1. **iPad** — open **Edge Federation** → **Begin collection**. Field reports
   stream in, each embedded on the Spark (768-d) into the edge `field-reports`
   index. The header shows **Airgapped · collecting locally**.
2. **HQ console (laptop globe)** — HQ online, edge **offline** (gray, no arc).
   A search shows **cloud-only** results.
3. Hit **Synchronise Now** on the globe → the backend registers `edge` on ECH;
   the edge marker animates gray → **orange (connecting)** → **green (online)**,
   the cyan arc appears, and the count jumps **cloud → cloud + edge** (the iPad's
   collected docs are now visible to HQ).
4. The iPad header flips to **HQ federated · streaming to command**.
5. **Disconnect edge** on the globe removes the remote; the arc + edge docs drop.

## Notes

- `/api/ccs/search` checks `_remote/info` and only spans `edge:field-reports`
  when the remote is registered, so it never throws `no_such_remote_cluster`.
- For a **no-uplink** dry run (e.g. on a plane), you can register a second local
  ES as the `edge` remote to rehearse the reveal without the real box endpoint.
- `ccs_minimize_roundtrips=true` keeps the federated query fast over a
  high-latency uplink.
