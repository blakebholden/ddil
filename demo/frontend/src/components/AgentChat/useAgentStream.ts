import { useState, useCallback, useRef } from "react";

export interface PhaseInfo {
  id: string;
  name: string;
  status: "pending" | "running" | "complete" | "error";
  data?: Record<string, unknown>;
  messages: string[];
  progress_pct: number;
}

export interface AgentStreamState {
  jobId: string | null;
  phases: PhaseInfo[];
  isRunning: boolean;
  error: string | null;
  results: Record<string, unknown> | null;
  elapsed: number;
}

const INITIAL_PHASES: PhaseInfo[] = [
  { id: "sensors", name: "Sensor Snapshot", status: "pending", messages: [], progress_pct: 0 },
  { id: "historical", name: "Historical Context", status: "pending", messages: [], progress_pct: 0 },
  { id: "risk", name: "Risk Analysis", status: "pending", messages: [], progress_pct: 0 },
  { id: "recommendation", name: "Crop Recommendation", status: "pending", messages: [], progress_pct: 0 },
  { id: "action_plan", name: "Action Plan", status: "pending", messages: [], progress_pct: 0 },
];

export function useAgentStream() {
  const [state, setState] = useState<AgentStreamState>({
    jobId: null,
    phases: INITIAL_PHASES.map((p) => ({ ...p })),
    isRunning: false,
    error: null,
    results: null,
    elapsed: 0,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setState({
      jobId: null,
      phases: INITIAL_PHASES.map((p) => ({ ...p })),
      isRunning: false,
      error: null,
      results: null,
      elapsed: 0,
    });
  }, []);

  const startStream = useCallback(
    async (message: string, blockId?: string) => {
      reset();
      setState((s) => ({ ...s, isRunning: true }));
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        setState((s) => ({
          ...s,
          elapsed: Math.round((Date.now() - startTimeRef.current) / 1000),
        }));
      }, 1000);

      try {
        const resp = await fetch("/api/chat/agent/stream", {
          method: "POST",
          headers: {
            Accept: "text/event-stream",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message, block_id: blockId }),
        });

        if (!resp.ok || !resp.body) {
          throw new Error(`Stream failed: ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const eventText of events) {
            const lines = eventText.split("\n");
            let eventType: string | null = null;
            let eventData: Record<string, unknown> | null = null;

            for (const line of lines) {
              if (line.startsWith("event: "))
                eventType = line.slice(7).trim();
              else if (line.startsWith("data: ")) {
                try {
                  eventData = JSON.parse(line.slice(6));
                } catch {
                  /* skip malformed */
                }
              }
            }

            if (eventType && eventData) {
              handleEvent(eventType, eventData);
            }
          }
        }
      } catch (err) {
        setState((s) => ({
          ...s,
          isRunning: false,
          error: err instanceof Error ? err.message : "Stream failed",
        }));
      } finally {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    },
    [reset]
  );

  function handleEvent(type: string, data: Record<string, unknown>) {
    switch (type) {
      case "job_start":
        setState((s) => ({ ...s, jobId: data.job_id as string }));
        break;

      case "phase_start":
        setState((s) => ({
          ...s,
          phases: s.phases.map((p) =>
            p.id === data.phase_id
              ? { ...p, status: "running" as const, progress_pct: (data.progress_pct as number) || p.progress_pct }
              : p
          ),
        }));
        break;

      case "phase_progress":
        setState((s) => ({
          ...s,
          phases: s.phases.map((p) =>
            p.id === data.phase_id
              ? { ...p, messages: [...p.messages, data.message as string] }
              : p
          ),
        }));
        break;

      case "phase_complete":
        setState((s) => ({
          ...s,
          phases: s.phases.map((p) =>
            p.id === data.phase_id
              ? {
                  ...p,
                  status: "complete" as const,
                  data: data.data as Record<string, unknown>,
                  progress_pct: (data.progress_pct as number) || p.progress_pct,
                }
              : p
          ),
        }));
        break;

      case "phase_error":
        setState((s) => ({
          ...s,
          phases: s.phases.map((p) =>
            p.id === data.phase_id
              ? { ...p, status: "error" as const, messages: [...p.messages, data.message as string] }
              : p
          ),
        }));
        break;

      case "job_complete":
        setState((s) => ({
          ...s,
          isRunning: false,
          results: data.results as Record<string, unknown>,
        }));
        break;

      case "job_error":
        setState((s) => ({
          ...s,
          isRunning: false,
          error: data.message as string,
        }));
        break;
    }
  }

  return { state, startStream, reset };
}
