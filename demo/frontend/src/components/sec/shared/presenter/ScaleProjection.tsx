import { useMemo, useState } from "react";
import { Sparkles, Server, TrendingDown, DollarSign } from "lucide-react";
import { computeTco, TCO_DEFAULTS, fmtUsd, fmtVectors } from "../../lib/pricing";

/**
 * "What does it cost when we scale this up?"
 *
 * Uses the *enterprise TCO* model (annual hardware + ES + NVAIE, sized for
 * an indexing SLA) — same methodology as
 *   Cost Model for Elasticsearch GPUs.xlsx
 * The two presenter sliders:
 *   1. Total vectors to index (1M → 100B)
 *   2. Indexing SLA in hours (1 → 48)
 * Throughputs come from the live race if measured, else spreadsheet defaults.
 */
interface Props {
  gpuVps: number;
  cpuVps: number;
}

const VECTOR_PRESETS = [
  { label: "100 M",  value: 100_000_000 },
  { label: "1 B",    value: 1_000_000_000 },
  { label: "10 B",   value: 10_000_000_000 },
  { label: "100 B",  value: 100_000_000_000 },
];

export function ScaleProjection(_props: Props) {
  const [vectors, setVectors] = useState<number>(TCO_DEFAULTS.totalVectors);
  const [slaHours, setSlaHours] = useState<number>(TCO_DEFAULTS.slaHours);

  // Always use spreadsheet per-node defaults for the projection. Cold-start
  // race rates from a 100K subset extrapolated to 10B vectors don't represent
  // steady-state per-node throughput.
  const effGpu = TCO_DEFAULTS.benchmarkVps.gpu;
  const effCpu = TCO_DEFAULTS.benchmarkVps.cpu;

  const tco = useMemo(
    () => computeTco({ totalVectors: vectors, slaHours, cpuVps: effCpu, gpuVps: effGpu }),
    [vectors, slaHours, effCpu, effGpu],
  );

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-start h-full">
      {/* Left: sliders */}
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400 mb-1">
            <Sparkles size={12} className="text-[var(--color-elastic)]" />
            Total vectors to index
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-mono font-bold text-slate-100">{fmtVectors(vectors)}</div>
            <div className="text-sm text-slate-400">× {TCO_DEFAULTS.vectorDim}-d</div>
          </div>
          <input
            type="range"
            min={Math.log10(1_000_000)}
            max={Math.log10(100_000_000_000)}
            step={0.01}
            value={Math.log10(vectors)}
            onChange={(e) => setVectors(Math.round(Math.pow(10, Number(e.target.value))))}
            className="w-full accent-[var(--color-elastic)] mt-2"
          />
          <div className="flex justify-between gap-1 mt-1">
            {VECTOR_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setVectors(p.value)}
                className={`px-2 py-1 rounded text-[10px] font-mono ${
                  vectors === p.value
                    ? "bg-[var(--color-elastic)]/20 text-[var(--color-elastic)]"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400 mb-1">
            Indexing SLA
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-mono font-bold text-slate-100">{slaHours}</div>
            <div className="text-sm text-slate-400">hours to finish the workload</div>
          </div>
          <input
            type="range"
            min={1}
            max={48}
            step={1}
            value={slaHours}
            onChange={(e) => setSlaHours(Number(e.target.value))}
            className="w-full accent-[var(--color-elastic)] mt-2"
          />
        </div>

        <p className="text-[10px] text-slate-500 italic leading-snug">
          Steady-state per-node throughputs (cost-model spreadsheet) · CPU <span className="font-mono">{effCpu.toLocaleString()}</span> v/s · GPU <span className="font-mono">{effGpu.toLocaleString()}</span> v/s. The 100K race numbers in chapter 01 are cold-start rates and aren't used for enterprise extrapolation.
        </p>
      </div>

      {/* Middle divider */}
      <div className="h-48 w-px bg-slate-700/60" />

      {/* Right: projections */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Tile
            tone="amber"
            label="CPU"
            big={`${tco.cpuNodes.toFixed(2)}`}
            unit="nodes"
            sub={`${fmtUsd(tco.cpuAnnualUsd)}/yr`}
          />
          <Tile
            tone="emerald"
            label="GPU"
            big={`${tco.gpuNodes.toFixed(2)}`}
            unit="nodes"
            sub={`${fmtUsd(tco.gpuAnnualUsd)}/yr`}
          />
        </div>

        <div className="rounded-xl border border-[var(--color-elastic)]/30 bg-[var(--color-elastic)]/5 px-4 py-3 grid grid-cols-3 gap-2">
          <Big icon={<DollarSign size={12} />} label="Annual savings" value={fmtUsd(tco.savingsUsd)} />
          <Big icon={<TrendingDown size={12} />} label="TCO ↓"        value={`${tco.savingsPct.toFixed(0)}%`} accent />
          <Big icon={<Server size={12} />} label="Fewer nodes"        value={`−${(tco.cpuNodes - tco.gpuNodes).toFixed(1)}`} />
        </div>

        <p className="text-[10px] text-slate-500 italic leading-snug">
          Annual cost = nodes-needed-for-SLA × per-node-annual ($135.6k CPU / $148.4k GPU incl. ES + NVAIE).
        </p>
      </div>
    </div>
  );
}

function Tile({ tone, label, big, unit, sub }: { tone: "amber" | "emerald"; label: string; big: string; unit: string; sub: string }) {
  const text = tone === "amber" ? "text-amber-300" : "text-emerald-300";
  const border = tone === "amber" ? "border-amber-500/30" : "border-emerald-500/30";
  return (
    <div className={`rounded-xl border ${border} bg-slate-950/40 px-4 py-3`}>
      <div className={`text-[10px] uppercase tracking-wider ${text}`}>{label}</div>
      <div className="text-xl font-mono font-bold text-slate-100 mt-1">
        {big}<span className="text-xs text-slate-500 ml-1 font-sans font-normal">{unit}</span>
      </div>
      <div className="text-xs text-slate-500 font-mono">{sub}</div>
    </div>
  );
}

function Big({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-[10px] uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1.5`}>{icon}{label}</div>
      <div className={`text-xl font-mono font-bold mt-0.5 ${accent ? "text-[var(--color-elastic)]" : "text-slate-100"}`}>{value}</div>
    </div>
  );
}
