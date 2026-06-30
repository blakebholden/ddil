/**
 * Provenance + processing pipeline for the SEC 10-K corpus.
 *   Source → Parse → Chunk → Embed → Index
 * Plus a stats footer with the load-bearing numbers.
 */
import { Download, FileText, Scissors, Sparkles, Database, ArrowRight } from "lucide-react";

interface Step {
  Icon: typeof Download;
  label: string;
  detail: string;
  tone: "muted" | "elastic" | "nvidia" | "amber";
}

const STEPS: Step[] = [
  { Icon: Download, label: "Fetch",  detail: "SEC EDGAR · 503 S&P 500 latest 10-K filings", tone: "muted"  },
  { Icon: FileText, label: "Parse",  detail: "HTML → plain text · headers + metadata extracted", tone: "muted" },
  { Icon: Scissors, label: "Chunk",  detail: "tiktoken cl100k_base · 750 tokens · 100-token overlap", tone: "amber" },
  { Icon: Sparkles, label: "Embed",  detail: "Bedrock Cohere v4 · 1536-d float · batch of 48", tone: "nvidia" },
  { Icon: Database, label: "Index",  detail: "Bulk to ES 9.4.1 · dense_vector · HNSW · dot_product", tone: "elastic" },
];

const TONE: Record<Step["tone"], string> = {
  muted:   "border-slate-700/60 bg-slate-900/40 text-slate-200",
  elastic: "border-[var(--color-elastic)]/40 bg-[var(--color-elastic)]/10 text-[var(--color-elastic)]",
  nvidia:  "border-[var(--color-nvidia)]/40 bg-[var(--color-nvidia)]/10 text-[var(--color-nvidia)]",
  amber:   "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

export function DataPipeline() {
  return (
    <div>
      <div className="flex items-stretch gap-0">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-stretch flex-1">
            <div className={`flex-1 rounded-xl border ${TONE[s.tone]} px-3 py-3 flex flex-col`}>
              <div className="flex items-center gap-2 mb-1">
                <s.Icon size={16} />
                <span className="font-semibold text-sm">{s.label}</span>
              </div>
              <span className="text-[11px] text-slate-400 leading-snug">{s.detail}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex items-center px-1.5 text-slate-600 shrink-0">
                <ArrowRight size={14} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-5 gap-3">
        <Stat label="Source"        value="SEC EDGAR" sub="public filings · zero cost" />
        <Stat label="Filings"       value="503"        sub="latest 10-K per S&P 500 company" />
        <Stat label="Chunks indexed" value="93,541"    sub="text + 1536-d vector each" />
        <Stat label="Embed model"   value="Cohere Embed v4" sub="us.cohere.embed-v4:0 · Bedrock" />
        <Stat label="Index size"    value="759 MB"     sub="post force-merge · 1 shard" />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-base font-mono font-semibold text-slate-100 mt-0.5">{value}</div>
      <div className="text-[10px] text-slate-500 leading-snug mt-0.5">{sub}</div>
    </div>
  );
}
