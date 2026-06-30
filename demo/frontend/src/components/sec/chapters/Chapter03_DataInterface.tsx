import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, ExternalLink, Building2, Clock, User, Code2 } from "lucide-react";
import { ChapterShell } from "../shared/ChapterShell";
import { ShowTheCall } from "../shared/finance/ShowTheCall";
import { KibanaButtons } from "../shared/finance/KibanaButtons";
import { useFinanceSearch, type Hit } from "../hooks/useFinanceSearch";
import { useFinanceConfig } from "../lib/financeConfig";

const SECTOR_TONE: Record<string, string> = {
  "Financials":              "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  "Information Technology":  "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  "Health Care":             "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  "Industrials":             "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  "Consumer Discretionary":  "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30",
  "Consumer Staples":        "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  "Energy":                  "bg-yellow-500/15 text-yellow-300 ring-yellow-500/30",
  "Materials":               "bg-stone-500/15 text-stone-300 ring-stone-500/30",
  "Utilities":               "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
  "Real Estate":             "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  "Communication Services":  "bg-pink-500/15 text-pink-300 ring-pink-500/30",
};

const EXAMPLE_QUERIES = [
  "AI model risk and governance disclosures",
  "Commercial real estate exposure",
  "Supply chain disruption risk in semiconductors",
  "Climate-related transition risk",
  "Cybersecurity incident response",
];

export function Chapter03_DataInterface() {
  const { sectors, result, loading, error, search } = useFinanceSearch();
  const { esUrl } = useFinanceConfig();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const submit = (q?: string) => {
    const text = q ?? query;
    if (!text.trim()) return;
    setQuery(text);
    search(text, { sectors: picked.size ? Array.from(picked) : undefined });
  };

  const toggleSector = (s: string) => {
    const next = new Set(picked);
    next.has(s) ? next.delete(s) : next.add(s);
    setPicked(next);
  };

  return (
    <ChapterShell
      number="03"
      title="Data Interface"
      subtitle="The same vectors we just indexed, queried by a developer two ways: directly via the application frontend, or programmatically against the Elasticsearch API."
      headerRight={<KibanaButtons />}
    >
      {/* Slim segue banner — re-anchors the value from chapter 02.5 */}
      <div className="mb-4 rounded-xl border border-[var(--color-elastic)]/30 bg-[var(--color-elastic)]/[0.04] px-4 py-2.5 flex items-center gap-3 text-xs">
        <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--color-elastic)]">Same index, two consumers</span>
        <span className="flex items-center gap-1.5 text-slate-300"><User size={12} className="text-[var(--color-elastic)]" /> Analyst on the left</span>
        <span className="text-slate-600">·</span>
        <span className="flex items-center gap-1.5 text-slate-300"><Code2 size={12} className="text-[var(--color-nvidia)]" /> Developer on the right</span>
        <span className="text-slate-500 italic ml-auto hidden md:inline">One API · one platform · identical answers</span>
      </div>

      <div className="grid grid-cols-[1fr_460px] gap-6 h-full">
        {/* LEFT: search UI + results */}
        <div className="space-y-4">
          {/* Search input */}
          <form
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            className="relative"
          >
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 503 S&P 500 10-K filings semantically…"
              className="w-full pl-11 pr-32 py-3.5 bg-slate-900/60 border border-slate-700/60 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[var(--color-elastic)]/50"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg bg-[var(--color-elastic)] hover:bg-[var(--color-elastic-dark)] disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-sm font-medium flex items-center gap-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Search
            </button>
          </form>

          {/* Example queries */}
          {!result && (
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 self-center">Try:</span>
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => { setQuery(q); submit(q); }}
                  className="text-xs px-3 py-1 rounded-full border border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Sector chips */}
          {sectors.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sectors.map((s) => {
                const on = picked.has(s.name);
                return (
                  <button
                    key={s.name}
                    onClick={() => toggleSector(s.name)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 transition-colors ${
                      on
                        ? (SECTOR_TONE[s.name] ?? "bg-slate-700/40 text-slate-200 ring-slate-600")
                        : "bg-slate-900/40 text-slate-400 ring-slate-700/50 hover:text-slate-200"
                    }`}
                  >
                    {s.name}
                    <span className={`text-[10px] font-mono ${on ? "opacity-80" : "opacity-50"}`}>{s.count.toLocaleString()}</span>
                  </button>
                );
              })}
              {picked.size > 0 && (
                <button onClick={() => setPicked(new Set())} className="text-[11px] text-slate-500 hover:text-slate-300 px-2">clear</button>
              )}
            </div>
          )}

          {/* Status strip */}
          {result && (
            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Clock size={12} /> {result.took_ms} ms
              </span>
              <span>·</span>
              <span>{result.hits.length} hits</span>
              <span>·</span>
              <span className="font-mono text-[10px]">{result.embed_dims}-d via {result.embed_model}</span>
              <span>·</span>
              <span className="text-[10px] flex items-center gap-1 text-slate-500">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-nvidia)]/80" />
                queried against the GPU-built <code className="font-mono text-slate-300">sec_10k_2026</code> index (chapter 01)
              </span>
            </div>
          )}

          {/* Results */}
          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-340px)] pr-1">
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">
                {error}
              </div>
            )}
            <AnimatePresence>
              {result?.hits.map((h, i) => (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <ResultCard hit={h} />
                </motion.div>
              ))}
            </AnimatePresence>
            {!result && !loading && (
              <div className="text-center text-slate-500 italic py-12 text-sm">
                Run a query against the SEC 10-K corpus. The query is embedded by the configured model, then a kNN runs over ~93K chunks in 70-100 ms.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: show-the-call + metadata */}
        <div className="space-y-3">
          {result && (
            <ShowTheCall method={result.request.method} path={result.request.path} body={result.request.body as Record<string, unknown>} esHost={esUrl || undefined} />
          )}
          {!result && (
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-6 text-sm text-slate-400 leading-relaxed">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">Same data, two interfaces</h3>
              <p className="mb-3">The result panel on the left is what the <em>application user</em> sees. The panel here shows what the <em>developer</em> writes against the Elastic API to produce that same answer.</p>
              <p className="mb-3">Query embedding runs through the configured embedder; the kNN executes on the GPU-backed <span className="font-mono text-[var(--color-nvidia)]">sec_10k_2026</span> index we built in chapter 01.</p>
              <p className="text-xs text-slate-500 italic">After you search, the cURL, Python and Kibana Dev Tools tabs each give you the exact request body you can paste.</p>
            </div>
          )}
        </div>
      </div>
    </ChapterShell>
  );
}

function ResultCard({ hit }: { hit: Hit }) {
  const tone = SECTOR_TONE[hit.sector] ?? "bg-slate-700/40 text-slate-300 ring-slate-600";
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between mb-2 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm font-bold text-[var(--color-elastic)]">{hit.ticker}</span>
          <span className="text-slate-300 text-sm truncate">{hit.company}</span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ring-1 ${tone} shrink-0`}>
            {hit.sector}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] text-slate-500 font-mono">score {hit.score.toFixed(3)}</span>
          {hit.source_url && (
            <a
              href={hit.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-slate-500 hover:text-slate-300"
              title="View source 10-K filing on SEC.gov"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">{hit.snippet}</p>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 font-mono">
        <span className="flex items-center gap-1"><Building2 size={10} /> CIK {hit.cik}</span>
        <span>·</span>
        <span>{hit.accession}</span>
        <span>·</span>
        <span>chunk #{hit.chunk_idx}</span>
      </div>
    </div>
  );
}
