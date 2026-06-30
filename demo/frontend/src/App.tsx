import { useState, createContext, useContext, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Search,
  MessageSquare,
  Leaf,
  MapPin,
  LayoutDashboard,
  Monitor,
  Grape,
  RotateCcw,
} from "lucide-react";
import { AdventureChooser } from "./components/AdventureChooser/AdventureChooser";
import { Architecture } from "./components/Architecture/Architecture";
import { RaceIntro } from "./components/RaceIntro/RaceIntro";
import { RaceDashboard } from "./components/RaceDashboard/RaceDashboard";
import { SearchPlayground } from "./components/SearchPlayground/SearchPlayground";
import { AgentChat } from "./components/AgentChat/AgentChat";
import { LeafScanner } from "./components/LeafScanner/LeafScanner";
import { SystemOverview } from "./components/SystemOverview/SystemOverview";
import { VineyardMap } from "./components/VineyardMap/VineyardMap";
import { Dashboard } from "./components/Dashboard/Dashboard";
import { SecDeck } from "./components/sec/SecDeck";
import { JinaApp } from "./components/jina/JinaApp";
import { CcsApp } from "./components/ccs/CcsApp";

type Scene =
  | "dashboard"
  | "vineyard"
  | "chat"
  | "search"
  | "scanner"
  | "race"
  | "overview";

// App-wide context for block selection + scene navigation + agent queries
interface AppContextType {
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  navigateTo: (scene: Scene) => void;
  pendingQuery: string | null;
  setPendingQuery: (q: string | null) => void;
  investigateBlock: (blockId: string, query?: string) => void;
  investigate: (query: string) => void;
}

export const AppContext = createContext<AppContextType>({
  selectedBlockId: null,
  setSelectedBlockId: () => {},
  navigateTo: () => {},
  pendingQuery: null,
  setPendingQuery: () => {},
  investigateBlock: () => {},
  investigate: () => {},
});

export const useAppContext = () => useContext(AppContext);
// Backwards compat
export const useBlockContext = useAppContext;
export const BlockContext = AppContext;

const scenes: { id: Scene; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { id: "vineyard", label: "Vineyard", icon: <MapPin size={18} /> },
  { id: "chat", label: "AI Agronomist", icon: <MessageSquare size={18} /> },
  { id: "search", label: "Search", icon: <Search size={18} /> },
  { id: "scanner", label: "Crop Health", icon: <Leaf size={18} /> },
  { id: "race", label: "Indexing Race", icon: <Zap size={18} /> },
  { id: "overview", label: "System", icon: <Monitor size={18} /> },
];

const sceneComponents: Record<Scene, React.ReactNode> = {
  dashboard: <Dashboard />,
  vineyard: <VineyardMap />,
  chat: <AgentChat />,
  search: <SearchPlayground />,
  scanner: <LeafScanner />,
  race: <RaceDashboard />,
  overview: <SystemOverview />,
};

export default function App() {
  const [adventure, setAdventure] = useState<"vineyard" | "sec" | "jina" | "ccs" | null>(null);
  const [showArch, setShowArch] = useState(false);
  const [showRaceIntro, setShowRaceIntro] = useState(false);
  const [showRace, setShowRace] = useState(false);
  const [activeScene, setActiveScene] = useState<Scene>("dashboard");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);

  const resetDemo = useCallback(() => {
    setAdventure(null);
    setShowArch(false);
    setShowRaceIntro(false);
    setShowRace(false);
    setActiveScene("dashboard");
    setSelectedBlockId(null);
    setPendingQuery(null);
    localStorage.removeItem("vineyard-conversations");
  }, []);

  const navigateTo = useCallback((scene: Scene) => {
    setActiveScene(scene);
  }, []);

  const investigateBlock = useCallback(
    (blockId: string, query?: string) => {
      setSelectedBlockId(blockId);
      const q = query || `Analyze the current status of block ${blockId} and recommend actions`;
      setPendingQuery(q);
      setActiveScene("chat");
    },
    []
  );

  const investigate = useCallback(
    (query: string) => {
      setPendingQuery(query);
      setActiveScene("chat");
    },
    []
  );

  // Show adventure chooser if no adventure selected
  if (!adventure) {
    return (
      <AdventureChooser
        onChoose={(a) => {
          setAdventure(a);
          if (a === "vineyard") setShowArch(true); // vineyard shows architecture first
        }}
      />
    );
  }

  // SEC Findings adventure = the full presenter slide deck (ported race-demo)
  if (adventure === "sec") {
    return <SecDeck onExit={resetDemo} />;
  }

  // Multimodal + DLS adventure (HPE/Jina)
  if (adventure === "jina") {
    return <JinaApp onExit={resetDemo} />;
  }

  // CCS edge-federation adventure
  if (adventure === "ccs") {
    return <CcsApp onExit={resetDemo} />;
  }

  // Show architecture overview
  if (showArch) {
    return (
      <Architecture
        onContinue={() => {
          setShowArch(false);
          setShowRaceIntro(true);
        }}
      />
    );
  }

  // Show race intro — explains what we're about to do
  if (showRaceIntro) {
    return (
      <RaceIntro
        adventure={adventure!}
        onContinue={() => {
          setShowRaceIntro(false);
          setShowRace(true);
        }}
      />
    );
  }

  // Show race dashboard — the actual GPU vs CPU race (auto-started)
  if (showRace) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <RaceDashboard onComplete={() => setShowRace(false)} autoStart />
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        selectedBlockId,
        setSelectedBlockId,
        navigateTo,
        pendingQuery,
        setPendingQuery,
        investigateBlock,
        investigate,
      }}
    >
      <div className="min-h-screen bg-slate-950 text-slate-100 flex">
        {/* Sidebar */}
        <nav className="w-56 bg-slate-900/80 border-r border-slate-800 flex flex-col backdrop-blur-sm">
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Grape size={20} className="text-emerald-400" />
              <div>
                <h1 className="text-sm font-bold text-emerald-400 tracking-tight leading-tight">
                  Côte Cachée
                </h1>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Vineyard Intelligence
                </p>
              </div>
            </div>
          </div>
          <div className="flex-1 py-2">
            {scenes.map((scene) => (
              <button
                key={scene.id}
                onClick={() => setActiveScene(scene.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  activeScene === scene.id
                    ? "bg-slate-800 text-emerald-400 border-r-2 border-emerald-400"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {scene.icon}
                {scene.label}
              </button>
            ))}
          </div>
          <div className="p-4 border-t border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Airgapped &middot; DDIL Kit
            </div>
            {selectedBlockId && (
              <button
                onClick={() => investigateBlock(selectedBlockId)}
                className="text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors"
              >
                Investigate {selectedBlockId} &rarr;
              </button>
            )}
            <button
              onClick={resetDemo}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-500 hover:text-slate-300 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RotateCcw size={12} />
              Reset Demo
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeScene}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {sceneComponents[activeScene]}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </AppContext.Provider>
  );
}
