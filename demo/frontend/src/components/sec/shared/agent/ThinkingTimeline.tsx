import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, ChevronRight, ChevronDown, Loader2, CheckCircle2, AlertCircle,
  Search, Database, FileText, ListTree, Code2, Wrench, Activity,
} from "lucide-react";
import type { ReasoningNote, ToolStep } from "../../hooks/useAgentChat";

const TOOL_ICON: Record<string, typeof Search> = {
  "platform.core.search":             Search,
  "platform.core.list_indices":       ListTree,
  "platform.core.get_index_mapping":  Database,
  "platform.core.get_document_by_id": FileText,
  "platform.core.execute_esql":       Code2,
  "platform.core.generate_esql":      Code2,
  "platform.core.index_explorer":     ListTree,
};

interface Props {
  reasoning: ReasoningNote[];
  tools: ToolStep[];
  busy: boolean;
}

/**
 * Merged "Thinking" view: each substantive reasoning note is a timeline row.
 * If the note carries a tool_call_id, the matching tool call attaches as an
 * expandable pull-out beneath that row. Long runs stay readable because the
 * tools are nested inside their reasoning context, not stacked separately.
 */
export function ThinkingTimeline({ reasoning, tools }: Props) {
  const toolMap = useMemo(() => {
    const m = new Map<string, ToolStep>();
    for (const t of tools) if (t.id) m.set(t.id, t);
    return m;
  }, [tools]);

  // Reasoning notes minus transient scaffolding ("Planning my next step", etc.)
  const rows = useMemo(() => reasoning.filter((n) => !n.transient), [reasoning]);

  // Top-level collapsed/expanded state for the whole timeline.
  const [open, setOpen] = useState(true);
  const totalTools = tools.length;
  const running = tools.some((t) => t.status === "running");

  if (rows.length === 0 && tools.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-slate-900/60 transition-colors"
      >
        <Brain size={14} className="text-fuchsia-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300">Thinking</span>
        <span className="text-[10px] text-slate-500">
          · {rows.length} step{rows.length === 1 ? "" : "s"}{totalTools > 0 ? ` · ${totalTools} tool call${totalTools === 1 ? "" : "s"}` : ""}
        </span>
        {running && (
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-300 ml-auto mr-2">
            <Loader2 size={10} className="animate-spin" /> live
          </span>
        )}
        <ChevronRight size={12} className={`text-slate-500 transition-transform ${running ? "" : "ml-auto"} ${open ? "rotate-90" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-700/40"
          >
            <ul className="px-3 py-2 max-h-[60vh] overflow-y-auto">
              {rows.map((note, i) => (
                <TimelineRow key={i} index={i + 1} note={note} tool={note.tool_call_id ? toolMap.get(note.tool_call_id) : undefined} />
              ))}
              {/* Any tool calls without a preceding reasoning row — show them as orphan steps */}
              {tools.filter((t) => !rows.some((r) => r.tool_call_id === t.id)).map((t, i) => (
                <TimelineRow key={`orphan-${i}`} index={rows.length + i + 1} note={null} tool={t} />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TimelineRow({ index, note, tool }: { index: number; note: ReasoningNote | null; tool: ToolStep | undefined }) {
  const [open, setOpen] = useState(false);
  const hasTool = Boolean(tool);

  // Auto-open when the tool is currently running so the audience sees the action live.
  useEffect(() => { if (tool?.status === "running") setOpen(true); }, [tool?.status]);

  const Icon = tool ? (TOOL_ICON[tool.tool] ?? Wrench) : null;
  const StatusIcon = tool?.status === "running" ? Loader2 : tool?.status === "done" ? CheckCircle2 : tool?.status === "error" ? AlertCircle : null;
  const statusClr = tool?.status === "running" ? "text-amber-300" : tool?.status === "done" ? "text-emerald-300" : "text-rose-300";

  return (
    <li className="border-l-2 border-slate-700/40 pl-3 py-1.5 -ml-2">
      <button
        onClick={() => hasTool && setOpen((o) => !o)}
        disabled={!hasTool}
        className={`w-full flex items-start gap-2 text-left ${hasTool ? "hover:opacity-90 cursor-pointer" : "cursor-default"}`}
      >
        <span className="text-[10px] text-slate-500 font-mono shrink-0 mt-0.5 w-6">{String(index).padStart(2, "0")}</span>
        <div className="flex-1 min-w-0">
          {note && (
            <span className="text-xs text-slate-300 leading-relaxed">{note.text}</span>
          )}
          {/* Tool-call inline pill — shows even when the row is collapsed */}
          {tool && Icon && StatusIcon && (
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800/60 ring-1 ring-slate-700/60 text-slate-300 font-mono">
                <Icon size={11} className="text-slate-400" />
                {shortTool(tool.tool)}
              </span>
              <span className={`flex items-center gap-1 ${statusClr}`}>
                <StatusIcon size={10} className={tool.status === "running" ? "animate-spin" : ""} />
                {countResults(tool)}
              </span>
              <span className="text-slate-500 truncate flex-1">{summarizeParams(tool.tool, tool.params)}</span>
              <ChevronDown size={11} className={`text-slate-500 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
            </div>
          )}
          {!note && tool && Icon && (
            // Orphan tool call (no reasoning row) — still show the params line
            <span className="text-xs text-slate-400 italic">(continued tool call)</span>
          )}
        </div>
      </button>

      <AnimatePresence>
        {open && tool && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden ml-8 mt-2"
          >
            <div className="rounded-lg border border-slate-700/40 bg-slate-950/50 p-3 space-y-2">
              <details open>
                <summary className="text-[9px] uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-300">params</summary>
                <pre className="mt-1 text-[10px] font-mono text-slate-300 overflow-x-auto p-2 bg-slate-900/60 rounded">{JSON.stringify(tool.params, null, 2)}</pre>
              </details>
              {tool.progress.length > 0 && (
                <details>
                  <summary className="text-[9px] uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-300">progress ({tool.progress.length})</summary>
                  <ul className="mt-1 text-[10px] text-slate-400 space-y-0.5 list-disc list-inside">
                    {tool.progress.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </details>
              )}
              {tool.results && tool.results.length > 0 && (
                <details open>
                  <summary className="text-[9px] uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-300">results ({tool.results.length})</summary>
                  <div className="mt-1 space-y-1.5">
                    {tool.results.map((r, i) => <ResultPreview key={i} entry={r} />)}
                  </div>
                </details>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

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
        {rs.slice(0, 4).map((r, i) => (
          <div key={i} className="text-[10px] text-slate-300 border-l-2 border-slate-700/60 pl-2">
            <span className="font-mono text-slate-500">{r.reference?.index}/{r.reference?.id?.slice(0, 10)}…</span>
            <p className="text-slate-400 leading-snug">{(r.content?.snippets?.[0] || "").slice(0, 200)}…</p>
          </div>
        ))}
        {rs.length > 4 && <div className="text-[9px] text-slate-500 italic">+{rs.length - 4} more</div>}
      </div>
    );
  }
  return <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto p-2 bg-slate-900/60 rounded">{JSON.stringify(entry.data, null, 2).slice(0, 600)}</pre>;
}

function summarizeParams(tool: string, params: Record<string, unknown>): string {
  if (tool === "platform.core.search" && params.query) {
    const q = String(params.query);
    const trimmed = q.length > 80 ? q.slice(0, 77) + "…" : q;
    return params.index ? `"${trimmed}" · ${params.index}` : `"${trimmed}"`;
  }
  if (tool === "platform.core.execute_esql" && params.query) return String(params.query).slice(0, 90);
  if (tool === "platform.core.get_document_by_id" && params.id) return `id:${String(params.id).slice(0, 18)}…`;
  if (tool === "platform.core.get_index_mapping" && params.indices) return `indices: ${JSON.stringify(params.indices)}`;
  if (tool === "platform.core.list_indices") return "list indices";
  const s = JSON.stringify(params);
  return s.length > 90 ? s.slice(0, 87) + "…" : s;
}

function shortTool(t: string): string {
  return t.replace(/^platform\.core\./, "").replace(/^platform\.streams\./, "streams.");
}

function countResults(step: ToolStep): string {
  if (step.status === "running") return "running";
  if (step.status === "error") return "error";
  if (!step.results) return "done";
  const r = step.results[0];
  if (r?.type === "resource_list") return `${((r.data as { resources?: unknown[] })?.resources ?? []).length} hits`;
  if (r?.type === "esql_results") return `${((r.data as { values?: unknown[] })?.values ?? []).length} rows`;
  if (r?.type === "query") return "esql gen";
  return "done";
}

// Hide unused import warning under verbatim module syntax
export const _Activity = Activity;
