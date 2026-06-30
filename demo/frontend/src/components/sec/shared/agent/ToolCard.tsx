import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Database, FileText, ListTree, Code2, Wrench, ChevronRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { ToolStep } from "../../hooks/useAgentChat";

const TOOL_ICON: Record<string, typeof Search> = {
  "platform.core.search":               Search,
  "platform.core.list_indices":         ListTree,
  "platform.core.get_index_mapping":    Database,
  "platform.core.get_document_by_id":   FileText,
  "platform.core.execute_esql":         Code2,
  "platform.core.generate_esql":        Code2,
  "platform.core.index_explorer":       ListTree,
};

export function ToolCard({ step, index }: { step: ToolStep; index: number }) {
  const [open, setOpen] = useState(false);
  const Icon = TOOL_ICON[step.tool] ?? Wrench;

  const ringByStatus = {
    running: "border-amber-500/40 bg-amber-500/5",
    done:    "border-emerald-500/30 bg-emerald-500/5",
    error:   "border-rose-500/40 bg-rose-500/5",
  }[step.status];

  const StatusIcon = step.status === "running" ? Loader2 : step.status === "done" ? CheckCircle2 : AlertCircle;
  const statusClr = step.status === "running" ? "text-amber-300" : step.status === "done" ? "text-emerald-300" : "text-rose-300";

  const headline = summarizeParams(step.tool, step.params);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`rounded-xl border ${ringByStatus} overflow-hidden`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-900/30 transition-colors"
      >
        <span className="text-xs text-slate-500 font-mono shrink-0">#{index + 1}</span>
        <Icon size={16} className="text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-mono text-slate-200 truncate">{step.tool}</div>
          <div className="text-xs text-slate-400 truncate">{headline}</div>
        </div>
        <span className={`flex items-center gap-1 text-xs ${statusClr} shrink-0`}>
          <StatusIcon size={12} className={step.status === "running" ? "animate-spin" : ""} />
          {step.status === "running" ? "running" : step.status === "done" ? `${countResults(step)}` : "error"}
        </span>
        <ChevronRight size={14} className={`text-slate-500 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-700/30"
          >
            <div className="px-4 py-3 space-y-3 bg-slate-950/40">
              {/* params */}
              <details open>
                <summary className="text-[10px] uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-300">params</summary>
                <pre className="mt-1.5 text-[11px] font-mono text-slate-300 overflow-x-auto p-2 bg-slate-900/50 rounded">{JSON.stringify(step.params, null, 2)}</pre>
              </details>

              {/* progress messages */}
              {step.progress.length > 0 && (
                <details>
                  <summary className="text-[10px] uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-300">progress ({step.progress.length})</summary>
                  <ul className="mt-1.5 text-[11px] text-slate-400 space-y-0.5 list-disc list-inside">
                    {step.progress.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </details>
              )}

              {/* results summary */}
              {step.results && step.results.length > 0 && (
                <details>
                  <summary className="text-[10px] uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-300">results ({step.results.length})</summary>
                  <div className="mt-1.5 space-y-2">
                    {step.results.map((r, i) => <ResultPreview key={i} entry={r} />)}
                  </div>
                </details>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ResultPreview({ entry }: { entry: { type: string; data: unknown } }) {
  const d = entry.data as Record<string, unknown>;
  if (entry.type === "error") {
    return <div className="text-xs text-rose-300 font-mono">{String(d?.message ?? d)}</div>;
  }
  if (entry.type === "query" && d?.esql) {
    return <pre className="text-[11px] font-mono text-emerald-300 overflow-x-auto p-2 bg-slate-900/50 rounded">{String(d.esql)}</pre>;
  }
  if (entry.type === "esql_results" && Array.isArray(d?.values)) {
    const cols = (d.columns as { name: string }[] | undefined)?.map((c) => c.name) ?? [];
    const rows = (d.values as unknown[][]).slice(0, 15);
    return (
      <div className="overflow-x-auto">
        <table className="text-[11px] font-mono w-full">
          <thead><tr className="text-slate-400">{cols.map((c) => <th key={c} className="text-left pr-3 pb-1">{c}</th>)}</tr></thead>
          <tbody className="text-slate-200">
            {rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="pr-3 py-0.5">{String(v)}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    );
  }
  if (entry.type === "resource_list" && Array.isArray(d?.resources)) {
    const resources = d.resources as Array<{ reference?: { index?: string; id?: string }; content?: { snippets?: string[] } }>;
    return (
      <div className="space-y-1.5">
        {resources.slice(0, 4).map((r, i) => (
          <div key={i} className="text-[11px] text-slate-300 border-l-2 border-slate-700/60 pl-2">
            <span className="font-mono text-slate-500">{r.reference?.index}/{r.reference?.id?.slice(0, 12)}…</span>
            <p className="text-slate-400 leading-snug">{(r.content?.snippets?.[0] || "").slice(0, 200)}…</p>
          </div>
        ))}
        {resources.length > 4 && <div className="text-[10px] text-slate-500 italic">+{resources.length - 4} more</div>}
      </div>
    );
  }
  return <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto p-2 bg-slate-900/50 rounded">{JSON.stringify(entry.data, null, 2).slice(0, 800)}</pre>;
}

function summarizeParams(tool: string, params: Record<string, unknown>): string {
  if (tool === "platform.core.search" && params.query) {
    const q = String(params.query).slice(0, 60);
    const idx = params.index ? ` · index:${params.index}` : "";
    return `"${q}"${idx}`;
  }
  if (tool === "platform.core.execute_esql" && params.query) return String(params.query).slice(0, 70);
  if (tool === "platform.core.get_index_mapping" && params.indices) return `indices: ${JSON.stringify(params.indices)}`;
  if (tool === "platform.core.list_indices") return "list all indices";
  return JSON.stringify(params).slice(0, 80);
}

function countResults(step: ToolStep): string {
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
  if (r?.type === "query") return "ES|QL generated";
  return "done";
}
