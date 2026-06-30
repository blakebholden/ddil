import { useEffect, useState } from "react";
import { Bot, Cpu, Database, Layers, ExternalLink } from "lucide-react";

interface State {
  kibana_url: string;
  space: string;
  agent_id: string;
  connector_id: string;
  llm_model: string;
  embed_model: string;
  sec_index: string;
  es_inference: string;
}

export function AgentConfigCard() {
  const [s, setS] = useState<State | null>(null);
  useEffect(() => {
    fetch("/api/finance/agent/state").then((r) => r.json()).then(setS).catch(() => setS(null));
  }, []);

  if (!s) {
    return <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5 text-xs text-slate-500 italic">loading agent config…</div>;
  }

  const kbAgent = `${s.kibana_url}/app/agent_builder/agents/${s.agent_id}`;
  const kbWorkflows = `${s.kibana_url}/app/workflows`;
  const kbConnector = `${s.kibana_url}/app/management/insightsAndAlerting/triggersActionsConnectors/connectors/${s.connector_id}`;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Bot size={16} className="text-[var(--color-elastic)]" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">Agent configuration</h3>
      </div>

      <Row Icon={Bot}       label="Agent"         value={s.agent_id}    sub={`space · ${s.space}`}              href={kbAgent} />
      <Row Icon={Cpu}       label="LLM"           value={s.llm_model}   sub="Bedrock · via Kibana connector"    href={kbConnector} />
      <Row Icon={Layers}    label="Embedder"      value={s.embed_model} sub="1536-d · query-time only"          />
      <Row Icon={Database}  label="Default index" value={s.sec_index}   sub="93,541 chunks · 503 filings"
           chip={{ label: "GPU-built", title: "Built on the L4 GPU node in chapter 01 — 50× faster force-merge than CPU." }} />

      <div className="pt-4 border-t border-slate-700/40 space-y-2">
        <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Manage in Kibana</div>
        <Link href={kbAgent}     label="Open agent in Agent Builder" />
        <Link href={kbWorkflows} label="Workflows · invoke this agent on a schedule" />
        <Link href={kbConnector} label="Bedrock connector · LLM keys + model" />
      </div>
    </div>
  );
}

function Row({ Icon, label, value, sub, href, chip }: { Icon: typeof Bot; label: string; value: string; sub: string; href?: string; chip?: { label: string; title?: string } }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={14} className="text-slate-500 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
          {chip && (
            <span
              title={chip.title}
              className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[9px] font-semibold tracking-wider uppercase bg-[var(--color-nvidia)]/15 text-[var(--color-nvidia)] ring-1 ring-[var(--color-nvidia)]/30"
            >
              <span className="inline-block w-1 h-1 rounded-full bg-[var(--color-nvidia)]" />
              {chip.label}
            </span>
          )}
        </div>
        <div className="text-xs font-mono text-slate-200 truncate">{value}</div>
        <div className="text-[10px] text-slate-500">{sub}</div>
      </div>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-200 shrink-0">
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

function Link({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800/60 transition-colors group"
    >
      <span className="truncate">{label}</span>
      <ExternalLink size={11} className="opacity-50 group-hover:opacity-100 shrink-0" />
    </a>
  );
}
