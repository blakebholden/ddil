import { useEffect, useState } from 'react'
import { CesiumGlobe } from './components/CesiumGlobe'
import type { Cluster } from './types'
import {
  ccsState, ccsStatus, ccsSearch, ccsSynchronise, ccsDisconnect,
  type CcsSearch,
} from './services/api'
import './App.css'

const HQ: Cluster = {
  id: 'hq',
  name: 'HQ — Elastic Cloud (us-east-1)',
  region: 'CONUS',
  type: 'cloud',
  status: 'online',
  endpoint: 'cloud',
  geo: { lat: 38.95, lon: -77.45, regionName: 'N. Virginia' },
}

const EDGE: Cluster = {
  id: 'edge',
  name: 'Forward Edge Node — DDIL Kit',
  region: 'CENTCOM',
  type: 'eck',
  status: 'offline',
  endpoint: 'edge',
  geo: { lat: 33.31, lon: 44.36, regionName: 'Forward Operating Edge' },
}

type Phase = 'offline' | 'connecting' | 'online'

export default function App() {
  const [edgePhase, setEdgePhase] = useState<Phase>('offline')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CcsSearch | null>(null)
  const [echUrl, setEchUrl] = useState<string>('')
  const [selected, setSelected] = useState<string | null>(null)

  const clusters: Cluster[] = [HQ, { ...EDGE, status: edgePhase }]

  // initial load: config, current remote status, baseline search
  useEffect(() => {
    ccsState().then((s) => setEchUrl(s.ech_url)).catch(() => {})
    ccsStatus().then((s) => setEdgePhase(s.connected ? 'online' : 'offline')).catch(() => {})
    ccsSearch('federated').then(setResult).catch(() => {})
  }, [])

  const synchronise = async () => {
    setBusy(true)
    setEdgePhase('connecting')
    try {
      // keep CONNECTING visible for a beat, then register the remote on ECH
      const [sync] = await Promise.all([
        ccsSynchronise(),
        new Promise((r) => setTimeout(r, 1400)),
      ])
      setEdgePhase(sync.connected ? 'online' : 'connecting')
      setResult(await ccsSearch('federated'))
    } catch {
      setEdgePhase('offline')
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    try {
      await ccsDisconnect()
      setEdgePhase('offline')
      setResult(await ccsSearch('local'))
    } finally {
      setBusy(false)
    }
  }

  const online = edgePhase === 'online'

  return (
    <div className="hq-root">
      <CesiumGlobe clusters={clusters} selectedCluster={selected} onClusterClick={(c) => setSelected(c.id)} />

      {/* Top bar */}
      <div className="hq-topbar">
        <div className="hq-brand">SOVEREIGN AI · HQ COMMAND</div>
        <div className="hq-title">Cross-Cluster Search · query the edge from the cloud</div>
        {echUrl && <div className="hq-ech">{echUrl.replace(/^https?:\/\//, '').slice(0, 48)}</div>}
      </div>

      {/* Node status panel */}
      <div className="hq-panel">
        <NodeRow name="HQ · Elastic Cloud" sub="coordinating cluster" state="online" />
        <NodeRow name="Forward Edge · DDIL Kit" sub={`remote "edge" · ${edgePhase}`} state={edgePhase} />
      </div>

      {/* Bottom control + reveal */}
      <div className="hq-control">
        {result && (
          <div className="hq-counts">
            <Count label="Cloud" value={result.counts.cloud} cls="cloud" />
            <span className="hq-op">+</span>
            <Count label="Edge" value={result.counts.edge} cls={online ? 'edge' : 'dim'} />
            <span className="hq-op">=</span>
            <Count label="Visible" value={result.total} cls="total" big />
          </div>
        )}
        {!online ? (
          <button className="hq-sync" disabled={busy} onClick={synchronise}>
            {busy ? 'Establishing uplink…' : 'Synchronise Now'}
          </button>
        ) : (
          <button className="hq-disc" disabled={busy} onClick={disconnect}>Disconnect edge</button>
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
