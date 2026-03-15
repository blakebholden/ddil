import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Droplets,
  Thermometer,
  FlaskConical,
  AlertTriangle,
  Leaf,
} from "lucide-react";

interface Block {
  id: string;
  row: number;
  col: number;
  variety: string;
  moisture: number;
  temp: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  health: "healthy" | "watch" | "alert";
  disease?: string;
  lastUpdated: string;
}

type ColorMode = "moisture" | "temperature" | "nitrogen" | "health";

const VARIETIES = [
  "Cabernet Sauvignon",
  "Pinot Noir",
  "Chardonnay",
  "Merlot",
  "Syrah",
  "Riesling",
];

function generateBlocks(): Block[] {
  const blocks: Block[] = [];
  const rows = 6;
  const cols = 8;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `${String.fromCharCode(65 + r)}${c + 1}`;
      const moisture = 25 + Math.random() * 30;
      const health: Block["health"] =
        moisture < 30 ? "alert" : moisture < 35 ? "watch" : "healthy";

      blocks.push({
        id,
        row: r,
        col: c,
        variety: VARIETIES[(r * cols + c) % VARIETIES.length],
        moisture: parseFloat(moisture.toFixed(1)),
        temp: parseFloat((14 + Math.random() * 8).toFixed(1)),
        nitrogen: parseFloat((20 + Math.random() * 80).toFixed(0)),
        phosphorus: parseFloat((10 + Math.random() * 60).toFixed(0)),
        potassium: parseFloat((80 + Math.random() * 120).toFixed(0)),
        ph: parseFloat((5.5 + Math.random() * 2).toFixed(1)),
        health,
        disease: health === "alert" && Math.random() > 0.5 ? "Black Rot" : undefined,
        lastUpdated: new Date().toISOString(),
      });
    }
  }
  return blocks;
}

function getBlockColor(block: Block, mode: ColorMode): string {
  switch (mode) {
    case "moisture": {
      if (block.moisture < 28) return "bg-red-500/60 border-red-500";
      if (block.moisture < 33) return "bg-amber-500/40 border-amber-500";
      if (block.moisture < 42) return "bg-emerald-500/40 border-emerald-500";
      return "bg-blue-500/40 border-blue-500";
    }
    case "temperature": {
      if (block.temp < 15) return "bg-blue-500/40 border-blue-500";
      if (block.temp < 18) return "bg-emerald-500/40 border-emerald-500";
      if (block.temp < 21) return "bg-amber-500/40 border-amber-500";
      return "bg-red-500/40 border-red-500";
    }
    case "nitrogen": {
      if (block.nitrogen < 35) return "bg-red-500/50 border-red-500";
      if (block.nitrogen < 55) return "bg-amber-500/40 border-amber-500";
      if (block.nitrogen < 80) return "bg-emerald-500/40 border-emerald-500";
      return "bg-blue-500/40 border-blue-500";
    }
    case "health": {
      if (block.health === "alert") return "bg-red-500/50 border-red-500";
      if (block.health === "watch") return "bg-amber-500/40 border-amber-500";
      return "bg-emerald-500/30 border-emerald-500/50";
    }
  }
}

function Legend({ mode }: { mode: ColorMode }) {
  const legends: Record<ColorMode, { color: string; label: string }[]> = {
    moisture: [
      { color: "bg-red-500", label: "< 28% (Drought)" },
      { color: "bg-amber-500", label: "28-33% (Low)" },
      { color: "bg-emerald-500", label: "33-42% (Optimal)" },
      { color: "bg-blue-500", label: "> 42% (Saturated)" },
    ],
    temperature: [
      { color: "bg-blue-500", label: "< 15°C (Cool)" },
      { color: "bg-emerald-500", label: "15-18°C (Ideal)" },
      { color: "bg-amber-500", label: "18-21°C (Warm)" },
      { color: "bg-red-500", label: "> 21°C (Hot)" },
    ],
    nitrogen: [
      { color: "bg-red-500", label: "< 35 mg/kg (Deficient)" },
      { color: "bg-amber-500", label: "35-55 (Low)" },
      { color: "bg-emerald-500", label: "55-80 (Optimal)" },
      { color: "bg-blue-500", label: "> 80 (Excess)" },
    ],
    health: [
      { color: "bg-red-500", label: "Alert" },
      { color: "bg-amber-500", label: "Watch" },
      { color: "bg-emerald-500", label: "Healthy" },
    ],
  };

  return (
    <div className="flex gap-4 text-xs text-slate-400">
      {legends[mode].map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className={`w-3 h-3 rounded-sm ${item.color}`} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

export function VineyardMap() {
  const [blocks, setBlocks] = useState<Block[]>(generateBlocks);
  const [selected, setSelected] = useState<Block | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("moisture");

  // Simulate live sensor updates
  useEffect(() => {
    const interval = setInterval(() => {
      setBlocks((prev) =>
        prev.map((b) => ({
          ...b,
          moisture: parseFloat(
            Math.max(15, Math.min(55, b.moisture + (Math.random() - 0.5) * 0.8)).toFixed(1)
          ),
          temp: parseFloat(
            Math.max(10, Math.min(28, b.temp + (Math.random() - 0.5) * 0.2)).toFixed(1)
          ),
          nitrogen: parseFloat(
            Math.max(10, Math.min(100, b.nitrogen + (Math.random() - 0.5) * 1)).toFixed(0)
          ),
          health:
            b.moisture < 30 ? "alert" : b.moisture < 35 ? "watch" : "healthy",
          lastUpdated: new Date().toISOString(),
        }))
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Update selected block when data changes
  useEffect(() => {
    if (selected) {
      const updated = blocks.find((b) => b.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [blocks, selected?.id]);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Vineyard Plot</h2>
          <p className="text-sm text-slate-400 mt-1">
            48 blocks &middot; Live sensor overlay &middot; Click block for
            detail
          </p>
        </div>

        {/* Color mode toggle */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-lg">
          {(
            [
              { id: "moisture", label: "Moisture", icon: <Droplets size={14} /> },
              { id: "temperature", label: "Temp", icon: <Thermometer size={14} /> },
              { id: "nitrogen", label: "NPK", icon: <FlaskConical size={14} /> },
              { id: "health", label: "Health", icon: <Leaf size={14} /> },
            ] as { id: ColorMode; label: string; icon: React.ReactNode }[]
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => setColorMode(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                colorMode === m.id
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <Legend mode={colorMode} />

      <div className="flex gap-4 mt-4 flex-1 min-h-0">
        {/* Plot Grid */}
        <div className="flex-1 grid grid-rows-6 gap-1.5">
          {Array.from({ length: 6 }, (_, r) => (
            <div key={r} className="flex gap-1.5">
              {/* Row label */}
              <div className="w-6 flex items-center justify-center text-xs text-slate-600 font-mono">
                {String.fromCharCode(65 + r)}
              </div>
              {blocks
                .filter((b) => b.row === r)
                .map((block) => (
                  <motion.button
                    key={block.id}
                    onClick={() => setSelected(block)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.97 }}
                    className={`flex-1 rounded-md border transition-all duration-500 relative ${getBlockColor(
                      block,
                      colorMode
                    )} ${
                      selected?.id === block.id
                        ? "ring-2 ring-white/50"
                        : "hover:ring-1 hover:ring-white/20"
                    }`}
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs font-mono font-bold text-white/90">
                        {block.id}
                      </span>
                      <span className="text-[10px] text-white/60">
                        {colorMode === "moisture" && `${block.moisture}%`}
                        {colorMode === "temperature" && `${block.temp}°`}
                        {colorMode === "nitrogen" && `N:${block.nitrogen}`}
                        {colorMode === "health" && block.health}
                      </span>
                    </div>
                    {block.disease && (
                      <div className="absolute top-1 right-1">
                        <AlertTriangle
                          size={10}
                          className="text-red-400 animate-pulse"
                        />
                      </div>
                    )}
                  </motion.button>
                ))}
            </div>
          ))}
          {/* Column labels */}
          <div className="flex gap-1.5">
            <div className="w-6" />
            {Array.from({ length: 8 }, (_, c) => (
              <div
                key={c}
                className="flex-1 text-center text-xs text-slate-600 font-mono"
              >
                {c + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="w-72 shrink-0">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 h-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Block {selected.id}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    selected.health === "alert"
                      ? "bg-red-500/20 text-red-400"
                      : selected.health === "watch"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-emerald-500/20 text-emerald-400"
                  }`}
                >
                  {selected.health.toUpperCase()}
                </span>
              </div>

              <div className="text-xs text-slate-500 mb-3">
                {selected.variety}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Droplets size={14} className="text-blue-400" />
                    Moisture
                  </span>
                  <span className="font-mono">{selected.moisture}%</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Thermometer size={14} className="text-orange-400" />
                    Temperature
                  </span>
                  <span className="font-mono">{selected.temp}°C</span>
                </div>

                <div className="border-t border-slate-800 pt-3">
                  <div className="text-xs text-slate-500 mb-2">NPK Profile</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <div className="text-lg font-mono font-bold text-emerald-400">
                        {selected.nitrogen}
                      </div>
                      <div className="text-[10px] text-slate-500">N mg/kg</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-mono font-bold text-blue-400">
                        {selected.phosphorus}
                      </div>
                      <div className="text-[10px] text-slate-500">P mg/kg</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-mono font-bold text-purple-400">
                        {selected.potassium}
                      </div>
                      <div className="text-[10px] text-slate-500">K mg/kg</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">pH</span>
                  <span className="font-mono">{selected.ph}</span>
                </div>

                {selected.disease && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center gap-1.5 text-red-400 text-xs font-medium mb-1">
                      <AlertTriangle size={12} />
                      Disease Detected
                    </div>
                    <div className="text-sm text-slate-300">
                      {selected.disease}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Apply fungicide within 48 hours
                    </div>
                  </div>
                )}

                {selected.health === "alert" && !selected.disease && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium mb-1">
                      <AlertTriangle size={12} />
                      Moisture Stress
                    </div>
                    <div className="text-xs text-slate-300">
                      Below drought threshold. Consider deficit irrigation.
                      Similar conditions at Cook Farm Station 22 (Aug 2012)
                      preceded crop loss.
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-slate-600 pt-2">
                  Last update:{" "}
                  {new Date(selected.lastUpdated).toLocaleTimeString()}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-600">
              Click a block to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
