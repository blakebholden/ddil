import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, X, Zap, Clock, Gauge, GitMerge } from "lucide-react";
import { formatNumber, formatMs } from "../lib/utils";
import { awsJobCost, fmtUsd } from "../lib/pricing";
import type { PathMetrics } from "../hooks/useRaceMetrics";

interface Props {
  open: boolean;
  gpu: PathMetrics;
  cpu: PathMetrics;
  onClose: () => void;
}

export function GpuFinishedPopup({ open, gpu, cpu, onClose }: Props) {
  const gpuTotal = gpu.ingestMs + gpu.forceMergeMs;
  const cpuPct = cpu.totalDocs > 0 ? (cpu.docsIndexed / cpu.totalDocs) * 100 : 0;
  // Project CPU finish time at its current throughput
  const remaining = Math.max(0, (cpu.totalDocs || cpu.docsIndexed) - cpu.docsIndexed);
  const cpuEtaSec = cpu.throughput > 0 ? remaining / cpu.throughput : 0;
  // Speedup estimate based on what we have so far (GPU done, CPU still running)
  const cpuProjectedMs = cpu.throughput > 0 ? ((cpu.totalDocs || cpu.docsIndexed) / cpu.throughput) * 1000 : 0;
  const projectedSpeedup = gpuTotal > 0 && cpuProjectedMs > 0 ? cpuProjectedMs / gpuTotal : 0;
  const projectedCost = cpuProjectedMs > 0 ? awsJobCost(gpuTotal, cpuProjectedMs) : null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — translucent so the CPU progress is still visible behind */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-6"
          >
            <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-[var(--color-elastic)]/50 bg-slate-900/95 shadow-2xl shadow-[var(--color-elastic)]/10">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/40 flex items-center justify-center">
                    <CheckCircle2 size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-emerald-400 font-semibold flex items-center gap-1.5">
                      <Zap size={12} /> GPU finished
                    </div>
                    <div className="text-base text-slate-100 font-semibold mt-0.5">
                      NVIDIA L4 · cuVS CAGRA built {formatNumber(gpu.docsIndexed)} vectors
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-slate-500 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  aria-label="Dismiss"
                >
                  <X size={18} />
                </button>
              </div>

              {/* GPU Stats */}
              <div className="px-6 py-5">
                <div className="grid grid-cols-4 gap-4">
                  <Stat
                    icon={<Gauge size={14} />}
                    label="Throughput"
                    value={formatNumber(Math.round(gpu.throughput))}
                    unit="v/s"
                  />
                  <Stat
                    icon={<Clock size={14} />}
                    label="Ingest"
                    value={(gpu.ingestMs / 1000).toFixed(1)}
                    unit="s"
                  />
                  <Stat
                    icon={<GitMerge size={14} />}
                    label="Force-merge"
                    value={gpu.forceMergeMs < 1000
                      ? `${Math.round(gpu.forceMergeMs)}`
                      : (gpu.forceMergeMs / 1000).toFixed(1)}
                    unit={gpu.forceMergeMs < 1000 ? "ms" : "s"}
                  />
                  <Stat
                    icon={<CheckCircle2 size={14} />}
                    label="Total"
                    value={formatMs(gpuTotal)}
                    unit=""
                    accent
                  />
                </div>

                {/* CPU still chugging */}
                <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider text-amber-300 font-semibold">
                      Meanwhile · CPU side
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {cpuPct.toFixed(1)}% · {formatNumber(cpu.docsIndexed)}/{formatNumber(cpu.totalDocs || cpu.docsIndexed)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-amber-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(cpuPct, 100)}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {cpu.phase === "ingesting" && cpuEtaSec > 0
                      ? <>~{formatMs(cpuEtaSec * 1000)} of ingest remaining at {formatNumber(Math.round(cpu.throughput))} v/s</>
                      : cpu.phase === "force_merging"
                        ? "CPU still force-merging on Lucene…"
                        : "CPU still working…"}
                  </div>
                </div>

                {/* Projected speedup */}
                {projectedSpeedup > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-slate-700/60">
                    <Headline label="Projected speedup" value={`${projectedSpeedup.toFixed(1)}×`} accent />
                    {projectedCost && (
                      <>
                        <Headline label="AWS cost · this job"
                                  value={`${fmtUsd(projectedCost.gpuUsd)} vs ${fmtUsd(projectedCost.cpuUsd)}`}
                                  small />
                        <Headline label="Per-job AWS savings"
                                  value={`${projectedCost.savingsPct.toFixed(0)}%`} />
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-slate-700/60 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 italic">
                  This card stays until CPU finishes. Click anywhere outside to dismiss.
                </span>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-elastic)]/20 text-[var(--color-elastic)] hover:bg-[var(--color-elastic)]/30 transition-colors"
                >
                  Keep watching CPU
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Stat({ icon, label, value, unit, accent }: { icon: React.ReactNode; label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-wider">
        {icon}{label}
      </div>
      <div className={`mt-1 font-mono font-bold ${accent ? "text-3xl text-[var(--color-elastic)]" : "text-2xl text-slate-100"}`}>
        {value}<span className="text-xs text-slate-500 ml-1 font-sans font-normal">{unit}</span>
      </div>
    </div>
  );
}

function Headline({ label, value, accent, small }: { label: string; value: string; accent?: boolean; small?: boolean }) {
  return (
    <div className="text-center">
      <div className={`font-mono font-bold ${small ? "text-base" : "text-2xl"} ${accent ? "text-[var(--color-elastic)]" : "text-slate-100"}`}>
        {value}
      </div>
      <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}
