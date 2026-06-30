import { useCallback, useEffect, useState } from "react";

export interface CcsStatus {
  connected: boolean;
  registered: boolean;
  alias: string;
  detail: Record<string, unknown>;
}
export interface CcsHit {
  id: string;
  cluster: "cloud" | "edge";
  score: number;
  title?: string;
  text: string;
  source: Record<string, unknown>;
}
export interface CcsResult {
  scope: "local" | "federated";
  took_ms: number;
  total: number;
  counts: { cloud: number; edge: number };
  clusters: { total?: number; successful?: number; skipped?: number };
  hits: CcsHit[];
}
export interface CcsState {
  ech_url: string;
  alias: string;
  box_proxy: string;
  mode: string;
  index: string;
}

export function useCcsStatus(pollMs = 0) {
  const [status, setStatus] = useState<CcsStatus | null>(null);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/ccs/status");
      if (r.ok) setStatus(await r.json());
    } catch {
      /* offline */
    }
  }, []);
  useEffect(() => {
    refresh();
    if (pollMs > 0) {
      const t = setInterval(refresh, pollMs);
      return () => clearInterval(t);
    }
  }, [refresh, pollMs]);
  return { status, refresh };
}

export function useCcsState() {
  const [state, setState] = useState<CcsState | null>(null);
  useEffect(() => {
    fetch("/api/ccs/state").then((r) => r.json()).then(setState).catch(() => {});
  }, []);
  return state;
}

export async function synchronise(): Promise<boolean> {
  const r = await fetch("/api/ccs/synchronise", { method: "POST" });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()).connected;
}

export async function disconnect(): Promise<void> {
  await fetch("/api/ccs/disconnect", { method: "POST" });
}

export function useCcsSearch() {
  const [result, setResult] = useState<CcsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string, scope: "local" | "federated") => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/ccs/search?q=${encodeURIComponent(q)}&scope=${scope}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      setResult(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, search };
}
