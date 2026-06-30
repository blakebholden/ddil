import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cloud, HardDrive, Wifi, WifiOff, Loader2, RefreshCw, X, Search, Plug, Unplug,
} from "lucide-react";
import {
  useCcsStatus, useCcsState, useCcsSearch, synchronise, disconnect,
  type CcsHit,
} from "./api";

interface Props { onExit?: () => void; }

export function CcsApp({ onExit }: Props) {
  const { status, refresh } = useCcsStatus(5000);
  const state = useCcsState();
  const { result, loading, error, search } = useCcsSearch();
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);

  const edgeOnline = Boolean(status?.connected);
  const edgeState: "offline" | "connecting" | "online" = syncing ? "connecting" : edgeOnline ? "online" : "offline";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onExit?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  // baseline + refresh results whenever the edge comes on/off line
  useEffect(() => { search(query, "federated"); /* eslint-disable-next-line */ }, [edgeOnline]);

  const doSync = async () => {
    setSyncing(true);
    try {
      await synchronise();
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
      search(query, "federated");
    }
  };

  const doDisconnect = async () => {
    await disconnect();
    await refresh();
    search(query, "federated");
  };

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
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-400">Sovereign AI · Edge Federation</div>
            <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Cross-Cluster Search · query the edge from the cloud</h1>
          </div>
        </div>
        <button onClick={() => refresh()} className="text-slate-500 hover:text-slate-200" title="Refresh remote status">
          <RefreshCw size={15} />
        </button>
      </header>

      <main className="flex-1 overflow-auto p-8 max-w-5xl mx-auto w-full">
        {/* Topology */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-6">
          <ClusterCard
            icon={<Cloud size={26} className="text-cyan-300" />}
            title="Elastic Cloud Hosted"
            sub={state?.ech_url?.replace(/^https?:\/\//, "").slice(0, 38) ?? "AWS · coordinating cluster"}
            tone="cyan"
            online
            role="Coordinating cluster · runs the search"
          />
          <ConnectionLink state={edgeState} />
          <ClusterCard
            icon={<HardDrive size={26} className={edgeOnline ? "text-emerald-300" : "text-slate-500"} />}
            title="DDIL Edge Box"
            sub={state?.box_proxy ?? "192.168.1.20 · remote cluster"}
            tone={edgeOnline ? "emerald" : "slate"}
            online={edgeOnline}
            role={`Remote "${state?.alias ?? "edge"}" · ${edgeState}`}
          />
        </div>

        {/* Synchronise control */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {!edgeOnline ? (
            <motion.button
              onClick={doSync}
              disabled={syncing}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20"
            >
              {syncing ? <Loader2 size={18} className="animate-spin" /> : <Plug size={18} />}
              {syncing ? "Establishing uplink…" : "Synchronise Now"}
            </motion.button>
          ) : (
            <button onClick={doDisconnect} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm">
              <Unplug size={15} /> Disconnect edge
            </button>
          )}
        </div>

        {/* Reveal counters */}
        {result && (
          <div className="flex items-center justify-center gap-8 mb-6">
            <Counter label="Cloud results" value={result.counts.cloud} tone="cyan" />
            <div className="text-3xl font-thin text-slate-600">+</div>
            <Counter label="Edge results" value={result.counts.edge} tone="emerald" dim={!edgeOnline} />
            <div className="text-3xl font-thin text-slate-600">=</div>
            <Counter label="Total visible" value={result.total} tone="slate" big />
          </div>
        )}

        {/* Search */}
        <form onSubmit={(e) => { e.preventDefault(); search(query, "federated"); }} className="relative mb-5">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${state?.index ?? "field-reports"} across cloud${edgeOnline ? " + edge" : ""}…`}
            className="w-full pl-11 pr-28 py-3.5 bg-slate-900/60 border border-slate-700/60 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
          <button type="submit" disabled={loading} className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 text-sm font-medium flex items-center gap-1.5">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </form>

        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300 mb-4">{error}</div>}

        {result && (
          <div className="space-y-2">
            <AnimatePresence>
              {result.hits.map((h, i) => (
                <motion.div key={h.id + h.cluster} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                  <ResultRow h={h} />
                </motion.div>
              ))}
            </AnimatePresence>
            {result.hits.length === 0 && !loading && (
              <div className="text-center text-slate-500 italic py-10 text-sm">No results. Try a query, or Synchronise Now to include the edge box.</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const RING: Record<string, string> = {
  cyan: "border-cyan-500/40",
  emerald: "border-emerald-500/40",
  slate: "border-slate-700/60",
};

function ClusterCard({ icon, title, sub, tone, online, role }: { icon: React.ReactNode; title: string; sub: string; tone: string; online: boolean; role: string }) {
  const ring = online ? (RING[tone] ?? "border-slate-700/60") : "border-slate-700/60";
  return (
    <div className={`rounded-2xl border ${ring} bg-slate-900/50 p-5`}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          <div className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]">{sub}</div>
        </div>
        <div className="ml-auto">
          {online ? <Wifi size={15} className="text-emerald-400" /> : <WifiOff size={15} className="text-slate-600" />}
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{role}</div>
    </div>
  );
}

function ConnectionLink({ state }: { state: "offline" | "connecting" | "online" }) {
  const color = state === "online" ? "bg-emerald-400" : state === "connecting" ? "bg-cyan-400" : "bg-slate-700";
  return (
    <div className="flex flex-col items-center gap-1 w-24">
      <div className="relative w-full h-0.5 bg-slate-800 rounded">
        <motion.div
          className={`absolute inset-y-0 left-0 ${color} rounded`}
          animate={{ width: state === "offline" ? "0%" : "100%", opacity: state === "connecting" ? [0.4, 1, 0.4] : 1 }}
          transition={{ duration: state === "connecting" ? 1 : 0.5, repeat: state === "connecting" ? Infinity : 0 }}
        />
      </div>
      <span className="text-[9px] uppercase tracking-wider text-slate-500">
        {state === "online" ? "CCS link" : state === "connecting" ? "uplink…" : "airgapped"}
      </span>
    </div>
  );
}

const COUNTER_TONE: Record<string, string> = {
  cyan: "text-cyan-300",
  emerald: "text-emerald-300",
  slate: "text-slate-200",
};

function Counter({ label, value, tone, big, dim }: { label: string; value: number; tone: string; big?: boolean; dim?: boolean }) {
  return (
    <div className={`text-center ${dim ? "opacity-40" : ""}`}>
      <motion.div key={value} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`font-bold ${COUNTER_TONE[tone] ?? "text-slate-200"} ${big ? "text-4xl" : "text-3xl"}`}>
        {value.toLocaleString()}
      </motion.div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function ResultRow({ h }: { h: CcsHit }) {
  const edge = h.cluster === "edge";
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 flex items-start gap-3">
      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded ring-1 shrink-0 ${edge ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" : "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30"}`}>
        {edge ? "EDGE" : "CLOUD"}
      </span>
      <div className="min-w-0">
        {h.title && <div className="text-sm font-medium text-slate-200 truncate">{h.title}</div>}
        <div className="text-xs text-slate-400 line-clamp-2">{h.text}</div>
      </div>
      <span className="ml-auto text-[10px] font-mono text-slate-600 shrink-0">{h.score?.toFixed(2)}</span>
    </div>
  );
}
