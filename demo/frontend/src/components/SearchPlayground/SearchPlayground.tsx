import { useState } from "react";
import { Search, Clock } from "lucide-react";

type RetrievalMode = "bm25" | "semantic" | "hybrid";

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  score: number;
  source: string;
  index: string;
}

export function SearchPlayground() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<RetrievalMode>("hybrid");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState<{
    embed: number;
    search: number;
    total: number;
  } | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
      setLatency(data.latency ?? null);
    } catch {
      // Mock results for development
      setResults([
        {
          id: "1",
          title: "Block B3 — Soil Station #17",
          snippet:
            "Moisture: 31% (down 12% from 30-day avg), EC rising. Similar to Cook Farm Station 22, Aug 2012 (pre-drought pattern).",
          score: 0.943,
          source: "historical",
          index: "vineyard-soil",
        },
        {
          id: "2",
          title: "Block B7 — Soil Station #31",
          snippet:
            "Moisture: 28%, Temperature anomaly at 24\" depth. Trending toward drought threshold.",
          score: 0.891,
          source: "historical",
          index: "vineyard-soil",
        },
        {
          id: "3",
          title: "Regional Context — Virginia Wine Region",
          snippet:
            "20-year SoMo.ml soil moisture trend shows drying pattern across VA wine region, consistent with current readings.",
          score: 0.847,
          source: "historical",
          index: "vineyard-soil",
        },
      ]);
      setLatency({ embed: 12, search: 28, total: 47 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-1">Search Playground</h2>
      <p className="text-sm text-slate-400 mb-6">
        Hybrid retrieval across all vineyard indices &middot; 615K+ vectors
      </p>

      {/* Search Input */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="blocks showing drought stress similar to 2012 conditions"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Retrieval Mode Toggle */}
      <div className="flex gap-1 mb-6 bg-slate-900 p-1 rounded-lg w-fit">
        {(["bm25", "semantic", "hybrid"] as RetrievalMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              mode === m
                ? "bg-emerald-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {m === "bm25" ? "BM25" : m === "semantic" ? "Semantic" : "Hybrid (RRF)"}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-3">
        {results.map((r, i) => (
          <div
            key={r.id}
            className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono">
                  {i + 1}.
                </span>
                <h3 className="text-sm font-semibold text-slate-200">
                  {r.title}
                </h3>
              </div>
              <span className="text-xs font-mono text-emerald-400">
                {r.score.toFixed(3)}
              </span>
            </div>
            <p className="text-sm text-slate-400 ml-5">{r.snippet}</p>
            <div className="flex gap-2 ml-5 mt-2">
              <span className="text-xs px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">
                {r.index}
              </span>
              <span className="text-xs px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">
                {r.source}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Latency */}
      {latency && (
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <Clock size={12} />
          <span>
            Total: {latency.total}ms (embed: {latency.embed}ms + search:{" "}
            {latency.search}ms)
          </span>
          <span>
            Retrieved: {results.length} of 615K+ docs &middot;{" "}
            {mode === "hybrid"
              ? "Hybrid RRF (BM25 + kNN)"
              : mode === "semantic"
              ? "kNN Vector Search"
              : "BM25 Keyword"}
          </span>
        </div>
      )}
    </div>
  );
}
