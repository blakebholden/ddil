import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, Zap, Cpu } from "lucide-react";
import { ChapterShell } from "../shared/ChapterShell";
import { PhasePill } from "../shared/PhasePill";
import { GpuFinishedPopup } from "../shared/GpuFinishedPopup";
import { PresenterPanel } from "../shared/presenter/PresenterPanel";
import { useRaceMetrics, type PathMetrics } from "../hooks/useRaceMetrics";
import { formatNumber } from "../lib/utils";
import { awsJobCost, computeTco, TCO_DEFAULTS, fmtUsd, fmtVectors } from "../lib/pricing";

function ProgressBar({ percent, color }: { percent: number; color: "amber" | "emerald" }) {
  const bg = color === "amber" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
      <motion.div
        className={`h-full ${bg} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(percent, 100)}%` }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </div>
  );
}

function Side({
  side, path, label, hw, color, accentIcon,
}: {
  side: "gpu" | "cpu";
  path: PathMetrics;
  label: string;
  hw: string;
  color: "amber" | "emerald";
  accentIcon: React.ReactNode;
}) {
  const pct = path.totalDocs > 0
    ? (path.docsIndexed / path.totalDocs) * 100
    : (path.phase === "complete" ? 100 : 0);
  const ringColor = color === "amber"
    ? "border-amber-500/30 bg-amber-500/5"
    : "border-emerald-500/30 bg-emerald-500/5";
  const text = color === "amber" ? "text-amber-400" : "text-emerald-400";

  return (
    <div className={`flex-1 p-6 border ${ringColor} rounded-2xl`}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={text}>{accentIcon}</span>
          <h3 className={`text-xl font-semibold ${text}`}>{label}</h3>
        </div>
        <PhasePill phase={path.phase} />
      </div>
      <p className="text-xs text-slate-500 mb-4 uppercase tracking-wider">{hw}</p>

      <ProgressBar percent={pct} color={color} />
      <div className="mt-2 text-xs text-slate-400 flex justify-between">
        <span>{formatNumber(path.docsIndexed)}{path.totalDocs ? ` / ${formatNumber(path.totalDocs)}` : ""} vectors</span>
        <span>{pct.toFixed(1)}%</span>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <Stat label="Throughput"  value={formatNumber(Math.round(path.throughput))} unit="v/s" />
        <Stat label="Ingest"      value={(path.ingestMs / 1000).toFixed(1)}        unit="s" />
        <Stat label="Force-merge" value={path.forceMergeMs < 1000 ? `${Math.round(path.forceMergeMs)}` : (path.forceMergeMs/1000).toFixed(1)} unit={path.forceMergeMs < 1000 ? "ms" : "s"} />
      </div>

      {path.error && (
        <div className="mt-4 text-xs text-rose-400 font-mono break-all">{path.error}</div>
      )}
      {/* side var kept for future per-side endpoints */}
      <span hidden>{side}</span>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="mt-1 text-2xl font-mono font-bold text-slate-100">
        {value}<span className="text-sm text-slate-500 ml-1.5 font-sans font-normal">{unit}</span>
      </div>
    </div>
  );
}

export function Chapter01_Speed() {
  const { metrics, startRace, resetRace } = useRaceMetrics();
  const [starting, setStarting] = useState(false);
  const running = metrics.status === "running";

  // Popup: fires once when the GPU side crosses into "complete" while the CPU
  // side is still running. Dismissed manually, or auto-dismissed when CPU finishes.
  const prevGpuPhase = useRef(metrics.gpu.phase);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupShownForRace, setPopupShownForRace] = useState(false);

  useEffect(() => {
    const wasNotComplete = prevGpuPhase.current !== "complete";
    const gpuJustFinished = wasNotComplete && metrics.gpu.phase === "complete";
    const cpuStillBusy = metrics.cpu.phase === "ingesting" || metrics.cpu.phase === "force_merging";
    if (gpuJustFinished && cpuStillBusy && !popupShownForRace) {
      setPopupOpen(true);
      setPopupShownForRace(true);
    }
    if (metrics.cpu.phase === "complete" && popupOpen) {
      setPopupOpen(false);             // auto-dismiss when CPU lands too
    }
    if (metrics.gpu.phase === "idle" && metrics.cpu.phase === "idle") {
      setPopupShownForRace(false);     // arm for the next race
    }
    prevGpuPhase.current = metrics.gpu.phase;
  }, [metrics.gpu.phase, metrics.cpu.phase, popupOpen, popupShownForRace]);

  const handleStart = async () => {
    setStarting(true);
    setPopupShownForRace(false);       // arm for this race
    setPopupOpen(false);
    await startRace();
    setStarting(false);
  };

  return (
    <ChapterShell
      number="01"
      title="Indexing Speed"
      subtitle="Watch a live, real-time race between standard CPU-based HNSW indexing and GPU-accelerated CAGRA indexing on identical data sets."
    >
      <div className="flex flex-col h-full gap-4">
        <div className="flex justify-end gap-2">
          <button
            onClick={handleStart}
            disabled={starting || running}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--color-elastic)] hover:bg-[var(--color-elastic-dark)] text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play size={16} />
            {starting ? "Starting…" : running ? "Running…" : "Start Race"}
          </button>
          <button
            onClick={resetRace}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200"
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Side
            side="cpu"
            path={metrics.cpu}
            label="CPU · HNSW"
            hw="g6.8xlarge · 32 vCPU EPYC · port 9201"
            color="amber"
            accentIcon={<Cpu size={20} />}
          />
          <Side
            side="gpu"
            path={metrics.gpu}
            label="GPU · cuVS CAGRA"
            hw="g6.4xlarge · NVIDIA L4 · port 9200"
            color="emerald"
            accentIcon={<Zap size={20} />}
          />
        </div>

        {/* Presenter panel — always present, auto-rotates while CPU is catching up */}
        <PresenterPanel
          gpuVps={metrics.gpu.throughput}
          cpuVps={metrics.cpu.throughput}
          rotateActive={metrics.gpu.phase === "complete" && metrics.cpu.phase !== "complete"}
        />

        <AnimatePresence>
          {metrics.status === "complete" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid grid-cols-6 gap-4 p-5 border border-[var(--color-elastic)]/40 bg-[var(--color-elastic)]/5 rounded-2xl"
            >
              <Headline label="Ingest speedup"      value={`${metrics.ingestSpeedup.toFixed(1)}×`} />
              <Headline label="Force-merge speedup" value={`${metrics.forceMergeSpeedup.toFixed(1)}×`} />
              <Headline label="End-to-end"          value={`${metrics.speedup.toFixed(1)}×`} />
              {(() => {
                const aws = awsJobCost(
                  metrics.gpu.ingestMs + metrics.gpu.forceMergeMs,
                  metrics.cpu.ingestMs + metrics.cpu.forceMergeMs,
                );
                const tco = computeTco({ gpuVps: metrics.gpu.throughput, cpuVps: metrics.cpu.throughput });
                return (
                  <>
                    <Headline
                      label="AWS cost · this job"
                      value={aws.gpuUsd > 0 ? `${fmtUsd(aws.gpuUsd)} vs ${fmtUsd(aws.cpuUsd)}` : "—"}
                      small
                    />
                    <Headline
                      label={`TCO ↓ · ${fmtVectors(TCO_DEFAULTS.totalVectors)} / ${TCO_DEFAULTS.slaHours}h SLA`}
                      value={tco.savingsPct > 0 ? `${tco.savingsPct.toFixed(0)}%` : "—"}
                      sub={tco.savingsUsd > 0 ? `${fmtUsd(tco.savingsUsd)} / yr` : undefined}
                      accent
                    />
                  </>
                );
              })()}
              <Headline label="Recall (GPU / CPU)"  value={`${metrics.recallGpu.toFixed(1)}% / ${metrics.recallCpu.toFixed(1)}%`} small />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GpuFinishedPopup
        open={popupOpen}
        gpu={metrics.gpu}
        cpu={metrics.cpu}
        onClose={() => setPopupOpen(false)}
      />
    </ChapterShell>
  );
}

function Headline({ label, value, accent, small, sub }: { label: string; value: string; accent?: boolean; small?: boolean; sub?: string }) {
  return (
    <div className="text-center">
      <div className={`font-mono font-bold ${small ? "text-xl" : "text-3xl"} ${accent ? "text-[var(--color-elastic)]" : "text-slate-100"}`}>
        {value}
      </div>
      <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{label}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{sub}</div>}
    </div>
  );
}
