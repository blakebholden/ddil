// Thin client for the kit backend's /api/ccs/* endpoints. The HQ console is just
// a richer front-end for the same CCS orchestration the iPad's edge view uses.

export interface CcsState {
  ech_url: string; alias: string; box_proxy: string; mode: string; index: string;
}
export interface CcsStatus {
  connected: boolean; registered: boolean; alias: string;
}
export interface CcsSearch {
  scope: string; edge_registered: boolean; took_ms: number; total: number;
  counts: { cloud: number; edge: number };
  clusters: { total?: number; successful?: number; skipped?: number };
  hits: { id: string; cluster: 'cloud' | 'edge'; title?: string; text: string }[];
}

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

export const ccsState = () => getJSON<CcsState>('/api/ccs/state');
export const ccsStatus = () => getJSON<CcsStatus>('/api/ccs/status');
export const ccsSearch = (scope: 'local' | 'federated' = 'federated', q = '') =>
  getJSON<CcsSearch>(`/api/ccs/search?scope=${scope}&q=${encodeURIComponent(q)}`);

export async function ccsSynchronise(): Promise<{ ok: boolean; connected: boolean }> {
  const r = await fetch('/api/ccs/synchronise', { method: 'POST' });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

export async function ccsDisconnect(): Promise<void> {
  await fetch('/api/ccs/disconnect', { method: 'POST' });
}
