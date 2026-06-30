import { useMemo, useState } from "react";
import { DollarSign, TrendingDown, Server, Info } from "lucide-react";
import {
  HARDWARE, awsJobCost, computeTco, fmtUsd, fmtVectors,
  ANNUAL_NODE_USD, TCO_DEFAULTS,
} from "../lib/pricing";

interface Props {
  gpuTotalMs: number;       // ingest + force-merge for GPU side
  cpuTotalMs: number;       // ingest + force-merge for CPU side
  gpuVps: number;           // live throughput for projection
  cpuVps: number;
}

/**
 * Two stacked sections:
 *   1. AWS per-job cost  — "what did we just pay for this run on these boxes?"
 *   2. Enterprise TCO    — mirrors Cost Model for Elasticsearch GPUs.xlsx
 *      (nodes-needed-for-SLA × annual per-node cost).
 */
export function EconomicsPanel({ gpuTotalMs, cpuTotalMs, gpuVps, cpuVps }: Props) {
  const aws = awsJobCost(gpuTotalMs, cpuTotalMs);
  // Lock the enterprise TCO model to the spreadsheet's per-node steady-state
  // throughput defaults. The live race produces cold-start rates on a 100K
  // subset (~1k v/s CPU, ~16k v/s GPU); extrapolating those to 10B vectors at
  // a 12-hr SLA would imply 200+ nodes per side, which isn't realistic.
  // The AWS-per-job panel above stays live (those numbers are real for this run).
  const tco = useMemo(() => computeTco(), []);
  const [showAssumptions, setShowAssumptions] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5 space-y-5">
      {/* ───── AWS per-job ───── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={16} className="text-amber-300" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">AWS · cost of this exact job</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Row
            label={`CPU · ${HARDWARE.cpu.label}`}
            detail={`${HARDWARE.cpu.detail} · ${fmtUsd(HARDWARE.cpu.rate)}/hr`}
            jobCost={fmtUsd(aws.cpuUsd)}
            jobMs={cpuTotalMs}
            tone="amber"
          />
          <Row
            label={`GPU · ${HARDWARE.gpu.label}`}
            detail={`${HARDWARE.gpu.detail} · ${fmtUsd(HARDWARE.gpu.rate)}/hr`}
            jobCost={fmtUsd(aws.gpuUsd)}
            jobMs={gpuTotalMs}
            tone="emerald"
          />
        </div>
        <p className="text-[10px] text-slate-500 mt-2 italic">
          AWS bills Linux on-demand per second with a 60-second minimum, so very short GPU runs are billed at the 60-s floor.
        </p>
      </section>

      {/* ───── Enterprise TCO ───── */}
      <section className="pt-4 border-t border-slate-700/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-[var(--color-elastic)]" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Enterprise TCO · {fmtVectors(TCO_DEFAULTS.totalVectors)} vectors @ {TCO_DEFAULTS.slaHours}-hr SLA
            </h3>
          </div>
          <button
            onClick={() => setShowAssumptions(s => !s)}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200"
          >
            <Info size={12} /> Assumptions
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TcoTile
            label="CPU baseline"
            nodes={tco.cpuNodes}
            annualUsd={tco.cpuAnnualUsd}
            perNodeUsd={ANNUAL_NODE_USD.cpu.total}
            tone="amber"
          />
          <TcoTile
            label="GPU accelerated"
            nodes={tco.gpuNodes}
            annualUsd={tco.gpuAnnualUsd}
            perNodeUsd={ANNUAL_NODE_USD.gpu.total}
            tone="emerald"
          />
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-700/40">
          <Big label="Annual savings"     value={fmtUsd(tco.savingsUsd)}  icon={<DollarSign size={14} />} accent />
          <Big label="TCO reduction"      value={`${tco.savingsPct.toFixed(1)}%`} icon={<TrendingDown size={14} />} accent />
          <Big label="Fewer nodes needed" value={`${(tco.cpuNodes - tco.gpuNodes).toFixed(1)}`} icon={<Server size={14} />} />
        </div>

        <p className="text-[10px] text-slate-500 mt-3 italic leading-snug">
          Throughputs from the cost-model spreadsheet's per-node steady-state benchmarks: CPU <span className="font-mono">{TCO_DEFAULTS.benchmarkVps.cpu.toLocaleString()}</span> v/s · GPU <span className="font-mono">{TCO_DEFAULTS.benchmarkVps.gpu.toLocaleString()}</span> v/s. Our 100K race produced cold-start rates (CPU <span className="font-mono">{Math.round(cpuVps).toLocaleString()}</span> v/s · GPU <span className="font-mono">{Math.round(gpuVps).toLocaleString()}</span> v/s) — accurate for *this single warm-up run* but not representative of per-node throughput at enterprise scale, so the TCO model uses the spreadsheet values. Model mirrors <span className="font-mono">Cost Model for Elasticsearch GPUs.xlsx</span>.
        </p>
      </section>

      {/* Assumptions panel — toggled */}
      {showAssumptions && (
        <section className="pt-4 border-t border-slate-700/60 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <CostBreakdown title="CPU node · annual" parts={ANNUAL_NODE_USD.cpu} />
            <CostBreakdown title="GPU node · annual" parts={ANNUAL_NODE_USD.gpu} />
          </div>
          <p className="text-[10px] text-slate-500 mt-3 italic">
            CPU and GPU nodes share the same Elasticsearch license. GPU node adds 2× L4 in physical cost and NVAIE subscription. nodes_needed = (vectors ÷ vps ÷ 3600) ÷ SLA_hours.
          </p>
        </section>
      )}
    </div>
  );
}

function CostBreakdown({ title, parts }: { title: string; parts: { physical: number; systemSw: number; elasticSw: number; nvaie: number; total: number } }) {
  return (
    <div className="rounded-lg border border-slate-700/40 bg-slate-950/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">{title}</div>
      <Line k="Physical node" v={parts.physical} />
      <Line k="System SW"     v={parts.systemSw} />
      <Line k="Elasticsearch SW" v={parts.elasticSw} />
      <Line k="NVAIE"         v={parts.nvaie} />
      <div className="border-t border-slate-700/40 mt-1.5 pt-1.5">
        <Line k="Total" v={parts.total} bold />
      </div>
    </div>
  );
}

function Line({ k, v, bold }: { k: string; v: number; bold?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className={bold ? "text-slate-200" : "text-slate-500"}>{k}</span>
      <span className={`font-mono ${bold ? "text-slate-100" : "text-slate-300"}`}>{fmtUsd(v)}</span>
    </div>
  );
}

function Row({ label, detail, jobCost, jobMs, tone }: {
  label: string; detail: string; jobCost: string; jobMs: number; tone: "amber" | "emerald";
}) {
  const text = tone === "amber" ? "text-amber-300" : "text-emerald-300";
  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 p-3">
      <div className={`text-xs font-semibold ${text}`}>{label}</div>
      <div className="text-[10px] text-slate-500 mb-2">{detail}</div>
      <div className="text-2xl font-mono font-bold text-slate-100">{jobCost}</div>
      <div className="text-xs text-slate-500 mt-0.5">{jobMs ? `${(jobMs / 1000).toFixed(1)}s of compute` : "—"}</div>
    </div>
  );
}

function TcoTile({ label, nodes, annualUsd, perNodeUsd, tone }: {
  label: string; nodes: number; annualUsd: number; perNodeUsd: number; tone: "amber" | "emerald";
}) {
  const text = tone === "amber" ? "text-amber-300" : "text-emerald-300";
  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 p-3">
      <div className={`text-xs font-semibold ${text}`}>{label}</div>
      <div className="text-[10px] text-slate-500 mb-2">{nodes.toFixed(2)} nodes × {fmtUsd(perNodeUsd)}/yr</div>
      <div className="text-2xl font-mono font-bold text-slate-100">{fmtUsd(annualUsd)}<span className="text-sm text-slate-500 font-sans font-normal ml-1.5">/ yr</span></div>
      <div className="text-xs text-slate-500 mt-0.5">{nodes.toFixed(2)} physical nodes</div>
    </div>
  );
}

function Big({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className={`font-mono font-bold text-2xl flex items-center justify-center gap-1.5 ${accent ? "text-[var(--color-elastic)]" : "text-slate-100"}`}>
        {icon}
        {value}
      </div>
      <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}
