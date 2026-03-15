import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Search,
  MessageSquare,
  Leaf,
  Activity,
  Monitor,
  Map,
} from "lucide-react";
import { RaceDashboard } from "./components/RaceDashboard/RaceDashboard";
import { SensorDashboard } from "./components/SensorDashboard/SensorDashboard";
import { SearchPlayground } from "./components/SearchPlayground/SearchPlayground";
import { RAGChat } from "./components/RAGChat/RAGChat";
import { LeafScanner } from "./components/LeafScanner/LeafScanner";
import { SystemOverview } from "./components/SystemOverview/SystemOverview";
import { VineyardMap } from "./components/VineyardMap/VineyardMap";

type Scene =
  | "race"
  | "vineyard"
  | "sensors"
  | "search"
  | "chat"
  | "scanner"
  | "overview";

const scenes: { id: Scene; label: string; icon: React.ReactNode }[] = [
  { id: "race", label: "Indexing Race", icon: <Zap size={18} /> },
  { id: "vineyard", label: "Vineyard Plot", icon: <Map size={18} /> },
  { id: "sensors", label: "Live Sensors", icon: <Activity size={18} /> },
  { id: "search", label: "Search", icon: <Search size={18} /> },
  { id: "chat", label: "AI Agronomist", icon: <MessageSquare size={18} /> },
  { id: "scanner", label: "Crop Health", icon: <Leaf size={18} /> },
  { id: "overview", label: "System", icon: <Monitor size={18} /> },
];

const sceneComponents: Record<Scene, React.ReactNode> = {
  race: <RaceDashboard />,
  vineyard: <VineyardMap />,
  sensors: <SensorDashboard />,
  search: <SearchPlayground />,
  chat: <RAGChat />,
  scanner: <LeafScanner />,
  overview: <SystemOverview />,
};

export default function App() {
  const [activeScene, setActiveScene] = useState<Scene>("race");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <nav className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-lg font-bold text-emerald-400 tracking-tight">
            Vineyard Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-1">DDIL Demo Kit</p>
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
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Airgapped
          </div>
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
  );
}
