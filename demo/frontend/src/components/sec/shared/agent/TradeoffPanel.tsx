import { useState } from "react";
import { Clock, Cpu, Coins, ExternalLink, TrendingDown, Sparkles, AlertTriangle, Users } from "lucide-react";
import type { RoundMetadata } from "../../hooks/useAgentChat";
import { SearchSpectrum } from "../diagrams/SearchSpectrum";
import { TraditionalComparison } from "./TraditionalComparison";

// Typical per-answer cost across a representative spread of finance-analyst
// questions (single lookup → multi-company comparison) on Sonnet 4.6.
// Used as the *stable* basis for annualized projections.
const TYPICAL_COST_PER_ANSWER = 0.60;
const QPD_PRESETS = [100, 1_000, 10_000, 100_000];

interface Props {
  meta: RoundMetadata;
  toolCallCount: number;
}

/**
 * Below-the-answer panel: pairs the live run's cost / latency with the
 * "Search is changing" spectrum + Elastic context-management story.
 *
 * Numbers cited:
 *   21–39% token reduction via dynamically loaded skills
 *   27–34% via top-snippets retrieval
 *   Up to 40% combined cost reduction
 *   30+ turn conversations without degradation
 *   — Elastic Search Labs (Agent Builder context management)
 */

// Per-million-token Bedrock pricing keyed off the model that actually answered.
// We resolve from meta.model returned by Agent Builder.
function priceFor(model: string | undefined): { input: number; output: number; label: string } {
  if (!model) return { input: 3.0, output: 15.0, label: "Sonnet 4.6 default" };
  if (model.includes("opus"))   return { input: 15.0, output: 75.0, label: "Opus" };
  if (model.includes("haiku"))  return { input: 1.0,  output: 5.0,  label: "Haiku" };
  return { input: 3.0, output: 15.0, label: "Sonnet" };
}

export function TradeoffPanel({ meta, toolCallCount }: Props) {
  const px = priceFor(meta.model);
  const inputCost  = (meta.inputTokens  ?? 0) / 1_000_000 * px.input;
  const outputCost = (meta.outputTokens ?? 0) / 1_000_000 * px.output;
  const cost = inputCost + outputCost;

  // Annual projection: queries-per-day × 365 × typical-cost-per-answer × (1 vs 0.6)
  const [qpd, setQpd] = useState(1_000);
  const annualBaseline  = qpd * 365 * TYPICAL_COST_PER_ANSWER;
  const annualOptimized = annualBaseline * 0.60;
  const annualSavings   = annualBaseline - annualOptimized;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5 space-y-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">The tradeoff in agentic search</h3>
          <p className="text-xs text-slate-400 mt-1">Autonomy isn't free — every extra reasoning hop costs tokens, time, and dollars. Context management is how Elastic keeps it bounded.</p>
        </div>
        <a
          href="https://www.elastic.co/search-labs/blog/elastic-agent-builder-ai-agents-context-management"
          target="_blank" rel="noreferrer"
          className="text-[10px] text-[var(--color-elastic)] hover:underline flex items-center gap-1 shrink-0"
        >
          Search Labs · context management <ExternalLink size={10} />
        </a>
      </div>

      {/* Row 2 — what the same job costs through every other approach we'd actually consider */}
      <TraditionalComparison meta={meta} toolCallCount={toolCallCount} />

      <div className="grid grid-cols-[1.1fr_1fr_1fr] gap-5">
        {/* Spectrum visual */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-2">Search is changing</div>
          <SearchSpectrum activeIndex={3} />
        </div>

        {/* This run's numbers */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={11} className="text-amber-400" /> This run's actual numbers
          </div>
          <div className="space-y-3">
            <RunStat Icon={Clock} label="Time to last token"
                     value={meta.timeToLastTokenMs ? `${(meta.timeToLastTokenMs / 1000).toFixed(1)} s` : "—"}
                     sub={meta.timeToFirstTokenMs ? `ttft ${(meta.timeToFirstTokenMs / 1000).toFixed(1)} s` : ""} />
            <RunStat Icon={Cpu} label="LLM round-trips"
                     value={meta.llmCalls ? `${meta.llmCalls}` : "—"}
                     sub={`${toolCallCount} tool call${toolCallCount === 1 ? "" : "s"}`} />
            <RunStat Icon={Coins} label="Tokens"
                     value={meta.inputTokens != null ? `${(meta.inputTokens / 1000).toFixed(0)}k in · ${(meta.outputTokens ?? 0).toLocaleString()} out` : "—"}
                     sub={meta.model || ""} />
            <RunStat Icon={Coins} label="Bedrock spend (this answer)"
                     value={cost > 0 ? `$${cost.toFixed(3)}` : "—"}
                     sub={cost > 0 ? `${px.label} · $${px.input}/M in · $${px.output}/M out` : ""} />
          </div>
        </div>

        {/* Elastic context-management story */}
        <div className="rounded-xl border border-[var(--color-elastic)]/30 bg-[var(--color-elastic)]/[0.04] p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--color-elastic)] mb-3 flex items-center gap-1.5">
            <Sparkles size={11} /> How Elastic shrinks this
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            <Bullet label="Dynamically loaded skills">
              <span className="text-[var(--color-elastic)] font-mono">21–39%</span> input-token reduction — instructions load on demand, not in every system prompt.
            </Bullet>
            <Bullet label="Top-snippets retrieval">
              <span className="text-[var(--color-elastic)] font-mono">27–34%</span> token reduction — only the matching passages enter context, not whole documents.
            </Bullet>
            <Bullet label="Selective context compaction">
              Earlier turns summarized rather than truncated — sustains <span className="text-[var(--color-elastic)] font-mono">30+ turn</span> conversations.
            </Bullet>
            <Bullet label="Combined">
              <span className="text-[var(--color-elastic)] font-mono">up to 40%</span> total cost reduction without sacrificing answer quality.
            </Bullet>
          </ul>

          <div className="mt-4 pt-3 border-t border-slate-700/40">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
              <TrendingDown size={10} className="text-[var(--color-elastic)]" /> Projected annual savings · 40% reduction
            </div>

            {/* Queries/day slider */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                  <Users size={11} /> queries / day
                </span>
                <span className="text-base font-mono font-bold text-slate-100">{qpd.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={Math.log10(50)}
                max={Math.log10(500_000)}
                step={0.01}
                value={Math.log10(qpd)}
                onChange={(e) => setQpd(Math.max(10, Math.round(Math.pow(10, Number(e.target.value)))))}
                className="w-full accent-[var(--color-elastic)]"
              />
              <div className="flex justify-between">
                {QPD_PRESETS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setQpd(n)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      qpd === n
                        ? "bg-[var(--color-elastic)]/20 text-[var(--color-elastic)]"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {n >= 1000 ? `${n/1000}k` : n}
                  </button>
                ))}
              </div>
            </div>

            {/* Outputs */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-slate-700/40 bg-slate-950/40 px-2.5 py-1.5">
                <div className="text-[9px] uppercase tracking-wider text-slate-500">Baseline / yr</div>
                <div className="text-base font-mono font-semibold text-slate-200">${shortMoney(annualBaseline)}</div>
              </div>
              <div className="rounded-md border border-[var(--color-elastic)]/30 bg-[var(--color-elastic)]/[0.06] px-2.5 py-1.5">
                <div className="text-[9px] uppercase tracking-wider text-[var(--color-elastic)]/80">With Elastic / yr</div>
                <div className="text-base font-mono font-semibold text-[var(--color-elastic)]">${shortMoney(annualOptimized)}</div>
              </div>
              <div className="col-span-2 rounded-md border border-[var(--color-elastic)]/30 bg-[var(--color-elastic)]/[0.04] px-2.5 py-1.5 flex items-baseline gap-2">
                <span className="text-[9px] uppercase tracking-wider text-slate-400">Annual savings</span>
                <span className="text-xl font-mono font-bold text-[var(--color-elastic)]">${shortMoney(annualSavings)}</span>
                <span className="text-[10px] text-slate-500 ml-auto">@ ~${TYPICAL_COST_PER_ANSWER.toFixed(2)}/answer typical</span>
              </div>
            </div>

            {cost > 0 && (
              <div className="text-[10px] text-slate-500 mt-2 leading-snug">
                Latest measured run: <span className="font-mono text-slate-400">${cost.toFixed(2)}</span> — a single data point. The annual model uses our typical cost across the question mix.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RunStat({ Icon, label, value, sub }: { Icon: typeof Clock; label: string; value: string; sub: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={13} className="text-slate-500 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-sm font-mono font-semibold text-slate-100">{value}</div>
        {sub && <div className="text-[10px] text-slate-500 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function shortMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return n.toFixed(0);
}

function Bullet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="leading-snug">
      <span className="font-semibold text-slate-100">{label}.</span>{" "}
      <span className="text-slate-300">{children}</span>
    </li>
  );
}
