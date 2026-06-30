import { Loader2, CheckCircle2, GitMerge, AlertCircle } from "lucide-react";
import type { Phase } from "../hooks/useRaceMetrics";

const STYLES: Record<Phase, { label: string; cls: string; Icon: typeof Loader2 | null }> = {
  idle:          { label: "Idle",          cls: "bg-slate-700/50 text-slate-300",        Icon: null },
  ingesting:     { label: "Ingesting",     cls: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",     Icon: Loader2 },
  force_merging: { label: "Force-merging", cls: "bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-500/30", Icon: GitMerge },
  complete:      { label: "Complete",      cls: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30", Icon: CheckCircle2 },
  error:         { label: "Error",         cls: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",        Icon: AlertCircle },
};

export function PhasePill({ phase }: { phase: Phase }) {
  const s = STYLES[phase] ?? STYLES.idle;
  const Icon = s.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${s.cls}`}>
      {Icon && <Icon size={12} className={phase === "ingesting" ? "animate-spin" : ""} />}
      {s.label}
    </span>
  );
}
