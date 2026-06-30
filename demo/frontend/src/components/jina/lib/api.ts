import { useCallback, useEffect, useState } from "react";

// ─────────────── types (mirror /api/jina/* responses) ───────────────────────
export interface MMHit {
  id: string;
  score: number;
  doc_id: string;
  caption: string;
  file: string;
}
export interface MMResult {
  took_ms: number;
  space: "image" | "caption";
  hits: MMHit[];
}

export interface Analyst {
  id: string;
  name: string;
  clearance: string;
  compartments: string[];
  noforn: boolean;
  label: string;
}
export interface FacetBucket {
  key: string | number;
  count: number;
}
export interface DlsHit {
  parent_id: string;
  doc_title: string;
  journal: string;
  year: number;
  classification: string;
  compartments: string[];
  caveats: string[];
  source_type: string;
  score: number;
  passage: string;
  section: string;
}
export interface Figure {
  parent_id: string;
  doc_title: string;
  media_path: string;
  page: number;
  classification: string;
  compartments: string[];
  caveats: string[];
  score: number;
}
export interface Accessible {
  docs: number;
  chunks: number;
  classification: FacetBucket[];
  journal: FacetBucket[];
  source_type: FacetBucket[];
  year: FacetBucket[];
}
export interface DlsResult {
  analyst: Analyst;
  hits: DlsHit[];
  figures: Figure[];
  accessible: Accessible;
  took_ms?: number;
}

export const imageUrl = (file: string) => `/api/jina/image/${file}`;
export const figUrl = (mediaPath: string) => `/api/jina/figimg/${mediaPath}`;
export const pdfUrl = (parentId: string) => `/api/jina/pdf/${parentId}`;

// ─────────────── hooks ───────────────────────────────────────────────────────
export function useAnalysts() {
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  useEffect(() => {
    fetch("/api/jina/analysts")
      .then((r) => r.json())
      .then(setAnalysts)
      .catch(() => setAnalysts([]));
  }, []);
  return analysts;
}

export function useMultimodalSearch() {
  const [result, setResult] = useState<MMResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string, space: "image" | "caption" = "image") => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/jina/multimodal/search?q=${encodeURIComponent(q)}&space=${space}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      setResult(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, search };
}

export function useDlsSearch() {
  const [result, setResult] = useState<DlsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string, analyst: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/jina/search?q=${encodeURIComponent(q)}&analyst=${encodeURIComponent(analyst)}`);
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

export interface AnswerSource {
  parent_id: string;
  doc_title: string;
  classification: string;
  compartments: string[];
  caveats: string[];
  journal: string;
  year: number;
}
export interface AnswerResult {
  analyst: { id: string; name: string; clearance: string; label: string };
  answer: string;
  sources: AnswerSource[];
}

export function useDlsAnswer() {
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (q: string, analyst: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch(`/api/jina/analyst/answer?q=${encodeURIComponent(q)}&analyst=${encodeURIComponent(analyst)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      setResult(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => setResult(null), []);
  return { result, loading, error, ask, reset };
}

// Classification → tailwind tone (badge)
export const CLS_TONE: Record<string, string> = {
  U: "bg-slate-600/30 text-slate-300 ring-slate-500/40",
  CUI: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  C: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  S: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  TS: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};
export const CLS_LABEL: Record<string, string> = {
  U: "UNCLASSIFIED", CUI: "CUI", C: "CONFIDENTIAL", S: "SECRET", TS: "TOP SECRET",
};
