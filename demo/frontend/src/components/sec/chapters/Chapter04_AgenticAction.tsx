import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, RotateCcw, MessageSquare, Sparkles, Clock, Cpu, ExternalLink, Bot, Workflow, BarChart3 } from "lucide-react";
import { ChapterShell } from "../shared/ChapterShell";
import { ThinkingTimeline } from "../shared/agent/ThinkingTimeline";
import { AnswerMarkdown } from "../shared/agent/AnswerMarkdown";
import { AgentConfigCard } from "../shared/agent/AgentConfigCard";
import { TradeoffModal } from "../shared/agent/TradeoffModal";
import { useAgentChat } from "../hooks/useAgentChat";
import { useFinanceConfig } from "../lib/financeConfig";

const EXAMPLE_QUESTIONS = [
  "Compare AI risk disclosures across AAPL, MSFT, GOOGL and META — what do they agree on, where do they differ?",
  "Which financial-sector filings flag commercial real estate exposure as a material risk?",
  "What climate-transition risks does the Energy sector disclose in its 10-Ks?",
  "Across the S&P 500, which sector has the most filings citing supply-chain disruption?",
  "Show me three healthcare 10-Ks that talk about generative AI in clinical workflows.",
];

export function Chapter04_AgenticAction() {
  const [input, setInput] = useState("");
  const [tradeoffOpen, setTradeoffOpen] = useState(false);
  const { kibanaUrl: KIBANA } = useFinanceConfig();
  const { state, send, reset } = useAgentChat();
  const busy = state.status === "starting" || state.status === "streaming";
  const tradeoffReady = state.status === "done" && Boolean(state.meta.timeToLastTokenMs);

  const submit = (q?: string) => {
    const text = (q ?? input).trim();
    if (!text || busy) return;
    setInput(text);
    send(text);
  };

  return (
    <ChapterShell
      number="04"
      title="Agentic Action"
      subtitle="The Elastic agent reasons over the freshly-indexed corpus, calls the same search + ES|QL APIs developers use, and streams a cited answer back — autonomous, observable, end-to-end."
      headerRight={
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-500 mr-1">In Kibana</span>
          <KibanaPill href={`${KIBANA}/app/agent_builder`}  Icon={Bot}      label="Agent Builder" />
          <KibanaPill href={`${KIBANA}/app/workflows`}      Icon={Workflow} label="Workflows" />
        </div>
      }
    >
      <div className="grid grid-cols-[1fr_400px] gap-6">
        {/* LEFT: question + streaming */}
        <div className="space-y-4">
          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="relative">
            <MessageSquare size={18} className="absolute left-4 top-4 text-slate-500" />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
              placeholder="Ask the agent something about the S&P 500 10-K corpus…  (⌘/Ctrl + Enter to send)"
              rows={2}
              className="w-full pl-11 pr-32 py-3 bg-slate-900/60 border border-slate-700/60 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[var(--color-elastic)]/50 resize-none"
            />
            <div className="absolute right-2 top-2 flex gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={busy || state.status === "idle"}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs flex items-center gap-1.5"
                title="Reset conversation"
              >
                <RotateCcw size={12} />
              </button>
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="px-4 py-2 rounded-lg bg-[var(--color-elastic)] hover:bg-[var(--color-elastic-dark)] disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-sm font-medium flex items-center gap-1.5"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Ask
              </button>
            </div>
          </form>

          {/* Example questions (only before first run) */}
          {state.status === "idle" && (
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 self-center">Try:</span>
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); submit(q); }}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors max-w-md text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Status strip — top metadata about this run */}
          {state.status !== "idle" && (
            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                  state.status === "streaming" ? "bg-amber-400 animate-pulse" :
                  state.status === "done" ? "bg-emerald-400" :
                  state.status === "error" ? "bg-rose-400" : "bg-slate-500"
                }`} />
                <span className="uppercase tracking-wider">{state.status}</span>
              </span>
              {state.conversationId && (
                <span className="font-mono text-[10px] text-slate-500">conv {state.conversationId.slice(0, 8)}</span>
              )}
              {state.meta.timeToFirstTokenMs && (
                <span className="flex items-center gap-1"><Clock size={11} /> ttft {(state.meta.timeToFirstTokenMs/1000).toFixed(1)}s</span>
              )}
              {state.meta.timeToLastTokenMs && (
                <span>· total {(state.meta.timeToLastTokenMs/1000).toFixed(1)}s</span>
              )}
              {state.meta.llmCalls && (
                <span className="flex items-center gap-1"><Cpu size={11} /> {state.meta.llmCalls} LLM call{state.meta.llmCalls === 1 ? "" : "s"}</span>
              )}
              {state.meta.inputTokens != null && (
                <span className="font-mono text-[10px]">{state.meta.inputTokens.toLocaleString()} in / {(state.meta.outputTokens ?? 0).toLocaleString()} out</span>
              )}
              {state.meta.model && (
                <span className="font-mono text-[10px] text-slate-500">{state.meta.model}</span>
              )}
            </div>
          )}

          {/* Error */}
          {state.status === "error" && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-300">
              {state.error}
            </div>
          )}

          {/* Unified thinking timeline — reasoning steps with tool calls nested as pull-outs */}
          {(state.reasoning.length > 0 || state.tools.length > 0) && (
            <ThinkingTimeline
              reasoning={state.reasoning}
              tools={state.tools}
              busy={state.status === "starting" || state.status === "streaming"}
            />
          )}

          {/* Final answer (markdown) */}
          <AnimatePresence>
            {state.answer && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-[var(--color-elastic)]/30 bg-[var(--color-elastic)]/[0.04] p-5"
              >
                <div className="flex items-center justify-between mb-3 gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-[var(--color-elastic)]" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-elastic)]">Answer</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {state.conversationId && (
                      <a
                        href={`${KIBANA}/app/agent_builder/conversations/${state.conversationId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-900/60 hover:bg-slate-800 text-slate-200 ring-1 ring-slate-700/60 transition-colors"
                        title="Open this conversation in Kibana Agent Builder"
                      >
                        <Bot size={11} className="text-[var(--color-elastic)]" />
                        <span>Open in Kibana</span>
                        <span className="text-slate-500 font-mono">· {state.conversationId.slice(0, 8)}</span>
                        <ExternalLink size={10} className="text-slate-500" />
                      </a>
                    )}
                    {tradeoffReady && (
                      <button
                        onClick={() => setTradeoffOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-900/60 hover:bg-slate-800 text-slate-200 ring-1 ring-slate-700/60 transition-colors"
                        title="Show performance, cost, and Elastic context-management tradeoffs"
                      >
                        <BarChart3 size={11} className="text-[var(--color-elastic)]" />
                        <span>Tradeoffs</span>
                        {state.meta.timeToLastTokenMs && (
                          <span className="text-slate-500 font-mono">· {(state.meta.timeToLastTokenMs / 1000).toFixed(0)}s · {state.meta.llmCalls ?? 0} calls</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <AnswerMarkdown text={state.answer} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tradeoff modal — opens from the pill button on the Answer header */}
          <TradeoffModal
            open={tradeoffOpen}
            onClose={() => setTradeoffOpen(false)}
            meta={state.meta}
            toolCallCount={state.tools.length}
          />
        </div>

        {/* RIGHT: config sidebar */}
        <div className="space-y-3">
          <AgentConfigCard />
        </div>
      </div>
    </ChapterShell>
  );
}

function KibanaPill({ href, Icon, label }: { href: string; Icon: typeof Bot; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-slate-100 ring-1 ring-slate-700/50 transition-colors"
    >
      <Icon size={12} />
      {label}
      <ExternalLink size={10} className="opacity-60 group-hover:opacity-100" />
    </a>
  );
}
