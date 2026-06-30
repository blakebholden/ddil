# Edge Federation (CCS) — Setup

**Adventure 4 — Edge Federation.** The **DDIL box is the CCS coordinator**: it
dials *out* to an Elastic Cloud Hosted (ECH) deployment and adds it as a remote
cluster named `cloud`. **"Synchronise Now"** brings that link up; a federated
search then spans the box's edge index **+** ECH's cloud index, so results expand
**edge → edge + cloud** — the sovereign kit pulling cloud context on demand.

> Direction matters: **box → ECH is outbound-only**, so no inbound-to-box
> networking, tunnels, or custom certs. (Serverless can't be a CCS remote at all;
> ECH/stateful can.) The on-screen reveal is identical to "cloud queries edge".

Roles:
- **DDIL box** (`192.168.1.20:9200`) — coordinator; holds the edge `field-reports`.
- **ECH deployment** — remote `cloud`; holds the cloud `field-reports`.
- **Backend** (on the box) — runs the CCS via `/api/ccs/*` against the box ES.
- **iPad** — kit frontend → Edge Federation → **Edge Collection** (collects +
  embeds field reports into the box's index live).
- **HQ globe** (`demo/hq-console/`) — the command view; Synchronise Now + reveal.

## 1. Seed the cloud index on ECH

```bash
cd demo/scripts/ccs
ES_URL="https://<deployment>.es...:443" AK="<ech-api-key>" ORIGIN=cloud N=40 bash seed-field-reports.sh
```
(Already done on the live ECH cluster: 40 cloud docs.)

## 2. Get edge data into the box

Either collect live on the iPad (Edge Federation → **Begin collection**), or:
```bash
ES_URL="http://192.168.1.20:9200" EP="<es-password>" ORIGIN=edge N=33 bash seed-field-reports.sh
```

## 3. Connect the box to ECH as remote `cloud` (one-time trust)

RCS 2.0 (API-key based), all **outbound from the box**:

1. **On ECH**, get the deployment's **remote cluster** connection info — its
   **proxy address** (e.g. `<id>.<region>.aws.elastic-cloud.com:9400`) and
   **server name** (Elastic Cloud console → the deployment → *Security →
   Remote connections* / "remote cluster parameters").
2. **On ECH**, create a **cross-cluster API key** scoped to `field-reports`:
   ```
   POST /_security/cross_cluster/api_key
   { "name": "ddil-edge", "search": [ { "names": ["field-reports"] } ] }
   ```
   Copy the `encoded` value.
3. **On the box**, load that key into the ES keystore and reload:
   ```bash
   # inside the ES container/node:
   bin/elasticsearch-keystore add cluster.remote.cloud.credentials   # paste the encoded key
   # then, via the REST API:
   POST /_nodes/reload_secure_settings
   ```
4. **Backend env** (gitignored `demo/backend/.env`):
   ```
   VINEYARD_CCS_CLOUD_PROXY=<id>.<region>.aws.elastic-cloud.com:9400
   VINEYARD_CCS_CLOUD_SERVER_NAME=<server-name-from-step-1>
   VINEYARD_CCS_EDGE_ES_URL=http://192.168.1.20:9200   # the box (coordinator); or rely on es_gpu_url
   VINEYARD_ECH_ES_URL=https://<deployment>.es...:443   # REST, for seeding only
   VINEYARD_ECH_API_KEY=<ech-api-key>
   ```

The credential lives in the keystore (trust established once). **Synchronise
Now** only sets `cluster.remote.cloud.{mode,proxy_address,server_name}` to bring
the link up; **Disconnect** clears it.

## 4. Run + verify

```bash
curl -s localhost:8001/api/ccs/state                       # coordinator=box, cloud_proxy set
curl -s 'localhost:8001/api/ccs/search?scope=federated'    # edge-only until synced (cloud_registered:false)
curl -s -XPOST localhost:8001/api/ccs/synchronise          # box registers ECH remote
curl -s 'localhost:8001/api/ccs/search?scope=federated'    # now edge + cloud
```

## 5. Demo flow (two devices)

1. **iPad** — Edge Federation → **Begin collection**: field reports stream in,
   embedded on the Spark, into the box's `field-reports`. Header: *Airgapped*.
2. **HQ globe (laptop)** — `cd demo/hq-console && VITE_API_URL=http://<box>:8001 npm run dev`.
   The **Sovereign Edge** node is green; **Elastic Cloud** is gray (offline). A
   search shows **edge-only**.
3. Hit **Synchronise Now** → the box connects out to ECH; the Cloud node animates
   gray → orange → green, the arc appears, and the count jumps **edge → edge + cloud**.
4. iPad header flips to *HQ federated · streaming to command*.
5. **Disconnect cloud** drops the remote; results fall back to edge-only.

## Mac-local rehearsal (no kit needed)

Because the coordinator only needs **outbound** to ECH, you can run the whole
thing on a laptop:
```bash
# 1. a local single-node ES as the "box":
docker run -d --name ddil-edge -p 9200:9200 \
  -e discovery.type=single-node -e xpack.security.enabled=false \
  docker.elastic.co/elasticsearch/elasticsearch:9.4.2
# 2. seed edge docs + add the cloud keystore cred + reload (steps 2–3 above, against localhost:9200)
# 3. backend: VINEYARD_CCS_EDGE_ES_URL=http://localhost:9200 + the CCS_CLOUD_* env, run uvicorn :8001
# 4. globe: VITE_API_URL=http://localhost:8001 npm run dev  → Synchronise Now federates to your live ECH
```

## Notes
- `/api/ccs/search` checks `_remote/info` and only spans `cloud:field-reports`
  when registered, so it never throws `no_such_remote_cluster`.
- `ccs_minimize_roundtrips=true` keeps the federated query fast over the uplink.
- ECH creds stay in the gitignored `.env`; `.env.airgapped` has placeholders.
