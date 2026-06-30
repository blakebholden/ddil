import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Database, FileText, ListTree, Code2, Wrench, ChevronRight,
  Loader2, CheckCircle2, AlertCircle, Activity,
} from "lucide-react";
import type { ToolStep } from "../../hooks/useAgentChat";

const TOOL_ICON: Record<string, typeof Search> = {
  "platform.core.search":             Search,
  "platform.core.list_indices":       ListTree,
  "platform.core.get_index_mapping":  Database,
  "platform.core.get_document_by_id": FileText,
  "platform.core.execute_esql":       Code2,
  "platform.core.generate_esql":      Code2,
  "platform.core.index_explorer":     ListTree,
};

interface Group { tool: string; steps: ToolStep[]; }

interface Props {
  steps: ToolStep[];
  busy: boolean;          // is the agent still streaming?
}

/**
 * Long agent runs can produce 30+ tool calls. Render them as:
 *  - a sticky "live" header pinning the in-flight step at the top
 *  - groups of consecutive same-tool calls collapsed by default (one row each)
 *  - the *most recent* group auto-expanded
 *  - a totals bar at the bottom: "37 steps · 24 search · 8 get_doc · 5 mapping"
 */
export function ToolStream({ steps, busy }: Props) {
  const groups = useMemo<Group[]>(() => {
    const out: Group[] = [];
    for (const s of steps) {
      const tail = out[out.length - 1];
      if (tail && tail.tool === s.tool) tail.steps.push(s);
      else out.push({ tool: s.tool, steps: [s] });
    }
    return out;
  }, [steps]);

  const live = steps.find((s) => s.status === "running") ?? steps[steps.length - 1];
  const totals = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of steps) m[s.tool] = (m[s.tool] ?? 0) + 1;
    return m;
  }, [steps]);

  if (steps.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Sticky live banner */}
      {busy && live && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-10 rounded-xl border border-amber-500/40 bg-amber-500/10 backdrop-blur px-4 py-2.5 flex items-center gap-3"
        >
          <Loader2 size={14} className="text-amber-300 animate-spin shrink-0" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-amber-300 shrink-0">Live · step {steps.length}</span>
          <span className="text-xs font-mono text-slate-300 shrink-0">{live.tool}</span>
          <span className="text-xs text-slate-400 truncate flex-1">{summarizeParams(live.tool, live.params)}</span>
        </motion.div>
      )}

      {/* Grouped tool calls */}
      <div className="space-y-2">
        {groups.map((g, gi) => (
          <ToolGroup
            key={`${g.tool}-${gi}`}
            group={g}
            index={gi}
            startStep={groups.slice(0, gi).reduce((n, x) => n + x.steps.length, 0)}
            defaultOpen={gi === groups.length - 1}
          />
        ))}
      </div>

      {/* Totals footer */}
      <div className="flex flex-wrap items-center gap-2 pt-2 text-[10px] uppercase tracking-wider text-slate-500">
        <Activity size={11} className="text-slate-600" />
        <span>{steps.length} step{steps.length === 1 ? "" : "s"}</span>
        {Object.entries(totals).map(([t, n]) => (
          <span key={t} className="flex items-center gap-1">
            <span className="text-slate-600">·</span>
            <span className="font-mono text-slate-400">{n}</span>
            <span className="lowercase text-slate-500">{shortTool(t)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────── one group (consecutive same-tool calls) ────────────────────
function ToolGroup({ group, index, startStep, defaultOpen }: { group: Group; index: number; startStep: number; defaultOpen: boolean }) {
  const Icon = TOOL_ICON[group.tool] ?? Wrench;
  const [open, setOpen] = useState(defaultOpen);

  // When a new group becomes "latest" (busy stream growing), auto-open it.
  useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen]);

  const n = group.steps.length;
  const anyRunning = group.steps.some((s) => s.status === "running");
  const anyError = group.steps.some((s) => s.status === "error");
  const status = anyRunning ? "running" : anyError ? "error" : "done";
  const ring = { running: "border-amber-500/40 bg-amber-500/5", done: "border-emerald-500/25 bg-emerald-500/5", error: "border-rose-500/40 bg-rose-500/5" }[status];
  const StatusIcon = status === "running" ? Loader2 : status === "done" ? CheckCircle2 : AlertCircle;
  const statusClr = status === "running" ? "text-amber-300" : status === "done" ? "text-emerald-300" : "text-rose-300";

  return (
    <div className={`rounded-xl border ${ring} overflow-hidden`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3.5 py-2.5 flex items-center gap-3 text-left hover:bg-slate-900/30 transition-colors"
      >
        <span className="text-[10px] text-slate-500 font-mono shrink-0 w-12">{n > 1 ? `${startStep + 1}–${startStep + n}` : `#${startStep + 1}`}</span>
        <Icon size={14} className="text-slate-400 shrink-0" />
        <span className="text-sm font-mono text-slate-200 shrink-0">{shortTool(group.tool)}</span>
        {n > 1 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 ring-1 ring-slate-700/60">× {n}</span>
        )}
        <span className="flex-1 min-w-0 text-xs text-slate-400 truncate">
          {n === 1 ? summarizeParams(group.tool, group.steps[0].params) : firstQuery(group.steps)}
        </span>
        <span className={`flex items-center gap-1 text-[11px] ${statusClr} shrink-0`}>
          <StatusIcon size={11} className={status === "running" ? "animate-spin" : ""} />
          {status === "running" ? "running" : status === "error" ? "error" : "done"}
        </span>
        <ChevronRight size={12} className={`text-slate-500 transition-transform shrink-0 ${open ? "rotate-90" : ""}`} />
        {/* index var kept for stable key reference */}
        <span hidden>{index}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-700/30"
          >
            <div className="divide-y divide-slate-800/60 bg-slate-950/30">
              {group.steps.map((s, i) => (
                <CompactStep key={s.id || i} step={s} number={startStep + i + 1} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────── one compact step inside a group ────────────────────────────
function CompactStep({ step, number }: { step: ToolStep; number: number }) {
  const [open, setOpen] = useState(false);
  const StatusIcon = step.status === "running" ? Loader2 : step.status === "done" ? CheckCircle2 : AlertCircle;
  const statusClr = step.status === "running" ? "text-amber-300" : step.status === "done" ? "text-emerald-300" : "text-rose-300";
  const detailsRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-slate-900/30 transition-colors text-xs"
      >
        <span className="text-[10px] text-slate-500 font-mono shrink-0 w-10">#{number}</span>
        <span className="flex-1 min-w-0 text-slate-300 truncate">{summarizeParams(step.tool, step.params)}</span>
        <span className={`flex items-center gap-1 text-[11px] ${statusClr} shrink-0`}>
          <StatusIcon size={10} className={step.status === "running" ? "animate-spin" : ""} />
          {countResults(step)}
        </span>
        <ChevronRight size={11} className={`text-slate-600 transition-transform shrink-0 ${open ? "rotate-90" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={detailsRef}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-slate-950/50"
          >
            <div className="px-4 py-2 space-y-2">
              <details>
                <summary className="text-[9px] uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-300">params</summary>
                <pre className="mt-1 text-[10px] font-mono text-slate-300 overflow-x-auto p-2 bg-slate-900/60 rounded">{JSON.stringify(step.params, null, 2)}</pre>
              </details>
              {step.results && step.results.length > 0 && (
                <details>
                  <summary className="text-[9px] uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-300">results ({step.results.length})</summary>
                  <div className="mt-1 space-y-1.5">
                    {step.results.map((r, i) => <ResultPreview key={i} entry={r} />)}
                  </div>
                </details>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────── result rendering (reused) ──────────────────────────────────
function ResultPreview({ entry }: { entry: { type: string; data: unknown } }) {
  const d = entry.data as Record<string, unknown>;
  if (entry.type === "error")
    return <div className="text-[11px] text-rose-300 font-mono">{String(d?.message ?? d)}</div>;
  if (entry.type === "query" && d?.esql)
    return <pre className="text-[10px] font-mono text-emerald-300 overflow-x-auto p-2 bg-slate-900/60 rounded">{String(d.esql)}</pre>;
  if (entry.type === "esql_results" && Array.isArray(d?.values)) {
    const cols = (d.columns as { name: string }[] | undefined)?.map((c) => c.name) ?? [];
    const rows = (d.values as unknown[][]).slice(0, 12);
    return (
      <div className="overflow-x-auto">
        <table className="text-[10px] font-mono w-full">
          <thead><tr className="text-slate-400">{cols.map((c) => <th key={c} className="text-left pr-3 pb-1">{c}</th>)}</tr></thead>
          <tbody className="text-slate-200">{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="pr-3 py-0.5">{String(v)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  if (entry.type === "resource_list" && Array.isArray(d?.resources)) {
    const rs = d.resources as Array<{ reference?: { index?: string; id?: string }; content?: { snippets?: string[] } }>;
    return (
      <div className="space-y-1">
        {rs.slice(0, 3).map((r, i) => (
          <div key={i} className="text-[10px] text-slate-300 border-l-2 border-slate-700/60 pl-2">
            <span className="font-mono text-slate-500">{r.reference?.index}/{r.reference?.id?.slice(0, 10)}…</span>
            <p className="text-slate-400 leading-snug">{(r.content?.snippets?.[0] || "").slice(0, 160)}…</p>
          </div>
        ))}
        {rs.length > 3 && <div className="text-[9px] text-slate-500 italic">+{rs.length - 3} more</div>}
      </div>
    );
  }
  return <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto p-2 bg-slate-900/60 rounded">{JSON.stringify(entry.data, null, 2).slice(0, 600)}</pre>;
}

// ─────────────── helpers ────────────────────────────────────────────────────
function summarizeParams(tool: string, params: Record<string, unknown>): string {
  if (tool === "platform.core.search" && params.query) {
    const q = String(params.query);
    const trimmed = q.length > 70 ? q.slice(0, 67) + "…" : q;
    return params.index ? `"${trimmed}" · ${params.index}` : `"${trimmed}"`;
  }
  if (tool === "platform.core.execute_esql" && params.query) return String(params.query).slice(0, 80);
  if (tool === "platform.core.get_document_by_id" && params.id) return `id:${String(params.id).slice(0, 18)}…`;
  if (tool === "platform.core.get_index_mapping" && params.indices) return `indices: ${JSON.stringify(params.indices)}`;
  if (tool === "platform.core.list_indices") return "list indices";
  const s = JSON.stringify(params);
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
}

function firstQuery(steps: ToolStep[]): string {
  const head = summarizeParams(steps[0].tool, steps[0].params);
  return steps.length > 1 ? `${head} (+${steps.length - 1} similar)` : head;
}

function shortTool(t: string): string {
  return t.replace(/^platform\.core\./, "").replace(/^platform\.streams\./, "streams.").replace(/_/g, " ");
}

function countResults(step: ToolStep): string {
  if (step.status === "running") return "running";
  if (step.status === "error") return "error";
  if (!step.results) return "done";
  const r = step.results[0];
  if (r?.type === "resource_list") {
    const arr = (r.data as { resources?: unknown[] })?.resources ?? [];
    return `${arr.length} hits`;
  }
  if (r?.type === "esql_results") {
    const arr = (r.data as { values?: unknown[] })?.values ?? [];
    return `${arr.length} rows`;
  }
  if (r?.type === "query") return "esql gen";
  return "done";
}
