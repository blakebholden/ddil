/**
 * Hub-and-spoke: one ES index → analyst, developer, agent, workflow.
 * Visual answer to "same vectors, multiple consumers".
 */
import { Database, User, Code2, Bot, Workflow } from "lucide-react";

interface SpokeProps {
  Icon: typeof User;
  label: string;
  detail: string;
  tone: "elastic" | "nvidia" | "amber" | "violet";
}

const SPOKES: SpokeProps[] = [
  { Icon: User,     label: "Analyst UI",       detail: "natural-language semantic search · sub-100ms", tone: "elastic" },
  { Icon: Code2,    label: "Developer API",    detail: "cURL · Python · Kibana Dev Tools",             tone: "nvidia" },
  { Icon: Bot,      label: "Agent",            detail: "Elastic Agent Builder · Bedrock Opus",         tone: "amber" },
  { Icon: Workflow, label: "Workflow",         detail: "scheduled / alert-triggered automation",       tone: "violet" },
];

const TONE: Record<SpokeProps["tone"], { ring: string; bg: string; icon: string }> = {
  elastic: { ring: "ring-[var(--color-elastic)]/40", bg: "bg-[var(--color-elastic)]/10", icon: "text-[var(--color-elastic)]" },
  nvidia:  { ring: "ring-[var(--color-nvidia)]/40",  bg: "bg-[var(--color-nvidia)]/10",  icon: "text-[var(--color-nvidia)]"  },
  amber:   { ring: "ring-amber-500/40",              bg: "bg-amber-500/10",              icon: "text-amber-300"               },
  violet:  { ring: "ring-violet-500/40",             bg: "bg-violet-500/10",             icon: "text-violet-300"              },
};

export function OneIndexFourConsumers() {
  return (
    <div className="relative w-full max-w-md mx-auto h-[360px]">
      {/* Hub */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="rounded-2xl border border-slate-600/60 bg-slate-900 px-5 py-4 text-center shadow-lg shadow-slate-950/40">
          <Database size={24} className="text-slate-200 mx-auto mb-1" />
          <div className="text-sm font-bold text-slate-100">sec_10k_2026</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">93,541 chunks · 1536-d HNSW</div>
        </div>
      </div>

      {/* Spokes */}
      {SPOKES.map((s, i) => {
        const cls = TONE[s.tone];
        // 4 corners
        const pos = [
          { top: 0, left: 0 },
          { top: 0, right: 0 },
          { bottom: 0, left: 0 },
          { bottom: 0, right: 0 },
        ][i];
        return (
          <div key={s.label} className="absolute w-44" style={pos}>
            <div className={`rounded-xl ring-1 ${cls.ring} ${cls.bg} p-3`}>
              <s.Icon size={16} className={`${cls.icon} mb-1.5`} />
              <div className="text-sm font-semibold text-slate-100">{s.label}</div>
              <div className="text-[10px] text-slate-400 leading-snug mt-0.5">{s.detail}</div>
            </div>
          </div>
        );
      })}

      {/* Connection lines — simple SVG */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 360" preserveAspectRatio="none">
        <line x1="88"  y1="40"  x2="200" y2="180" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="312" y1="40"  x2="200" y2="180" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="88"  y1="320" x2="200" y2="180" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="312" y1="320" x2="200" y2="180" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
      </svg>
    </div>
  );
}
