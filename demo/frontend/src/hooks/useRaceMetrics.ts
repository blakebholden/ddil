import { useState, useCallback } from "react";
import { useWebSocket } from "./useWebSocket";

export interface PathMetrics {
  docsIndexed: number;
  totalDocs: number;
  throughput: number; // vectors/sec
  mergeTimeMs: number;
  cpuPercent?: number;
  gpuPercent?: number;
  memoryUsedGb?: number;
  history: { time: number; throughput: number }[];
  complete: boolean;
  elapsedMs: number;
}

export interface RaceMetrics {
  gpu: PathMetrics;
  cpu: PathMetrics;
  speedup: number;
  timeSaved: number;
  recallGpu: number;
  recallCpu: number;
  status: "idle" | "running" | "complete";
}

const emptyPath: PathMetrics = {
  docsIndexed: 0,
  totalDocs: 0,
  throughput: 0,
  mergeTimeMs: 0,
  history: [],
  complete: false,
  elapsedMs: 0,
};

const initialMetrics: RaceMetrics = {
  gpu: { ...emptyPath },
  cpu: { ...emptyPath },
  speedup: 0,
  timeSaved: 0,
  recallGpu: 0,
  recallCpu: 0,
  status: "idle",
};

export function useRaceMetrics() {
  const [metrics, setMetrics] = useState<RaceMetrics>(initialMetrics);

  const handleMessage = useCallback((data: unknown) => {
    setMetrics(data as RaceMetrics);
  }, []);

  const { connected, connect, disconnect } = useWebSocket({
    url: `ws://${window.location.hostname}:8000/api/race/status`,
    onMessage: handleMessage,
  });

  const startRace = async () => {
    const res = await fetch("/api/race/start", { method: "POST" });
    if (res.ok) connect();
    return res.ok;
  };

  const resetRace = async () => {
    disconnect();
    setMetrics(initialMetrics);
    await fetch("/api/race/reset", { method: "POST" });
  };

  return { metrics, connected, startRace, resetRace };
}
