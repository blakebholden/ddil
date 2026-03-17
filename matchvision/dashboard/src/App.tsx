import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  Activity,
  Users,
  Circle,
  Wifi,
  WifiOff,
  RotateCcw,
  Gauge,
} from "lucide-react";
import "./App.css";

const VISION_HOST = "http://192.168.1.20:8010";

interface Detection {
  track_id: number;
  team: string;
  label: string;
  center: [number, number];
  confidence: number;
}

interface Stats {
  frame: number;
  fps: number;
  inference_ms: number;
  home_count: number;
  away_count: number;
  ball_detected: boolean;
  ball_position: [number, number] | null;
  possession_home: number;
  possession_away: number;
  detections: Detection[];
  timestamp: number;
}

function PossessionBar({ home, away }: { home: number; away: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-red-400 font-mono text-sm w-12 text-right">
        {home.toFixed(0)}%
      </span>
      <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden flex">
        <motion.div
          className="bg-red-500 h-full"
          animate={{ width: `${home}%` }}
          transition={{ duration: 0.5 }}
        />
        <motion.div
          className="bg-slate-300 h-full"
          animate={{ width: `${away}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <span className="text-slate-300 font-mono text-sm w-12">
        {away.toFixed(0)}%
      </span>
    </div>
  );
}

function MiniPitch({ detections }: { detections: Detection[] }) {
  // Map detection pixel positions to a mini pitch representation
  // Assuming broadcast view: ~1280px wide, ~720px tall
  const pitchW = 280;
  const pitchH = 180;

  return (
    <div
      className="relative bg-emerald-900/40 border border-emerald-700/50 rounded-lg overflow-hidden"
      style={{ width: pitchW, height: pitchH }}
    >
      {/* Pitch markings */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 border border-emerald-600/30 rounded-full" />
      </div>
      <div
        className="absolute top-0 bottom-0 border-r border-emerald-600/30"
        style={{ left: "50%" }}
      />
      {/* Penalty areas */}
      <div className="absolute top-1/4 left-0 w-12 h-1/2 border border-emerald-600/20 rounded-r" />
      <div className="absolute top-1/4 right-0 w-12 h-1/2 border border-emerald-600/20 rounded-l" />

      {/* Player dots */}
      {detections.map((d) => {
        // Normalize position (assume 1280x720 frame)
        const x = (d.center[0] / 1280) * pitchW;
        const y = (d.center[1] / 720) * pitchH;
        const color =
          d.team === "home"
            ? "bg-red-500"
            : d.team === "ball"
            ? "bg-yellow-400"
            : d.team === "referee"
            ? "bg-green-400"
            : "bg-slate-300";
        const size = d.label === "ball" ? "w-2 h-2" : "w-2.5 h-2.5";

        return (
          <motion.div
            key={`${d.label}-${d.track_id}`}
            className={`absolute rounded-full ${color} ${size}`}
            animate={{ left: x - 5, top: y - 5 }}
            transition={{ duration: 0.15 }}
          />
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color = "text-slate-300",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [connected, setConnected] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  const connectWs = useCallback(() => {
    const ws = new WebSocket(`ws://192.168.1.20:8010/ws/stats`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 2s
      setTimeout(connectWs, 2000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try {
        const data: Stats = JSON.parse(e.data);
        setStats(data);
        setFrameCount(data.frame);
      } catch {}
    };
  }, []);

  useEffect(() => {
    connectWs();
    return () => wsRef.current?.close();
  }, [connectWs]);

  const handleReset = async () => {
    try {
      await fetch(`${VISION_HOST}/reset`, { method: "POST" });
    } catch {}
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="text-red-400" size={24} />
          <div>
            <h1 className="text-lg font-bold tracking-tight">MatchVision</h1>
            <p className="text-xs text-slate-500">
              Real-time AI match analysis &middot; NVIDIA Blackwell
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            {connected ? (
              <>
                <Wifi size={14} className="text-emerald-400" />
                <span className="text-emerald-400">Live</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-red-400" />
                <span className="text-red-400">Disconnected</span>
              </>
            )}
          </div>
          <button
            onClick={handleReset}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Left: Video Feed */}
        <div className="flex-1 p-4 flex flex-col">
          <div className="relative flex-1 bg-black rounded-lg overflow-hidden border border-slate-800">
            {/* MJPEG annotated stream */}
            <img
              src={`${VISION_HOST}/stream/mjpeg`}
              alt="Annotated match feed"
              className="w-full h-full object-contain"
            />

            {/* Connection overlay */}
            {!connected && !stats && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                <div className="text-center">
                  <Eye size={48} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">
                    Waiting for frames...
                  </p>
                  <p className="text-slate-600 text-xs mt-1">
                    Start the capture script on the Framework
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
            <span>Frame #{frameCount}</span>
            <span>
              {stats
                ? `${stats.fps.toFixed(1)} fps · ${stats.inference_ms.toFixed(0)}ms inference`
                : "—"}
            </span>
          </div>
        </div>

        {/* Right: Stats Panel */}
        <div className="w-80 border-l border-slate-800 p-4 overflow-auto flex flex-col gap-4">
          {/* Possession */}
          <div>
            <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Possession
            </h3>
            <PossessionBar
              home={stats?.possession_home ?? 50}
              away={stats?.possession_away ?? 50}
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>Home</span>
              <span>Away</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Home Players"
              value={stats?.home_count ?? 0}
              icon={<Users size={12} />}
              color="text-red-400"
            />
            <StatCard
              label="Away Players"
              value={stats?.away_count ?? 0}
              icon={<Users size={12} />}
              color="text-slate-300"
            />
            <StatCard
              label="FPS"
              value={stats?.fps.toFixed(1) ?? "—"}
              icon={<Gauge size={12} />}
              color="text-emerald-400"
            />
            <StatCard
              label="Inference"
              value={stats ? `${stats.inference_ms.toFixed(0)}ms` : "—"}
              icon={<Activity size={12} />}
              color="text-blue-400"
            />
          </div>

          {/* Ball Status */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Circle size={12} />
              Ball Tracking
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  stats?.ball_detected
                    ? "bg-yellow-400 animate-pulse"
                    : "bg-slate-700"
                }`}
              />
              <span className="text-sm">
                {stats?.ball_detected
                  ? `Detected at (${stats.ball_position?.[0]}, ${stats.ball_position?.[1]})`
                  : "Not detected"}
              </span>
            </div>
          </div>

          {/* Mini Pitch */}
          <div>
            <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Pitch Map
            </h3>
            <MiniPitch detections={stats?.detections ?? []} />
          </div>

          {/* Detection List */}
          <div className="flex-1 min-h-0">
            <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Tracked Objects ({stats?.detections.length ?? 0})
            </h3>
            <div className="space-y-1 overflow-auto max-h-60">
              {stats?.detections.map((d) => (
                <div
                  key={`${d.label}-${d.track_id}`}
                  className="flex items-center justify-between text-xs bg-slate-900/50 rounded px-2 py-1"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        d.team === "home"
                          ? "bg-red-500"
                          : d.team === "ball"
                          ? "bg-yellow-400"
                          : d.team === "referee"
                          ? "bg-green-400"
                          : "bg-slate-300"
                      }`}
                    />
                    <span className="text-slate-300">
                      #{d.track_id} {d.team}
                    </span>
                  </div>
                  <span className="text-slate-600 font-mono">
                    {(d.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-[10px] text-slate-700 border-t border-slate-800 pt-2">
            DGX Spark Blackwell GPU · YOLOv8x · ByteTrack
          </div>
        </div>
      </div>
    </div>
  );
}
