import { useState, useCallback } from "react";
import { useWebSocket } from "./useWebSocket";

export type Phase = "idle" | "ingesting" | "force_merging" | "complete" | "error";

export interface PathMetrics {
  docsIndexed: number;
  totalDocs: number;
  throughput: number;
  ingestMs: number;
  forceMergeMs: number;
  history: { time: number; throughput: number }[];
  phase: Phase;
  complete: boolean;
  elapsedMs: number;
  error?: string | null;
}

export interface RaceMetrics {
  gpu: PathMetrics;
  cpu: PathMetrics;
  status: "idle" | "running" | "complete" | "error";
  speedup: number;
  ingestSpeedup: number;
  forceMergeSpeedup: number;
  timeSaved: number;
  recallGpu: number;
  recallCpu: number;
}

const emptyPath: PathMetrics = {
  docsIndexed: 0, totalDocs: 0, throughput: 0, ingestMs: 0, forceMergeMs: 0,
  history: [], phase: "idle", complete: false, elapsedMs: 0,
};

const initialMetrics: RaceMetrics = {
  gpu: { ...emptyPath }, cpu: { ...emptyPath },
  status: "idle", speedup: 0, ingestSpeedup: 0, forceMergeSpeedup: 0,
  timeSaved: 0, recallGpu: 0, recallCpu: 0,
};

function wsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/race/status`;
}

export function useRaceMetrics() {
  const [metrics, setMetrics] = useState<RaceMetrics>(initialMetrics);

  const handleMessage = useCallback((data: unknown) => {
    setMetrics(data as RaceMetrics);
  }, []);

  const { connected, connect, disconnect } = useWebSocket({
    url: wsUrl(),
    onMessage: handleMessage,
    autoConnect: true,            // poll the current state on mount so chapter loads warm
  });

  const startRace = async () => {
    const res = await fetch("/api/race/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
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
