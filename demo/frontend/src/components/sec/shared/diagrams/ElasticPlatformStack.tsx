/**
 * Elastic Platform Stack — four-tier diagram mirroring deck p.16.
 *   AI Native Experiences
 *      ↑ Tools (MCP)  ·  Agents (A2A)
 *   Elasticsearch Platform · Data Lake
 *      ↑
 *   Enterprise Data Sources
 */
import { Sparkles, Wrench, Bot, Server, Database } from "lucide-react";

interface ChipProps { label: string; }
function Chip({ label }: ChipProps) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-800/70 text-[10px] font-medium text-slate-300 ring-1 ring-slate-700/60">
      {label}
    </span>
  );
}

export function ElasticPlatformStack() {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-3">
      {/* Tier 1 — AI Native Experiences */}
      <Tier
        accent="elastic"
        icon={<Sparkles size={14} />}
        title="AI Native Experiences"
        chips={["Chat Assistants", "Voice Assistants", "AI Reasoning", "Custom Apps", "Claude", "Salesforce", "LangChain"]}
      />

      {/* Tier 2 — Tools / Agents bridge */}
      <div className="grid grid-cols-2 gap-3">
        <Tier compact accent="nvidia" icon={<Wrench size={12} />} title="Tools" subtitle="MCP" chips={[]} />
        <Tier compact accent="nvidia" icon={<Bot    size={12} />} title="Agents" subtitle="A2A" chips={[]} />
      </div>

      {/* Tier 3 — Elasticsearch Platform */}
      <Tier
        accent="elastic"
        icon={<Server size={14} />}
        title="Elasticsearch Platform"
        chips={["Ingest", "Process", "Storage & Replication", "Search", "AI & ML Analysis", "Visualization", "Workflow Automation"]}
        footer="Data Lake"
      />

      {/* Tier 4 — Enterprise Data Sources */}
      <Tier
        accent="muted"
        icon={<Database size={14} />}
        title="Enterprise Data Sources"
        chips={["SEC EDGAR", "Drive", "GitHub", "Salesforce", "SharePoint", "Confluence", "Teams", "Slack"]}
      />
    </div>
  );
}

function Tier({
  title, subtitle, chips, footer, accent, icon, compact,
}: {
  title: string;
  subtitle?: string;
  chips: string[];
  footer?: string;
  accent: "elastic" | "nvidia" | "muted";
  icon: React.ReactNode;
  compact?: boolean;
}) {
  const palette =
    accent === "elastic"
      ? "border-[var(--color-elastic)]/40 bg-[var(--color-elastic)]/5 text-[var(--color-elastic)]"
      : accent === "nvidia"
      ? "border-[var(--color-nvidia)]/40 bg-[var(--color-nvidia)]/5 text-[var(--color-nvidia)]"
      : "border-slate-700/60 bg-slate-900/40 text-slate-300";
  return (
    <div className={`rounded-xl border ${palette} ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <div className={`font-semibold ${compact ? "text-sm" : "text-base"}`}>{title}</div>
        {subtitle && <span className="text-[10px] text-slate-400 ml-1">· {subtitle}</span>}
      </div>
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((c) => <Chip key={c} label={c} />)}
        </div>
      )}
      {footer && <div className="mt-2 text-[10px] text-slate-500 italic">{footer}</div>}
    </div>
  );
}
