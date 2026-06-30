import { useCallback, useRef, useState } from "react";

/**
 * SSE state machine for Kibana Agent Builder (9.4).
 *
 * Event grammar observed end-to-end:
 *   conversation_id_set → (reasoning|tool_call|tool_progress|tool_result)*
 *   → thinking_complete → message_chunk* → message_complete → round_complete → conversation_created
 */

export interface ReasoningNote {
  text: string;
  transient?: boolean;        // 9.4 marks scaffolding-only thoughts
  tool_call_id?: string;      // when set, this thought triggered a specific tool call
  tool_call_group_id?: string;
}

export interface ToolStep {
  id: string;                 // tool_call_id
  tool: string;               // tool_id, e.g. platform.core.search
  params: Record<string, unknown>;
  progress: string[];
  results?: ToolResultEntry[];
  status: "running" | "done" | "error";
}

export interface ToolResultEntry {
  type: string;
  // Per-tool-result payload — keep raw for inspection in the UI
  data: unknown;
  tool_result_id?: string;
}

export interface RoundMetadata {
  llmCalls?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  timeToFirstTokenMs?: number;
  timeToLastTokenMs?: number;
}

export interface AgentChatState {
  status: "idle" | "starting" | "streaming" | "done" | "error";
  conversationId?: string;
  reasoning: ReasoningNote[];     // accumulated, including transient
  tools: ToolStep[];               // ordered list of tool calls
  answer: string;                  // streamed final answer
  meta: RoundMetadata;
  error?: string;
}

const empty: AgentChatState = {
  status: "idle",
  reasoning: [],
  tools: [],
  answer: "",
  meta: {},
};

export function useAgentChat() {
  const [state, setState] = useState<AgentChatState>(empty);
  const ctrlRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    setState(empty);
  }, []);

  const send = useCallback(async (input: string) => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    setState({ ...empty, status: "starting" });

    let resp: Response;
    try {
      resp = await fetch("/api/finance/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
        signal: ctrl.signal,
      });
    } catch (e) {
      setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : String(e) }));
      return;
    }
    if (!resp.ok || !resp.body) {
      setState({ ...empty, status: "error", error: `HTTP ${resp.status}` });
      return;
    }

    setState((s) => ({ ...s, status: "streaming" }));

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buf = "";

    // Iterate raw chunks; SSE events are delimited by blank lines.
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        break;
      }
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });

      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const lines = raw.split("\n").filter((l) => l && !l.startsWith(":"));
        let eventName = "message";
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        let payload: { data?: Record<string, unknown>; error?: { message?: string } } = {};
        try {
          payload = JSON.parse(dataLines.join("\n"));
        } catch { continue; }

        handle(eventName, payload, setState);
      }
    }

    setState((s) => (s.status === "streaming" ? { ...s, status: "done" } : s));
  }, []);

  return { state, send, reset };
}

// ─────────────── event handler ──────────────────────────────────────────────
type Setter = (fn: (s: AgentChatState) => AgentChatState) => void;

function handle(event: string, payload: { data?: Record<string, unknown>; error?: { message?: string } }, set: Setter) {
  const d = (payload.data ?? {}) as Record<string, unknown>;

  switch (event) {
    case "conversation_id_set":
      set((s) => ({ ...s, conversationId: String(d.conversation_id ?? "") }));
      return;

    case "reasoning": {
      const text = String(d.reasoning ?? "");
      if (!text) return;
      const note: ReasoningNote = {
        text,
        transient: Boolean(d.transient),
        tool_call_id: d.tool_call_id ? String(d.tool_call_id) : undefined,
        tool_call_group_id: d.tool_call_group_id ? String(d.tool_call_group_id) : undefined,
      };
      set((s) => ({ ...s, reasoning: [...s.reasoning, note] }));
      return;
    }

    case "tool_call": {
      const id = String(d.tool_call_id ?? "");
      const tool = String(d.tool_id ?? "");
      const params = (d.params ?? {}) as Record<string, unknown>;
      set((s) => ({
        ...s,
        tools: [...s.tools, { id, tool, params, progress: [], status: "running" }],
      }));
      return;
    }

    case "tool_progress": {
      const id = String(d.tool_call_id ?? "");
      const msg = String(d.message ?? "");
      set((s) => ({
        ...s,
        tools: s.tools.map((t) =>
          t.id === id ? { ...t, progress: [...t.progress, msg] } : t,
        ),
      }));
      return;
    }

    case "tool_result": {
      const id = String(d.tool_call_id ?? "");
      const results = Array.isArray(d.results) ? (d.results as ToolResultEntry[]) : [];
      const hasErr = results.some((r) => r?.type === "error");
      set((s) => ({
        ...s,
        tools: s.tools.map((t) =>
          t.id === id ? { ...t, results, status: hasErr ? "error" : "done" } : t,
        ),
      }));
      return;
    }

    case "thinking_complete": {
      const ms = d.time_to_first_token as number | undefined;
      set((s) => ({ ...s, meta: { ...s.meta, timeToFirstTokenMs: ms } }));
      return;
    }

    case "message_chunk": {
      const chunk = String((d as Record<string, unknown>).text_chunk ?? (d as Record<string, unknown>).message_chunk ?? "");
      if (!chunk) return;
      set((s) => ({ ...s, answer: s.answer + chunk }));
      return;
    }

    case "round_complete": {
      const round = (d.round ?? {}) as Record<string, unknown>;
      const usage = (round.model_usage ?? {}) as Record<string, unknown>;
      const ttl = round.time_to_last_token as number | undefined;
      const response = (round.response ?? {}) as Record<string, unknown>;
      const fullMessage = response.message as string | undefined;
      set((s) => ({
        ...s,
        // round_complete carries the canonical final message — use it if our
        // streamed accumulation was empty (some chunks don't carry text).
        answer: s.answer || fullMessage || "",
        meta: {
          ...s.meta,
          llmCalls: usage.llm_calls as number | undefined,
          inputTokens: usage.input_tokens as number | undefined,
          outputTokens: usage.output_tokens as number | undefined,
          model: usage.model as string | undefined,
          timeToLastTokenMs: ttl,
        },
        status: "done",
      }));
      return;
    }

    case "error":
      set((s) => ({ ...s, status: "error", error: payload.error?.message ?? "unknown error" }));
      return;
  }
}
