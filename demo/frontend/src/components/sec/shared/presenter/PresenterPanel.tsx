import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Layers, Lightbulb, Pause, Play } from "lucide-react";
import { ScaleProjection } from "./ScaleProjection";
import { UseCases } from "./UseCases";
import { WhyItMatters } from "./WhyItMatters";

type Tab = "scale" | "usecases" | "why";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "scale",    label: "At scale",   icon: <TrendingUp size={14} /> },
  { id: "usecases", label: "Use cases",  icon: <Layers size={14} /> },
  { id: "why",      label: "Why now",    icon: <Lightbulb size={14} /> },
];

interface Props {
  gpuVps: number;
  cpuVps: number;
  /** Auto-rotate cadence in ms. Set to 0 to disable rotation. */
  rotateMs?: number;
  /** Only auto-rotate when the audience needs filler — i.e. GPU done, CPU still working. */
  rotateActive?: boolean;
}

export function PresenterPanel({ gpuVps, cpuVps, rotateMs = 15_000, rotateActive = true }: Props) {
  const [tab, setTab] = useState<Tab>("scale");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || !rotateActive || !rotateMs) return;
    const id = window.setInterval(() => {
      setTab((cur) => {
        const i = TABS.findIndex((t) => t.id === cur);
        return TABS[(i + 1) % TABS.length].id;
      });
    }, rotateMs);
    return () => clearInterval(id);
  }, [paused, rotateActive, rotateMs]);

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">
            Talking points {rotateActive && !paused && "· auto-rotating"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setPaused(true); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-[var(--color-elastic)]/20 text-[var(--color-elastic)] ring-1 ring-[var(--color-elastic)]/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
          {rotateActive && (
            <button
              onClick={() => setPaused((p) => !p)}
              className="ml-1 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"
              title={paused ? "Resume rotation" : "Pause rotation"}
            >
              {paused ? <Play size={12} /> : <Pause size={12} />}
            </button>
          )}
        </div>
      </div>

      <div className="min-h-[220px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {tab === "scale"    && <ScaleProjection gpuVps={gpuVps} cpuVps={cpuVps} />}
            {tab === "usecases" && <UseCases />}
            {tab === "why"      && <WhyItMatters />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
