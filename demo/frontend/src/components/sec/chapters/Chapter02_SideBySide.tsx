import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Activity, Layers, Workflow } from "lucide-react";
import { ChapterShell } from "../shared/ChapterShell";
import { useRaceMetrics } from "../hooks/useRaceMetrics";
import { EconomicsPanel } from "../shared/EconomicsPanel";
import { ElasticGpuStack } from "../shared/diagrams/ElasticGpuStack";
import { E2eWorkflow } from "../shared/diagrams/E2eWorkflow";

type Tab = "throughput" | "architecture" | "workflow";

export function Chapter02_SideBySide() {
  const { metrics } = useRaceMetrics();
  const [tab, setTab] = useState<Tab>("throughput");

  // Merge per-side histories into a single time-ordered series for recharts.
  const series = useMemo(() => {
    const map = new Map<number, { time: number; gpu?: number; cpu?: number }>();
    for (const p of metrics.gpu.history) {
      const t = Math.round(p.time);
      map.set(t, { ...(map.get(t) ?? { time: t }), gpu: p.throughput });
    }
    for (const p of metrics.cpu.history) {
      const t = Math.round(p.time);
      map.set(t, { ...(map.get(t) ?? { time: t }), cpu: p.throughput });
    }
    return [...map.values()].sort((a, b) => a.time - b.time);
  }, [metrics.gpu.history, metrics.cpu.history]);

  const gpuTotal = metrics.gpu.ingestMs + metrics.gpu.forceMergeMs;
  const cpuTotal = metrics.cpu.ingestMs + metrics.cpu.forceMergeMs;

  return (
    <ChapterShell
      number="02"
      title="Side-by-Side"
      subtitle="Direct comparison of Elastic accelerated with NVIDIA cuVS versus the baseline. Observe the dramatic difference in force-merge latency and CPU utilization."
    >
      <div className="flex flex-col gap-4 h-full">
        {/* Tab switcher */}
        <div className="flex gap-2">
          <TabButton active={tab === "throughput"} onClick={() => setTab("throughput")} icon={<Activity size={14} />}>Throughput</TabButton>
          <TabButton active={tab === "workflow"}   onClick={() => setTab("workflow")}   icon={<Workflow size={14} />}>E2e Workflow</TabButton>
          <TabButton active={tab === "architecture"} onClick={() => setTab("architecture")} icon={<Layers size={14} />}>Architecture</TabButton>
        </div>

        {/* Top panel — varies by tab */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5 min-h-[360px]">
          {tab === "throughput" && (
            <>
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Indexing throughput · vectors/sec</h3>
                <div className="text-xs text-slate-500 font-mono">
                  GPU peak {formatPeak(metrics.gpu.history)} v/s · CPU peak {formatPeak(metrics.cpu.history)} v/s
                </div>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={11} label={{ value: "seconds", position: "insideBottom", offset: -4, fill: "#64748b", fontSize: 10 }} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontSize: 12 }} labelStyle={{ color: "#94a3b8" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" name="GPU · cuVS CAGRA" dataKey="gpu" stroke="#10b981" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" name="CPU · HNSW"        dataKey="cpu" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {tab === "workflow" && (
            <>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-1">E2e indexing workflow</h3>
              <p className="text-xs text-slate-500 mb-4">Offload graph build + merge to the GPU; segments stay HNSW for CPU-served search.</p>
              <E2eWorkflow />
            </>
          )}

          {tab === "architecture" && (
            <>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-1">Elastic + NVIDIA cuVS stack</h3>
              <p className="text-xs text-slate-500 mb-4">cuVS runs the GPU-bound steps (CAGRA build, index merge) through cuvs-java; ES handles parsing, storage, and serving on CPU.</p>
              <div className="grid grid-cols-2 gap-6 items-center">
                <ElasticGpuStack />
                <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                  <p><span className="text-[var(--color-elastic)] font-semibold">Zero-code-change API</span> — set <code className="font-mono text-xs bg-slate-800 px-1.5 py-0.5 rounded">vectors.indexing.use_gpu: true</code> and ES routes graph-build to the GPU.</p>
                  <p><span className="text-[var(--color-elastic)] font-semibold">Plugin architecture</span> — JNI bridge connects ES/Lucene to a C++ backend that calls cuVS.</p>
                  <p><span className="text-[var(--color-elastic)] font-semibold">Interoperable</span> — CAGRA graphs convert to HNSW format so CPU search keeps working without changes.</p>
                  <p className="text-xs text-slate-500 italic">Bundled in Elasticsearch 9.4 OSS.</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Economics panel — always visible below */}
        <EconomicsPanel
          gpuTotalMs={gpuTotal}
          cpuTotalMs={cpuTotal}
          gpuVps={metrics.gpu.throughput}
          cpuVps={metrics.cpu.throughput}
        />
      </div>
    </ChapterShell>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? "bg-[var(--color-elastic)]/20 text-[var(--color-elastic)] ring-1 ring-[var(--color-elastic)]/30"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function formatPeak(history: { throughput: number }[]): string {
  if (!history.length) return "—";
  const peak = Math.max(...history.map(p => p.throughput));
  return peak >= 1000 ? `${(peak / 1000).toFixed(1)}k` : `${Math.round(peak)}`;
}
