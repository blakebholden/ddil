import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { FinanceConfigProvider } from "./lib/financeConfig";
import { Chapter00_Architecture } from "./chapters/Chapter00_Architecture";
import { Chapter01_Speed } from "./chapters/Chapter01_Speed";
import { Chapter02_SideBySide } from "./chapters/Chapter02_SideBySide";
import { Chapter02_5_Elastic } from "./chapters/Chapter02_5_Elastic";
import { Chapter03_DataInterface } from "./chapters/Chapter03_DataInterface";
import { Chapter04_AgenticAction } from "./chapters/Chapter04_AgenticAction";
import { Chapter04_5_Workflows } from "./chapters/Chapter04_5_Workflows";
import { Chapter05_Conclusion } from "./chapters/Chapter05_Conclusion";

const CHAPTERS = [
  { number: "00", short: "Setup",        Component: Chapter00_Architecture },
  { number: "01", short: "Speed",        Component: Chapter01_Speed },
  { number: "02", short: "Side-by-Side", Component: Chapter02_SideBySide },
  { number: "—",  short: "Elastic",      Component: Chapter02_5_Elastic },     // segue 02 → 03
  { number: "03", short: "Interface",    Component: Chapter03_DataInterface },
  { number: "04", short: "Agentic",      Component: Chapter04_AgenticAction },
  { number: "—",  short: "Workflows",    Component: Chapter04_5_Workflows },   // segue 04 → 05
  { number: "05", short: "The Stack",    Component: Chapter05_Conclusion },
];

interface Props {
  onExit?: () => void;
}

/**
 * The SEC Findings adventure = the full presenter slide deck (ported from
 * demo/race-demo). Wrapped in FinanceConfigProvider so every chapter's Kibana
 * links and "show the call" hosts resolve from /api/finance/agent/state.
 */
export function SecDeck({ onExit }: Props) {
  const [idx, setIdx] = useState(0);

  const go = useCallback((delta: number) => {
    setIdx((i) => Math.max(0, Math.min(CHAPTERS.length - 1, i + delta)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      else if (e.key === "Escape") onExit?.();
      else if (e.key >= "0" && e.key <= "5") {
        // jump to the chapter whose display number matches the digit (00…05).
        // The "—" bridges are reachable only via arrows or chip click.
        const wanted = "0" + e.key;
        const i = CHAPTERS.findIndex((c) => c.number === wanted);
        if (i >= 0) setIdx(i);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onExit]);

  const Active = CHAPTERS[idx].Component;

  return (
    <FinanceConfigProvider>
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        {/* Header bar */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-slate-800/60">
          <div className="flex items-center gap-4">
            {onExit && (
              <button
                onClick={onExit}
                title="Back to demo chooser (Esc)"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <X size={14} /> Exit
              </button>
            )}
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Sovereign AI · SEC Findings</div>
              <h1 className="text-lg font-semibold text-slate-100 tracking-tight">CPU vs GPU Indexing · Agentic 10-K Analysis</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="px-2 py-1 rounded bg-slate-800/60">elastic</span>
            <span className="opacity-50">×</span>
            <span className="px-2 py-1 rounded bg-slate-800/60 text-[var(--color-nvidia)]">NVIDIA</span>
          </div>
        </header>

        {/* Body */}
        <main className="flex-1 px-8 py-6 relative overflow-y-auto">
          <AnimatePresence mode="wait">
            <Active key={CHAPTERS[idx].short} />
          </AnimatePresence>
        </main>

        {/* Footer nav — presenter */}
        <footer className="flex items-center justify-between px-8 py-4 border-t border-slate-800/60">
          <button
            onClick={() => go(-1)}
            disabled={idx === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} /> Prev
          </button>

          <div className="flex items-center gap-3">
            {CHAPTERS.map((c, i) => (
              <button
                key={c.short}
                onClick={() => setIdx(i)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                  i === idx ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <span className="font-mono text-xs">{c.number}</span>
                <span className="text-[10px] uppercase tracking-wider">{c.short}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => go(1)}
            disabled={idx === CHAPTERS.length - 1}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-100 bg-[var(--color-elastic)]/15 hover:bg-[var(--color-elastic)]/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight size={16} />
          </button>
        </footer>
      </div>
    </FinanceConfigProvider>
  );
}
