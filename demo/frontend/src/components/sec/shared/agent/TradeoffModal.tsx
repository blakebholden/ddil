import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BarChart3 } from "lucide-react";
import { TradeoffPanel } from "./TradeoffPanel";
import type { RoundMetadata } from "../../hooks/useAgentChat";

interface Props {
  open: boolean;
  onClose: () => void;
  meta: RoundMetadata;
  toolCallCount: number;
}

export function TradeoffModal({ open, onClose, meta, toolCallCount }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-6"
          >
            <div className="pointer-events-auto w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/70 bg-slate-950 shadow-2xl shadow-slate-950/60">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
                <div className="flex items-center gap-2.5">
                  <BarChart3 size={16} className="text-[var(--color-elastic)]" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">Performance · cost · context</h2>
                  <span className="text-[10px] text-slate-500 italic">analysis of the answer above</span>
                </div>
                <button
                  onClick={onClose}
                  className="text-slate-500 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5">
                <TradeoffPanel meta={meta} toolCallCount={toolCallCount} />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
