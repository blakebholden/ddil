export function formatNumber(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return n.toLocaleString();
  return String(Math.round(n));
}

export function formatMs(ms: number): string {
  if (!ms || ms < 0) return "0";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}
