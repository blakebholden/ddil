/**
 * Two pricing models live here. They answer different questions; don't mix them.
 *
 *  1. AWS on-demand hourly rates → "what did this demo box cost me right now?"
 *     Useful for showing $0.02 etc. NEVER call this TCO.
 *
 *  2. Enterprise TCO model (mirrors "Cost Model for Elasticsearch GPUs.xlsx")
 *     → annual hardware + system SW + Elasticsearch SW + NVAIE, sized by the
 *     number of nodes you need to hit an indexing SLA. This is what the deck's
 *     78% / spreadsheet's 89.4% comes from.
 */

/* ─────────────── AWS on-demand (us-east-2, May 2026) ─────────────── */
// Bedrock model pricing kept here so TradeoffPanel can compute live $ per answer.
// Update if rates shift. Sonnet/Opus rates as of May 2026.
export const BEDROCK_PRICING = {
  sonnet_4_6: { input: 3.0,  output: 15.0 },   // per million tokens
  opus_4_6:   { input: 15.0, output: 75.0 },
  haiku_4_5:  { input: 1.0,  output: 5.0 },
} as const;
export const HOURLY_USD = {
  gpu: 1.323,   // g6.4xlarge (NVIDIA L4, 16 vCPU, 64 GB)
  cpu: 2.014,   // g6.8xlarge (32 vCPU AMD EPYC, 128 GB)
} as const;

export const HARDWARE = {
  gpu: { label: "g6.4xlarge", detail: "NVIDIA L4 · 16 vCPU · 64 GB", rate: HOURLY_USD.gpu },
  cpu: { label: "g6.8xlarge", detail: "32 vCPU AMD EPYC · 128 GB",   rate: HOURLY_USD.cpu },
} as const;

export interface AwsJobCost {
  gpuUsd: number;
  cpuUsd: number;
  ratio: number;
  savingsPct: number;     // % less you pay for *this* job using GPU box vs CPU box
}

/** AWS per-second math for one indexing job. NOT a TCO claim. */
export function awsJobCost(gpuTotalMs: number, cpuTotalMs: number): AwsJobCost {
  if (!gpuTotalMs || !cpuTotalMs) return { gpuUsd: 0, cpuUsd: 0, ratio: 0, savingsPct: 0 };
  const perSecGpu = HOURLY_USD.gpu / 3600;
  const perSecCpu = HOURLY_USD.cpu / 3600;
  const gpuUsd = (gpuTotalMs / 1000) * perSecGpu;
  const cpuUsd = (cpuTotalMs / 1000) * perSecCpu;
  return {
    gpuUsd, cpuUsd,
    ratio: cpuUsd / gpuUsd,
    savingsPct: (1 - gpuUsd / cpuUsd) * 100,
  };
}

/* ─────────────── Enterprise TCO model ─────────────── */
/**
 * Annual per-node cost components — matches the "Assumptions" tab of
 * Cost Model for Elasticsearch GPUs.xlsx.
 */
export const ANNUAL_NODE_USD = {
  cpu: {
    physical: 15_760,
    systemSw: 4_957,
    elasticSw: 114_900,
    nvaie: 0,
    get total() { return this.physical + this.systemSw + this.elasticSw + this.nvaie; },  // 135,617
  },
  gpu: {
    physical: 19_600,    // includes 2× L4 @ $3,850 in the spreadsheet model
    systemSw: 4_957,
    elasticSw: 114_900,
    nvaie: 8_960,
    get total() { return this.physical + this.systemSw + this.elasticSw + this.nvaie; },  // 148,417
  },
} as const;

/** Defaults from the spreadsheet's Assumptions tab. */
export const TCO_DEFAULTS = {
  totalVectors: 10_000_000_000,   // 10 billion
  vectorDim: 1024,
  slaHours: 12,
  /** Per-node measured throughputs from the spreadsheet (Cost Model row 2/3). */
  benchmarkVps: { cpu: 17_919, gpu: 185_600 },
} as const;

export interface TcoResult {
  cpuHoursTotal: number;
  gpuHoursTotal: number;
  cpuNodes: number;
  gpuNodes: number;
  cpuAnnualUsd: number;
  gpuAnnualUsd: number;
  savingsUsd: number;
  savingsPct: number;
  speedupHours: number;       // how much faster GPU indexes on a single node
}

/**
 * Compute the enterprise TCO comparison.
 *   nodes_needed = (vectors / vps / 3600) / slaHours
 *   annual_cost  = nodes_needed × per_node_annual
 *   savings_pct  = 1 - gpu_total / cpu_total
 *
 * Pass measured throughputs from a live race to get "what we just measured
 * projected to enterprise scale". Pass undefined to use spreadsheet baselines.
 */
export function computeTco(opts?: Partial<{
  totalVectors: number;
  slaHours: number;
  cpuVps: number;
  gpuVps: number;
}>): TcoResult {
  const totalVectors = opts?.totalVectors ?? TCO_DEFAULTS.totalVectors;
  const slaHours = opts?.slaHours ?? TCO_DEFAULTS.slaHours;
  const cpuVps = opts?.cpuVps && opts.cpuVps > 0 ? opts.cpuVps : TCO_DEFAULTS.benchmarkVps.cpu;
  const gpuVps = opts?.gpuVps && opts.gpuVps > 0 ? opts.gpuVps : TCO_DEFAULTS.benchmarkVps.gpu;

  const cpuHoursTotal = totalVectors / cpuVps / 3600;
  const gpuHoursTotal = totalVectors / gpuVps / 3600;
  const cpuNodes = cpuHoursTotal / slaHours;
  const gpuNodes = gpuHoursTotal / slaHours;
  const cpuAnnualUsd = cpuNodes * ANNUAL_NODE_USD.cpu.total;
  const gpuAnnualUsd = gpuNodes * ANNUAL_NODE_USD.gpu.total;
  const savingsUsd = cpuAnnualUsd - gpuAnnualUsd;
  return {
    cpuHoursTotal, gpuHoursTotal,
    cpuNodes, gpuNodes,
    cpuAnnualUsd, gpuAnnualUsd,
    savingsUsd,
    savingsPct: cpuAnnualUsd > 0 ? (savingsUsd / cpuAnnualUsd) * 100 : 0,
    speedupHours: cpuHoursTotal - gpuHoursTotal,
  };
}

/* ─────────────── Formatters ─────────────── */
export function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  const abs = Math.abs(n);
  if (abs < 0.01)  return `$${n.toFixed(4)}`;
  if (abs < 10)    return `$${n.toFixed(3)}`;
  if (abs < 1000)  return `$${n.toFixed(2)}`;
  if (abs < 1_000_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${(n / 1_000_000).toFixed(2)}M`;
}

export function fmtVectors(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1000)          return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}
