import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Image as ImageIcon, Type } from "lucide-react";
import { useMultimodalSearch, imageUrl } from "../lib/api";

const EXAMPLES = [
  "a red square",
  "something blue and round",
  "green triangle",
  "horizontal stripes",
  "a yellow star",
];

export function MultimodalSearch() {
  const { result, loading, error, search } = useMultimodalSearch();
  const [query, setQuery] = useState("");
  const [space, setSpace] = useState<"image" | "caption">("image");

  const submit = (q?: string, sp?: "image" | "caption") => {
    const text = q ?? query;
    const s = sp ?? space;
    if (!text.trim()) return;
    setQuery(text);
    search(text, s);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-1 text-xs uppercase tracking-[0.2em] text-violet-400 font-semibold">
        Track 1 · One vector space
      </div>
      <h2 className="text-3xl font-bold text-slate-100 mb-2">Search images by typing words</h2>
      <p className="text-sm text-slate-400 mb-6 max-w-2xl">
        Text and images are embedded by the local Jina omni model into the <em>same</em> vector
        space — so a typed query retrieves pictures directly. One native Elasticsearch kNN; the
        cluster embeds your query through the on-box inference endpoint. Fully air-gapped.
      </p>

      {/* Search bar + space toggle */}
      <div className="flex gap-3 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe an image…"
            className="w-full pl-11 pr-28 py-3.5 bg-slate-900/60 border border-slate-700/60 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white text-sm font-medium flex items-center gap-1.5"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </form>
        <div className="flex items-center rounded-xl border border-slate-700/60 overflow-hidden">
          <ToggleBtn active={space === "image"} onClick={() => { setSpace("image"); submit(undefined, "image"); }} Icon={ImageIcon} label="Image vectors" />
          <ToggleBtn active={space === "caption"} onClick={() => { setSpace("caption"); submit(undefined, "caption"); }} Icon={Type} label="Caption vectors" />
        </div>
      </div>

      {!result && (
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 self-center">Try:</span>
          {EXAMPLES.map((q) => (
            <button
              key={q}
              onClick={() => submit(q)}
              className="text-xs px-3 py-1 rounded-full border border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300 mb-4">{error}</div>
      )}

      {result && (
        <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
          <span>{result.took_ms} ms</span>
          <span>·</span>
          <span>{result.hits.length} images</span>
          <span>·</span>
          <span className="font-mono text-[10px]">kNN over {space === "image" ? "image_vector" : "caption_vector"} · query embedded by ES inference</span>
        </div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-3 gap-4"
          >
            {result.hits.map((h, i) => (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-slate-700/60 bg-slate-900/40 overflow-hidden group"
              >
                <div className="aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
                  <img
                    src={imageUrl(h.file)}
                    alt={h.caption}
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => { (e.currentTarget.style.opacity = "0.15"); }}
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm text-slate-300 leading-snug">{h.caption}</p>
                  <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-slate-500">
                    <span>{h.doc_id}</span>
                    <span>score {h.score.toFixed(3)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToggleBtn({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: typeof ImageIcon; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-3.5 text-xs font-medium transition-colors ${
        active ? "bg-violet-500/20 text-violet-300" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
      }`}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
