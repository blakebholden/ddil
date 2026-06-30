import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, ChevronRight } from "lucide-react";
import type { ReasoningNote } from "../../hooks/useAgentChat";

export function ReasoningBlock({ notes }: { notes: ReasoningNote[] }) {
  const [open, setOpen] = useState(true);
  if (!notes.length) return null;
  const substantive = notes.filter((n) => !n.transient);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-slate-900/60 transition-colors"
      >
        <Brain size={14} className="text-fuchsia-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300">Thinking</span>
        <span className="text-[10px] text-slate-500">· {substantive.length} step{substantive.length === 1 ? "" : "s"}</span>
        <ChevronRight size={12} className={`ml-auto text-slate-500 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <ul className="px-4 py-3 space-y-2 border-t border-slate-700/40">
              {substantive.map((n, i) => (
                <li key={i} className="text-xs text-slate-300 leading-relaxed flex gap-2">
                  <span className="text-slate-600 font-mono shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <span>{n.text}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
