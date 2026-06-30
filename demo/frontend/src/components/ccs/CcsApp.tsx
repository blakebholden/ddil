import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, HardDrive, Cpu, Play, Pause, X, Wifi, WifiOff, CheckCircle2, Loader2 } from "lucide-react";
import { useEdgeStats, useCcsStatus, collect, type CollectResult } from "./api";

interface Props { onExit?: () => void; }

// Field-report templates "collected" at the edge. Each is embedded on the Spark
// and written to the box's index — the same index HQ federates into via CCS.
const TEMPLATES: { title: string; text: string; region: string; classification: string }[] = [
  { title: "Perimeter motion — Grid 4C", text: "RS485 perimeter sensor tripped at grid 4C, 0312Z. Thermal signature consistent with a single dismounted individual moving north-east along the treeline.", region: "CENTCOM", classification: "CUI" },
  { title: "RF emitter geolocated", text: "Wideband SDR captured an intermittent 433 MHz emitter. Bearing lines from two edge nodes cross near the eastern wadi; likely a commercial telemetry link.", region: "CENTCOM", classification: "C" },
  { title: "UAV track acquired", text: "Edge camera array detected a small fixed-wing UAV at low altitude, loitering over the supply route for 6 minutes before egressing west.", region: "EUCOM", classification: "C" },
  { title: "Soil/moisture anomaly — Sector 7", text: "Buried probe reports a sudden moisture spike inconsistent with weather. Possible recent ground disturbance; flagged for IMINT cross-cue.", region: "AFRICOM", classification: "U" },
  { title: "Convoy movement — Route Blue", text: "Roadside acoustic sensor logged six heavy-vehicle passes northbound between 0140Z and 0205Z. Pattern matches a resupply cadence.", region: "INDOPACOM", classification: "CUI" },
  { title: "Maritime contact — littoral", text: "Coastal edge node tracked a small craft hugging the shoreline, no AIS. Speed and heading logged; handed to the regional picture.", region: "INDOPACOM", classification: "C" },
  { title: "Power-grid telemetry drop", text: "Edge collector lost SCADA telemetry from substation 12 for 40s. Brief, but the third occurrence this week — trending for the analyst.", region: "CONUS", classification: "U" },
  { title: "Cellular density surge", text: "Passive RF survey shows an abnormal cluster of handset activity in an otherwise quiet sector after dark. Geofenced and time-stamped.", region: "EUCOM", classification: "CUI" },
  { title: "Seismic micro-event", text: "Geophone array registered a shallow micro-event with a man-made waveform signature; not tectonic. Logged with sensor confidence.", region: "AFRICOM", classification: "C" },
  { title: "Chemical sniffer alert", text: "Edge MASINT sniffer flagged trace VOCs above baseline near the depot fenceline. Auto-sampled; awaiting confirmation pass.", region: "CENTCOM", classification: "CUI" },
];

export function CcsApp({ onExit }: Props) {
  const { stats, refresh } = useEdgeStats(10000);
  const { status } = useCcsStatus(5000);
  const [running, setRunning] = useState(false);
  const [feed, setFeed] = useState<(CollectResult & { embedding: boolean })[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const seq = useRef(0);

  const hqConnected = Boolean(status?.connected);

  const collectOne = async () => {
    const t = TEMPLATES[seq.current % TEMPLATES.length];
    seq.current += 1;
    setPending(t.title);
    try {
      const res = await collect(t);
      setFeed((f) => [{ ...res, embedding: false }, ...f].slice(0, 12));
      refresh();
    } catch {
      /* box/embedder offline — skip */
    } finally {
      setPending(null);
    }
  };

  useEffect(() => {
    if (running) {
      collectOne();
      timer.current = setInterval(collectOne, 3000);
    } else if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onExit?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-slate-800/60">
        <div className="flex items-center gap-4">
          {onExit && (
            <button onClick={onExit} title="Back to chooser (Esc)" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors">
              <X size={14} /> Exit
            </button>
          )}
          <div className="flex items-center gap-2">
            <HardDrive size={20} className="text-cyan-400" />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-400">Sovereign AI · Edge Node</div>
              <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Field Collection · embedded on the Spark</h1>
            </div>
          </div>
        </div>
        {/* HQ link status — flips when the HQ console runs Synchronise Now */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ring-1 ${hqConnected ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" : "bg-slate-800/60 text-slate-400 ring-slate-700/50"}`}>
          {hqConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
          {hqConnected ? "HQ federated · streaming to command" : "Airgapped · collecting locally"}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-8 max-w-5xl mx-auto w-full">
        {/* Stats row */}
        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 mb-6">
          <Stat icon={<HardDrive size={20} className="text-cyan-300" />} value={stats?.count ?? 0} label="reports collected & indexed" />
          <Stat icon={<Cpu size={20} className="text-emerald-300" />} value={stats?.embed_dims ?? 768} label="dim vectors (nomic, on Spark)" suffix="-d" />
          <button
            onClick={() => setRunning((r) => !r)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-colors ${running ? "bg-slate-800 hover:bg-slate-700 text-slate-200" : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"}`}
          >
            {running ? <><Pause size={16} /> Pause collection</> : <><Play size={16} /> Begin collection</>}
          </button>
        </div>

        {/* Region breakdown */}
        {stats && stats.regions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">By region:</span>
            {stats.regions.map((r) => (
              <span key={r.key} className="text-[11px] px-2 py-1 rounded-full bg-slate-900/60 ring-1 ring-slate-700/50 text-slate-300 font-mono">
                {r.key} · {r.count}
              </span>
            ))}
          </div>
        )}

        <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-500 mb-3 flex items-center gap-2">
          <Radio size={12} className={running ? "text-cyan-400 animate-pulse" : "text-slate-600"} />
          Collection feed
          {pending && <span className="normal-case tracking-normal text-slate-500 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> embedding “{pending}”…</span>}
        </div>

        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {feed.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 flex items-start gap-3"
              >
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-200 truncate">{r.doc.title}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-300 ring-1 ring-slate-600">{r.doc.classification}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300">{r.doc.region}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400/80 shrink-0">{r.embed_dims}-d ✓</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {feed.length === 0 && (
            <div className="text-center text-slate-500 italic py-12 text-sm">
              Press <span className="text-cyan-300">Begin collection</span>. Each field report is embedded on the Spark and written to the edge index — which HQ federates into via cross-cluster search.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ icon, value, label, suffix }: { icon: React.ReactNode; value: number; label: string; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 flex items-center gap-3">
      {icon}
      <div>
        <motion.div key={value} initial={{ scale: 0.8, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} className="text-3xl font-bold text-slate-100 leading-none">
          {value.toLocaleString()}{suffix}
        </motion.div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{label}</div>
      </div>
    </div>
  );
}
