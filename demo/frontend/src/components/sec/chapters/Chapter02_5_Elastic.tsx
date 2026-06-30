import { motion } from "framer-motion";
import { Rocket, Layers, Sparkles, ArrowRight } from "lucide-react";
import { ChapterShell } from "../shared/ChapterShell";
import { ElasticPlatformStack } from "../shared/diagrams/ElasticPlatformStack";
import { OneIndexFourConsumers } from "../shared/diagrams/OneIndexFourConsumers";
import { DataPipeline } from "../shared/diagrams/DataPipeline";

const PILLARS = [
  {
    Icon: Rocket,
    title: "Fastest time-to-market for developers",
    body: "One API for keyword, semantic, kNN, hybrid retrieval. Standard query DSL, standard clients. No new system to maintain.",
  },
  {
    Icon: Layers,
    title: "Speed, scale, efficiency unlock new use-cases",
    body: "GPU-built indexes make daily re-ingestion of fresh enterprise data affordable. The 89% TCO reduction from chapter 02 turns 'periodic refresh' into 'always current.'",
  },
  {
    Icon: Sparkles,
    title: "Relevance is the enabler of AI agents",
    body: "Agents stall on bad retrieval. Hybrid + reranking + semantic_text via the same platform means agents get the right context, on time, every time.",
  },
];

export function Chapter02_5_Elastic() {
  return (
    <ChapterShell
      number="—"
      title="Elastic"
      subtitle="From a faster index to a faster business. The GPU compressed the cost of building the vector layer; now Elastic is the platform that turns it into search, agents, and workflows."
    >
      <div className="space-y-6">
        {/* Pillars row */}
        <div className="grid grid-cols-3 gap-4">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5"
            >
              <p.Icon size={20} className="text-[var(--color-elastic)] mb-3" />
              <h3 className="text-sm font-semibold text-slate-100 leading-snug">{p.title}</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{p.body}</p>
            </motion.div>
          ))}
        </div>

        {/* Two-column diagram row */}
        <div className="grid grid-cols-2 gap-5">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Elastic Platform Stack</h3>
              <span className="text-[10px] text-slate-500 italic">Deck p.16</span>
            </div>
            <ElasticPlatformStack />
          </div>

          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Same vectors, multiple consumers</h3>
              <span className="text-[10px] text-slate-500 italic">One index, four interfaces</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <OneIndexFourConsumers />
            </div>
            <p className="text-[11px] text-slate-500 italic mt-2 leading-snug">
              The next two chapters land on the right-hand spokes: the <span className="text-slate-300">Developer API</span> + <span className="text-slate-300">Analyst UI</span> (chapter 03), the <span className="text-slate-300">Agent</span> + <span className="text-slate-300">Workflow</span> (chapter 04).
            </p>
          </div>
        </div>

        {/* Dataset + pipeline panel */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">The dataset behind the next two chapters</h3>
            <span className="text-[10px] text-slate-500 italic">SEC 10-K corpus · provisioned for this demo</span>
          </div>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Public S&P 500 annual reports pulled from SEC EDGAR, parsed, chunked, and embedded with Bedrock Cohere Embed v4 — then bulk-loaded into the GPU-built index from chapter 01. Same vectors flow into the search UI (03), the agent (04), and the workflow trigger.
          </p>
          <DataPipeline />
        </div>

        {/* Footer "next" hint */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 pt-2">
          <span>Next:</span>
          <span className="text-slate-300 font-medium">03 · Data Interface</span>
          <ArrowRight size={12} />
          <span className="text-slate-500">analyst + developer face the same index</span>
        </div>
      </div>
    </ChapterShell>
  );
}
