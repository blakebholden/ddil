import { useCallback, useEffect, useState } from "react";

export interface Hit {
  id: string;
  score: number;
  ticker: string;
  company: string;
  sector: string;
  cik: string;
  accession: string;
  source_url: string;
  chunk_idx: number;
  text: string;
  snippet: string;
}

export interface SearchResult {
  took_ms: number;
  total: number;
  hits: Hit[];
  request: { method: string; path: string; body: Record<string, unknown> };
  embed_model: string;
  embed_dims: number;
}

export interface Sector { name: string; count: number; }

export function useFinanceSearch() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [result, setResult]   = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/finance/sectors")
      .then(r => r.json())
      .then(setSectors)
      .catch(e => setError(String(e)));
  }, []);

  const search = useCallback(async (query: string, opts?: { sectors?: string[]; size?: number }) => {
    if (!query.trim()) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/finance/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, sectors: opts?.sectors, size: opts?.size ?? 8 }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      setResult(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { sectors, result, loading, error, search };
}
