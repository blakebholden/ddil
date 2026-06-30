import { motion } from "framer-motion";
import {
  Cpu, Zap, Layers, Search, Bot, Workflow,
  BookOpen, Github, Rocket, Sparkles, ExternalLink,
  Clock, Database, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { ChapterShell } from "../shared/ChapterShell";

interface RecapTier {
  number: string;
  Icon: typeof Cpu;
  title: string;
  headline: string;
  detail: string;
}

const RECAP: RecapTier[] = [
  { number: "00", Icon: Cpu,      title: "Setup",        headline: "Two boxes, one knob",
    detail: "g6.4xlarge L4 vs g6.8xlarge EPYC. Same ES 9.4.1. `vectors.indexing.use_gpu` is the only diff." },
  { number: "01", Icon: Zap,      title: "Indexing race", headline: "GPU wins · big",
    detail: "On 100K × 1536-d Rally vectors: 24× end-to-end (16.6× ingest + 106× force-merge). Recall comparable to CPU HNSW — same answer quality, faster build." },
  { number: "02", Icon: Layers,   title: "Side-by-Side",  headline: "Throughput · workflow · architecture",
    detail: "Live charts + the cuVS CAGRA→HNSW pipeline; the JNI bridge that makes Elastic ↔ NVIDIA work." },
  { number: "—",  Icon: Sparkles, title: "Elastic",        headline: "From a faster index to a faster business",
    detail: "Pillars · 4-tier platform stack · same vectors fan out to 4 consumers · SEC-EDGAR data pipeline." },
  { number: "03", Icon: Search,   title: "Data Interface", headline: "One index, two audiences",
    detail: "Analyst search vs developer API · cURL/Python/Dev Tools · sector chips · 70-100 ms kNN over 93K chunks." },
  { number: "04", Icon: Bot,      title: "Agentic Action", headline: "Reason · retrieve · synthesise",
    detail: "finance-analyst agent on Sonnet 4.6 + custom finance.* tools — 26 → 3 LLM calls on cross-company comparisons." },
  { number: "—",  Icon: Workflow, title: "Workflows",      headline: "Agents on autopilot",
    detail: "Daily 10-K AI-Risk Digest workflow calls the same agent on a schedule, writes back the digest. Two-way bridge." },
];

export function Chapter05_Conclusion() {
  return (
    <ChapterShell
      number="05"
      title="The Full Stack"
      subtitle="What we built today, and where it goes next."
    >
      <div className="space-y-6">
        {/* Foundation moment — the one strong GPU callback */}
        <section className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5">
          <div className="flex items-baseline gap-3 mb-3 flex-wrap">
            <h3 className="text-base font-semibold text-slate-100">It all sits on GPU-accelerated indexing</h3>
            <span className="text-xs text-slate-400 leading-relaxed">— strip away the agent, the workflow, the dashboard, and you're left with one vector layer. How fast you can rebuild that layer changes the character of everything above it.</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Without GPU */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-amber-300" />
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">On CPU-only indexing</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
                <FoundationBullet Icon={Clock}    head="Re-ingest weekly, maybe quarterly.">Your agent answers from filings the analyst already read last Monday.</FoundationBullet>
                <FoundationBullet Icon={Layers}   head="Force-merge takes hours.">Index windows interrupt search — choose between fresh data and a responsive app.</FoundationBullet>
                <FoundationBullet Icon={Database} head="12+ nodes to hit a 12-hr SLA.">$1.75M annual baseline at enterprise scale (the chapter-02 number).</FoundationBullet>
                <FoundationBullet Icon={Cpu}      head="Adding a corpus = a capacity-planning exercise.">Every new data source is a quarter-long project.</FoundationBullet>
              </ul>
            </div>

            {/* With GPU */}
            <div className="rounded-xl border border-[var(--color-elastic)]/40 bg-[var(--color-elastic)]/[0.06] p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={14} className="text-[var(--color-elastic)]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-elastic)]">On GPU-accelerated indexing</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
                <FoundationBullet Icon={Clock}    head="Re-ingest in minutes." accent>Agents read filings the morning they drop. The chapter-04.5 daily digest is just one consequence.</FoundationBullet>
                <FoundationBullet Icon={Layers}   head="Force-merge in seconds." accent><span className="font-mono text-[var(--color-elastic)]">50×</span> faster than CPU. Re-index without interrupting the day.</FoundationBullet>
                <FoundationBullet Icon={Database} head="1.2 nodes per SLA." accent><span className="font-mono text-[var(--color-elastic)]">89%</span> lower TCO. The savings buys an LLM tier upgrade or 5× more inference.</FoundationBullet>
                <FoundationBullet Icon={Zap}      head="Adding a corpus = a config change." accent>Russell 2000, FTSE, internal-research wiki — same pipeline, same speed.</FoundationBullet>
              </ul>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 italic mt-4 text-center">
            Everything you saw in chapters 03 / 04 / workflows queries the same <span className="font-mono text-slate-400">sec_10k_2026</span> index from chapter 01. The agent isn't impressive on stale data — and stale data is what you get when re-indexing is expensive.
          </p>
        </section>

        {/* The story arc — 7 cards now incl. Workflows */}
        <section>
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">The story arc</div>
          <div className="grid grid-cols-4 gap-3">
            {RECAP.map((r, i) => (
              <motion.div
                key={r.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-mono font-bold text-[var(--color-elastic)]">{r.number}</span>
                  <r.Icon size={13} className="text-slate-400" />
                  <span className="text-xs font-semibold text-slate-200">{r.title}</span>
                </div>
                <div className="text-sm font-semibold text-slate-100">{r.headline}</div>
                <p className="text-xs text-slate-400 mt-1 leading-snug">{r.detail}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Closing CTA — deck p.25 style */}
        <section>
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">Get started with Elastic + NVIDIA cuVS</div>
          <div className="grid grid-cols-3 gap-3">
            <CTA
              n="01"
              Icon={BookOpen}
              title="Read the blog"
              detail="The architecture, use cases, and benchmark methodology — straight from Elastic Search Labs."
              href="https://www.elastic.co/search-labs/blog/elasticsearch-gpu-accelerated-vector-indexing-nvidia"
              hrefLabel="elastic.co/search-labs"
            />
            <CTA
              n="02"
              Icon={Github}
              title="Explore the code"
              detail="The open-source Elasticsearch GPU plugin, cuvs-java bindings, and Workflow library — all OSS."
              href="https://github.com/elastic/elasticsearch"
              hrefLabel="github.com/elastic"
            />
            <CTA
              n="03"
              Icon={Rocket}
              title="Deploy with the blueprint"
              detail="NVIDIA blueprint for a validated, enterprise-ready deployment combining Elastic + NVIDIA infrastructure."
              href="https://build.nvidia.com/"
              hrefLabel="NVIDIA Blueprints"
            />
          </div>
        </section>

        {/* Sign-off */}
        <div className="text-center pt-4">
          <div className="inline-flex items-center gap-3 text-xs text-slate-500">
            <span className="px-2 py-1 rounded bg-slate-800/60">elastic</span>
            <span className="opacity-50">×</span>
            <span className="px-2 py-1 rounded bg-slate-800/60 text-[var(--color-nvidia)]">NVIDIA</span>
            <span className="ml-2">· Sovereign AI · Context Engineering Anywhere</span>
          </div>
        </div>
      </div>
    </ChapterShell>
  );
}

function FoundationBullet({ Icon, head, accent, children }: { Icon: typeof Clock; head: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Icon size={12} className={`mt-0.5 shrink-0 ${accent ? "text-[var(--color-elastic)]" : "text-amber-300/70"}`} />
      <div>
        <span className={`font-semibold ${accent ? "text-slate-100" : "text-slate-200"}`}>{head}</span>{" "}
        <span className="text-slate-400">{children}</span>
      </div>
    </li>
  );
}

function CTA({ n, Icon, title, detail, href, hrefLabel }: {
  n: string; Icon: typeof BookOpen; title: string; detail: string; href: string; hrefLabel: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group rounded-2xl border border-slate-700/60 bg-slate-900/40 hover:border-[var(--color-elastic)]/40 hover:bg-[var(--color-elastic)]/[0.04] p-5 transition-colors flex flex-col"
    >
      <div className="flex items-start justify-between mb-3">
        <Icon size={18} className="text-[var(--color-elastic)]" />
        <span className="text-2xl font-mono font-bold text-slate-700 group-hover:text-slate-500 transition-colors">{n}</span>
      </div>
      <h4 className="text-base font-semibold text-slate-100 mb-1">{title}</h4>
      <p className="text-xs text-slate-400 leading-relaxed flex-1">{detail}</p>
      <div className="mt-3 pt-3 border-t border-slate-700/40 text-[11px] text-[var(--color-elastic)] flex items-center gap-1.5 font-mono">
        {hrefLabel}
        <ExternalLink size={11} className="opacity-70 group-hover:opacity-100" />
      </div>
    </a>
  );
}
