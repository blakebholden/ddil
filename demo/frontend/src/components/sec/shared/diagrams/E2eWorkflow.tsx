/**
 * E2e Indexing Workflow — mirrors deck page 11.
 * Request → JSON Parse → Vector Blob → Index Build (cuVS / CAGRA→HNSW)
 *   → Index (HNSW) ×3 → Index Merge (cuVS / HNSW→CAGRA) → Merged Index
 */
import { ArrowRight } from "lucide-react";

type Tone = "cpu" | "gpu";

function Step({ label, sub, tone, span }: { label: string; sub?: string; tone: Tone; span?: number }) {
  const cls = tone === "cpu"
    ? "border-sky-500/40 bg-sky-500/10 text-sky-200"
    : "border-[var(--color-nvidia)]/40 bg-[var(--color-nvidia)]/10 text-[var(--color-nvidia)]";
  return (
    <div className={`rounded-lg border ${cls} px-3 py-2 text-center text-xs leading-tight`} style={span ? { gridColumn: `span ${span}` } : undefined}>
      <div className="font-semibold">{label}</div>
      {sub && <div className="text-[10px] opacity-80 mt-0.5">{sub}</div>}
    </div>
  );
}

function Arrow() {
  return <ArrowRight size={14} className="text-slate-600 mx-auto" />;
}

export function E2eWorkflow() {
  return (
    <div className="w-full">
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_2fr_auto_1fr] items-center gap-1.5">
        <Step label="Request JSON"      tone="cpu" />
        <Arrow />
        <Step label="JSON Parse"        tone="cpu" />
        <Arrow />
        <Step label="Vector Blob"       tone="cpu" />
        <Arrow />
        <Step label="Index Build"       sub="cuVS · CAGRA → HNSW" tone="gpu" />
        <Arrow />
        <div className="space-y-1">
          <Step label="Index (HNSW)" tone="cpu" />
          <Step label="Index (HNSW)" tone="cpu" />
          <Step label="Index (HNSW)" tone="cpu" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[5fr_auto_2fr_auto_1fr] items-center gap-1.5">
        <div className="text-center text-[10px] text-slate-500 uppercase tracking-wider">↑ ingest pipeline</div>
        <Arrow />
        <Step label="Index Merge"       sub="cuVS · HNSW → CAGRA" tone="gpu" />
        <Arrow />
        <Step label="Merged Index"      tone="cpu" />
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-slate-500 uppercase tracking-wider">
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm bg-sky-500/60"/> Elastic CPU process</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm bg-[var(--color-nvidia)]/70"/> Elastic GPU process (cuVS)</span>
      </div>
    </div>
  );
}
