import { useEffect, useState } from 'react'
import { CesiumGlobe } from './components/CesiumGlobe'
import type { Cluster } from './types'
import {
  ccsState, ccsStatus, ccsSearch, ccsSynchronise, ccsDisconnect,
  type CcsSearch,
} from './services/api'
import './App.css'

// The kit/edge is the always-on COORDINATOR (and the globe's connection hub, so
// its id must be 'hq' — CesiumGlobe draws arcs from that id). The cloud is the
// REMOTE that comes online when the box synchronises out to ECH.
const EDGE: Cluster = {
  id: 'hq', // hub id for the connection arc
  name: 'Sovereign Edge — DDIL Kit',
  region: 'CENTCOM',
  type: 'eck',
  status: 'online',
  endpoint: 'edge',
  geo: { lat: 33.31, lon: 44.36, regionName: 'Forward Operating Edge' },
}

const CLOUD: Cluster = {
  id: 'cloud',
  name: 'Elastic Cloud — HQ (us-east-1)',
  region: 'CONUS',
  type: 'cloud',
  status: 'offline',
  endpoint: 'cloud',
  geo: { lat: 38.95, lon: -77.45, regionName: 'N. Virginia' },
}

type Phase = 'offline' | 'connecting' | 'online'

export default function App() {
  const [cloudPhase, setCloudPhase] = useState<Phase>('offline')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CcsSearch | null>(null)
  const [echUrl, setEchUrl] = useState<string>('')
  const [selected, setSelected] = useState<string | null>(null)

  const clusters: Cluster[] = [EDGE, { ...CLOUD, status: cloudPhase }]

  // initial load: config, current remote status, baseline search
  useEffect(() => {
    ccsState().then((s) => setEchUrl(s.ech_url)).catch(() => {})
    ccsStatus().then((s) => setCloudPhase(s.connected ? 'online' : 'offline')).catch(() => {})
    ccsSearch('federated').then(setResult).catch(() => {})
  }, [])

  const synchronise = async () => {
    setBusy(true)
    setCloudPhase('connecting')
    try {
      // keep CONNECTING visible for a beat, then the box registers ECH as remote
      const [sync] = await Promise.all([
        ccsSynchronise(),
        new Promise((r) => setTimeout(r, 1400)),
      ])
      setCloudPhase(sync.connected ? 'online' : 'connecting')
      setResult(await ccsSearch('federated'))
    } catch {
      setCloudPhase('offline')
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    try {
      await ccsDisconnect()
      setCloudPhase('offline')
      setResult(await ccsSearch('local'))
    } finally {
      setBusy(false)
    }
  }

  const online = cloudPhase === 'online'

  return (
    <div className="hq-root">
      <CesiumGlobe clusters={clusters} selectedCluster={selected} onClusterClick={(c) => setSelected(c.id)} />

      {/* Top bar */}
      <div className="hq-topbar">
        <div className="hq-brand">SOVEREIGN AI · EDGE COMMAND</div>
        <div className="hq-title">Cross-Cluster Search · the sovereign edge federates to cloud on demand</div>
        {echUrl && <div className="hq-ech">{echUrl.replace(/^https?:\/\//, '').slice(0, 48)}</div>}
      </div>

      {/* Node status panel */}
      <div className="hq-panel">
        <NodeRow name="Sovereign Edge · DDIL Kit" sub="coordinating cluster" state="online" />
        <NodeRow name="Elastic Cloud · HQ" sub={`remote "cloud" · ${cloudPhase}`} state={cloudPhase} />
      </div>

      {/* Bottom control + reveal */}
      <div className="hq-control">
        {result && (
          <div className="hq-counts">
            <Count label="Edge" value={result.counts.edge} cls="edge" />
            <span className="hq-op">+</span>
            <Count label="Cloud" value={result.counts.cloud} cls={online ? 'cloud' : 'dim'} />
            <span className="hq-op">=</span>
            <Count label="Visible" value={result.total} cls="total" big />
          </div>
        )}
        {!online ? (
          <button className="hq-sync" disabled={busy} onClick={synchronise}>
            {busy ? 'Establishing uplink…' : 'Synchronise Now'}
          </button>
        ) : (
          <button className="hq-disc" disabled={busy} onClick={disconnect}>Disconnect cloud</button>
        )}
      </div>
    </div>
  )
}

function NodeRow({ name, sub, state }: { name: string; sub: string; state: Phase }) {
  const dot = state === 'online' ? '#34d399' : state === 'connecting' ? '#fbbf24' : '#64748b'
  return (
    <div className="hq-node">
      <span className="hq-dot" style={{ background: dot }} />
      <div>
        <div className="hq-node-name">{name}</div>
        <div className="hq-node-sub">{sub}</div>
      </div>
    </div>
  )
}

function Count({ label, value, cls, big }: { label: string; value: number; cls: string; big?: boolean }) {
  return (
    <div className={`hq-count ${cls}`}>
      <div className={big ? 'hq-count-v big' : 'hq-count-v'}>{value.toLocaleString()}</div>
      <div className="hq-count-l">{label}</div>
    </div>
  )
}
