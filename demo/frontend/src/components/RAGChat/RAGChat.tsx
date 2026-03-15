import { useState, useRef, useEffect } from "react";
import { Send, BookOpen, ChevronDown, ChevronUp } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; index: string; score: number }[];
  latency?: { total: number; firstToken: number };
}

export function RAGChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          sources: data.sources,
          latency: data.latency,
        },
      ]);
    } catch {
      // Mock response for development
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Based on current readings and historical analysis:\n\n**Risk Level: MODERATE-HIGH**\n\nBlock B3 soil moisture (34.2%) is tracking below the seasonal average. Looking at similar conditions in the Cook Farm dataset:\n\n- 73% of similar profiles led to drought stress within 10 days\n- EC trend (0.42 -> 0.48 dS/m over 72hrs) suggests increasing salt concentration from reduced water movement\n\n**Recommendation:** Initiate deficit irrigation in B3 within 48 hours. Monitor B7 (similar trajectory, 2 days behind).`,
          sources: [
            {
              title: "Cook Farm Station 22 — Aug 2012",
              index: "vineyard-soil",
              score: 0.94,
            },
            {
              title: "Block B3 Latest Reading",
              index: "vineyard-soil",
              score: 0.91,
            },
            {
              title: "SoMo.ml VA Region — Seasonal Trend",
              index: "vineyard-soil",
              score: 0.87,
            },
            {
              title: "Crop Recommendation — Grape Profile",
              index: "vineyard-npk",
              score: 0.82,
            },
          ],
          latency: { total: 3800, firstToken: 900 },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-1">AI Agronomist</h2>
      <p className="text-sm text-slate-400 mb-4">
        RAG Chat &middot; Elastic Retrieval + llama3.1:70b on DGX Spark
      </p>

      {/* Messages */}
      <div className="flex-1 overflow-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-600 mt-20">
            <p className="text-lg mb-2">Ask about your vineyard</p>
            <p className="text-sm">
              Try: "What's the drought risk for Block B3 this week?"
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-lg p-4 ${
                msg.role === "user"
                  ? "bg-emerald-600/20 border border-emerald-500/30 text-slate-200"
                  : "bg-slate-900/70 border border-slate-800 text-slate-300"
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 border-t border-slate-700/50 pt-2">
                  <button
                    onClick={() =>
                      setExpandedSources(expandedSources === i ? null : i)
                    }
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400"
                  >
                    <BookOpen size={12} />
                    {msg.sources.length} sources
                    {expandedSources === i ? (
                      <ChevronUp size={12} />
                    ) : (
                      <ChevronDown size={12} />
                    )}
                  </button>
                  {expandedSources === i && (
                    <div className="mt-2 space-y-1">
                      {msg.sources.map((s, j) => (
                        <div
                          key={j}
                          className="text-xs text-slate-500 flex items-center gap-2"
                        >
                          <span className="font-mono text-emerald-500/70">
                            {s.score.toFixed(2)}
                          </span>
                          <span>{s.title}</span>
                          <span className="px-1 py-0.5 bg-slate-800 rounded text-[10px]">
                            {s.index}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {msg.latency && (
                <div className="mt-2 text-[10px] text-slate-600">
                  {(msg.latency.total / 1000).toFixed(1)}s total &middot;{" "}
                  {(msg.latency.firstToken / 1000).toFixed(1)}s to first token
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.15s" }}
                />
                <div
                  className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.3s" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask about soil conditions, crop health, irrigation..."
          className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
