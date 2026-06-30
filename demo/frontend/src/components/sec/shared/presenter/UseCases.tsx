import { motion } from "framer-motion";
import {
  Film, FileText, Image as ImageIcon, ShoppingBag, Music, Atom,
  Search, GitBranch, Brain,
} from "lucide-react";

/**
 * Pulled from the cuVS deck (page 9): the use cases GPU-accelerated vector
 * search unlocks. Semantic-search row + data-mining row.
 */
const SEMANTIC = [
  { Icon: Film,        title: "Video search",          line: "frame embeddings at scale" },
  { Icon: FileText,    title: "Document semantic search", line: "10-Ks, contracts, knowledge bases" },
  { Icon: ImageIcon,   title: "Image similarity",      line: "catalog, defects, medical" },
  { Icon: ShoppingBag, title: "Recommenders",          line: "user-item · session-based" },
  { Icon: Music,       title: "Audio fingerprinting",  line: "voice, ambient, music" },
  { Icon: Atom,        title: "Molecular search",      line: "drug discovery · materials" },
];

const MINING = [
  { Icon: Search,    title: "Exploratory analysis",   line: "cluster + drill into raw vectors" },
  { Icon: GitBranch, title: "k-NN graph construction", line: "feed downstream ML pipelines" },
  { Icon: Brain,     title: "Machine learning",       line: "feature build + retrieval-augmented training" },
];

export function UseCases() {
  return (
    <div className="grid grid-cols-2 gap-5 h-full">
      <Column title="Semantic search · latency-bound" items={SEMANTIC} tone="elastic" />
      <Column title="Data mining · throughput-bound"   items={MINING}   tone="nvidia" />
    </div>
  );
}

function Column({
  title, items, tone,
}: {
  title: string;
  items: { Icon: typeof Film; title: string; line: string }[];
  tone: "elastic" | "nvidia";
}) {
  const accent = tone === "elastic" ? "text-[var(--color-elastic)]" : "text-[var(--color-nvidia)]";
  const ring   = tone === "elastic" ? "border-[var(--color-elastic)]/20" : "border-[var(--color-nvidia)]/20";
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${accent} mb-3`}>{title}</div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-start gap-3 rounded-lg border ${ring} bg-slate-900/40 px-3 py-2`}
          >
            <it.Icon size={16} className={`mt-0.5 ${accent}`} />
            <div>
              <div className="text-sm font-semibold text-slate-100">{it.title}</div>
              <div className="text-xs text-slate-500">{it.line}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
