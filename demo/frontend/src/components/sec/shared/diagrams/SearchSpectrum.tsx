/**
 * "Search is changing in the Era of Agentic AI" spectrum — 4 tiers ascending
 * diagonally. Each card lives in its own fixed-width grid column with no
 * max-width override, so it never visually escapes its lane. The "you are
 * here" indicator sits BELOW the active card rather than inside it.
 */
import { Link as LinkIcon, MessageSquare, MessagesSquare, Sparkles } from "lucide-react";

interface Tier {
  Icon: typeof LinkIcon;
  label: string;
  sub: string;
  rise: number;            // 0–3, how many "steps" up the diagonal this tier sits
}

const TIERS: Tier[] = [
  { Icon: LinkIcon,       label: "10 Blue Links",        sub: "keyword recall",                      rise: 0 },
  { Icon: MessageSquare,  label: "Natural Language Q&A", sub: "semantic retrieval",                  rise: 1 },
  { Icon: MessagesSquare, label: "Conversational AI",    sub: "multi-turn, human-driven",            rise: 2 },
  { Icon: Sparkles,       label: "Agentic AI",           sub: "decisions + autonomous action",       rise: 3 },
];

const STEP_PX = 52;
const CARD_H = 78;
const PADDING_TOP = 26;
const PADDING_BOTTOM = 36;
const CHART_H = (TIERS.length - 1) * STEP_PX + CARD_H + PADDING_TOP + PADDING_BOTTOM;

export function SearchSpectrum({ activeIndex = 3 }: { activeIndex?: number }) {
  return (
    <div className="relative w-full" style={{ height: CHART_H }}>
      {/* Y-axis label */}
      <div className="absolute left-0 top-2 bottom-7 w-6 flex items-start">
        <div className="text-[9px] uppercase tracking-wider text-slate-500 -rotate-90 origin-top-left translate-x-3 translate-y-32 whitespace-nowrap">
          Degree of automation →
        </div>
      </div>

      {/* Axes */}
      <div className="absolute left-6 top-2 bottom-7 w-px bg-slate-700/60" />
      <div className="absolute left-6 right-1 bottom-7 h-px bg-slate-700/60" />

      {/* X-axis label */}
      <div className="absolute left-6 right-1 bottom-0 text-[9px] uppercase tracking-wider text-slate-500 text-center">
        Criticality of search relevance →
      </div>

      {/* Diagonal grid — each tier owns its column, lifted by rise * STEP_PX */}
      <div
        className="absolute left-7 right-2 grid"
        style={{
          gridTemplateColumns: `repeat(${TIERS.length}, minmax(0, 1fr))`,
          columnGap: 8,
          top: PADDING_TOP - 8,
          bottom: PADDING_BOTTOM,
        }}
      >
        {TIERS.map((t, i) => {
          const active = i === activeIndex;
          const bottom = t.rise * STEP_PX;
          return (
            <div key={t.label} className="relative">
              <div
                className={`absolute inset-x-0 flex flex-col items-stretch`}
                style={{ bottom }}
              >
                <div
                  className={`rounded-lg border px-1.5 py-1.5 text-center transition-all ${
                    active
                      ? "border-[var(--color-elastic)]/70 bg-[var(--color-elastic)]/10 shadow-md shadow-[var(--color-elastic)]/10"
                      : "border-slate-700/60 bg-slate-900/70"
                  }`}
                  style={{ minHeight: CARD_H }}
                >
                  <t.Icon size={12} className={`mx-auto ${active ? "text-[var(--color-elastic)]" : "text-slate-400"}`} />
                  <div className={`mt-1 text-[10px] font-semibold leading-tight break-words ${active ? "text-slate-100" : "text-slate-300"}`}>
                    {t.label}
                  </div>
                  <div className="text-[9px] text-slate-500 leading-tight mt-0.5 break-words">{t.sub}</div>
                </div>
                {active && (
                  <div className="mt-1 text-[9px] font-mono font-semibold text-[var(--color-elastic)] text-center uppercase tracking-wider">
                    ← you are here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
