import { motion } from "framer-motion";
import { Database, Bot, Code2, Zap } from "lucide-react";

/**
 * Speaker-ready talking points distilled from the deck:
 *  - The Proliferation of Unstructured Data (page 5 / 14)
 *  - Why Elastic for Search & AI (page 15)
 *  - Elastic is the search and retrieval layer (page 16)
 *  - 5-6× price-performance + 78% TCO (pages 11/12)
 */

const STATS = [
  { value: "175 ZB", label: "data generated in 2025",     sub: "IDC Global DataSphere Forecast" },
  { value: "90%",    label: "of enterprise data is unstructured", sub: "IDC White Paper" },
  { value: "78%",    label: "lower indexing TCO",          sub: "Elastic + NVIDIA Webinar 2026" },
  { value: "5-6×",   label: "better price-performance",    sub: "vs CPU-only baseline" },
];

const PILLARS = [
  { Icon: Database, title: "Data explosion",  body: "Logs, docs, emails, images, code. Most of the value sits in unstructured form — and it's only growing." },
  { Icon: Zap,      title: "Real-time bar",   body: "Agentic pipelines stall waiting for context. Sub-100ms retrieval is the new floor, and CPU HNSW can't get there at scale." },
  { Icon: Bot,      title: "Agentic requirements", body: "Agents can't function on raw text. Everything has to become vectors, indexed, fresh, with sub-second similarity." },
  { Icon: Code2,    title: "Zero-code-change",     body: "`vectors.indexing.use_gpu: true`. That's the entire diff. Same Elasticsearch, same APIs, same queries." },
];

export function WhyItMatters() {
  return (
    <div className="grid grid-cols-2 gap-5 h-full">
      {/* Left: big stats */}
      <div className="grid grid-cols-2 gap-3">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 flex flex-col justify-between"
          >
            <div className="text-3xl font-mono font-bold text-[var(--color-elastic)] tracking-tight">{s.value}</div>
            <div>
              <div className="text-xs text-slate-200 mt-1">{s.label}</div>
              <div className="text-[10px] text-slate-500 italic mt-0.5">{s.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Right: pillars */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--color-elastic)] mb-3">
          Why GPU-accelerated search now
        </div>
        <div className="space-y-2.5">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-start gap-3"
            >
              <div className="mt-0.5 text-[var(--color-elastic)]"><p.Icon size={16} /></div>
              <div>
                <div className="text-sm font-semibold text-slate-100">{p.title}</div>
                <div className="text-xs text-slate-400">{p.body}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
