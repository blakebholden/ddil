import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScanSearch, Images, Lock, X } from "lucide-react";
import { MultimodalSearch } from "./scenes/MultimodalSearch";
import { NeedToKnow } from "./scenes/NeedToKnow";

type Scene = "multimodal" | "needtoknow";

interface Props {
  onExit?: () => void;
}

const SCENES: { id: Scene; label: string; sub: string; icon: React.ReactNode }[] = [
  { id: "multimodal", label: "Search by Image", sub: "one vector space", icon: <Images size={18} /> },
  { id: "needtoknow", label: "Need-to-Know", sub: "research corpus + DLS", icon: <Lock size={18} /> },
];

export function JinaApp({ onExit }: Props) {
  const [scene, setScene] = useState<Scene>("multimodal");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onExit?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <nav className="w-56 bg-slate-900/80 border-r border-slate-800 flex flex-col backdrop-blur-sm">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ScanSearch size={20} className="text-violet-400" />
            <div>
              <h1 className="text-sm font-bold text-violet-300 tracking-tight leading-tight">Multimodal Intelligence</h1>
              <p className="text-[10px] text-slate-500 leading-tight">Jina omni · HPE AI Factory</p>
            </div>
          </div>
        </div>
        <div className="flex-1 py-2">
          {SCENES.map((s) => (
            <button
              key={s.id}
              onClick={() => setScene(s.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                scene === s.id
                  ? "bg-slate-800 text-violet-300 border-r-2 border-violet-400"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              {s.icon}
              <div className="text-left leading-tight">
                <div>{s.label}</div>
                <div className="text-[10px] text-slate-500">{s.sub}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            Airgapped · DDIL Kit
          </div>
          {onExit && (
            <button
              onClick={onExit}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-500 hover:text-slate-300 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={12} /> Exit to chooser
            </button>
          )}
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={scene}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {scene === "multimodal" ? <MultimodalSearch /> : <NeedToKnow />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
