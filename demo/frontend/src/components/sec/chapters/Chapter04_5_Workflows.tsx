import { ArrowRight, ArrowLeft, Workflow, Bot, ExternalLink, Play, Calendar } from "lucide-react";
import { ChapterShell } from "../shared/ChapterShell";
import { useFinanceConfig } from "../lib/financeConfig";

const WORKFLOW_ID = "daily-10-k-ai-risk-digest";

const WORKFLOW_YAML = `name: Daily 10-K AI-Risk Digest 📅
description: Runs the finance-analyst agent every morning to surface the latest AI-risk disclosures across the S&P 500.
enabled: true

triggers:
  - type: manual
  - type: scheduled
    with:
      rrule:
        freq: DAILY
        interval: 1
        tzid: Etc/UTC
        dtstart: 2026-05-19T09:00:00.000Z

steps:
  - name: ask_finance_agent
    type: ai.agent
    agent-id: finance-analyst       # the agent from chapter 04
    create-conversation: true
    with:
      message: >-
        Across the S&P 500, which 5 sectors currently disclose
        the most AI-related risk in their latest 10-K filings?
        For each sector, give the filing count and ONE short
        example quote (with ticker and accession).

  - name: log_digest
    type: console
    with:
      message: "{{ steps.ask_finance_agent.output | json }}"`;

export function Chapter04_5_Workflows() {
  const { kibanaUrl: KIBANA } = useFinanceConfig();
  return (
    <ChapterShell
      number="—"
      title="Workflows"
      subtitle="Same agent, no human at the keyboard. Workflows put the chapter-04 agent on a schedule, alert trigger, or external event — and the agent can call workflows back, closing the loop."
      headerRight={
        <a
          href={`${KIBANA}/app/workflows`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-slate-100 ring-1 ring-slate-700/50 transition-colors"
        >
          <Workflow size={12} />
          Open Workflows in Kibana
          <ExternalLink size={10} />
        </a>
      }
    >
      <div className="space-y-5">
        {/* Two-direction bridge */}
        <div className="grid grid-cols-2 gap-4">
          <DirectionCard
            from={Workflow}
            to={Bot}
            arrow="right"
            title="Workflows trigger agents"
            body="Schedule, alert, or external event fires a workflow → the workflow asks the agent → the agent answers → the workflow takes downstream action (Slack, email, write-back)."
          />
          <DirectionCard
            from={Bot}
            to={Workflow}
            arrow="left"
            title="Agents call workflows"
            body="Agent reasons through a question, then invokes a workflow to act — file a case, page a human, append to an index — using the same audit trail as any other workflow run."
          />
        </div>

        {/* The example */}
        <div className="rounded-2xl border border-[var(--color-elastic)]/40 bg-[var(--color-elastic)]/[0.04] p-5">
          <div className="flex items-baseline justify-between mb-3 gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[var(--color-elastic)]" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-100">Live example · Daily 10-K AI-Risk Digest</h3>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`${KIBANA}/app/workflows/${WORKFLOW_ID}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-900/60 hover:bg-slate-800 text-slate-200 ring-1 ring-slate-700/60"
              >
                <Workflow size={11} className="text-[var(--color-elastic)]" />
                Open in Kibana
                <ExternalLink size={10} className="text-slate-500" />
              </a>
              <a
                href={`${KIBANA}/app/workflows/${WORKFLOW_ID}?run=true`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--color-elastic)] hover:bg-[var(--color-elastic-dark)] text-slate-950"
              >
                <Play size={11} />
                Trigger now
              </a>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            Every morning at 09:00 UTC, this workflow asks <span className="font-mono text-[var(--color-elastic)]">finance-analyst</span> (the chapter-04 agent) which S&P 500 sectors are leaning hardest into AI-risk language right now, then writes the summary into the workflow log. Swap the <code className="font-mono text-amber-200 text-[11px] bg-slate-800/60 px-1 rounded">console</code> step for <code className="font-mono text-amber-200 text-[11px] bg-slate-800/60 px-1 rounded">slack</code> / <code className="font-mono text-amber-200 text-[11px] bg-slate-800/60 px-1 rounded">email</code> / <code className="font-mono text-amber-200 text-[11px] bg-slate-800/60 px-1 rounded">elasticsearch.request</code> and it's a production morning digest.
          </p>

          <div className="grid grid-cols-[1.4fr_1fr] gap-4">
            <pre className="text-[11px] font-mono text-slate-200 p-3 bg-slate-950/80 rounded-lg overflow-x-auto leading-relaxed border border-slate-800">{WORKFLOW_YAML}</pre>
            <div className="space-y-3">
              <Tile n="01" title="Scheduled trigger" body="rrule fires daily at 09:00 UTC. Or any moment via the manual trigger, or via an alert when a new filing lands." />
              <Tile n="02" title="ai.agent step" body="Calls finance-analyst by id — same agent the chapter-04 chat uses. No special API; agent runs identically." />
              <Tile n="03" title="Downstream action" body="Console step logs the result. Replace with slack / email / elasticsearch.request to write the digest where teams already live." />
              <Tile
                n="04"
                title="Why daily is affordable"
                body="Fresh agent answers depend on a fresh index. Re-ingesting the corpus every morning is only realistic because chapter-01's GPU indexing made it ~89% cheaper than a CPU baseline."
                accent
              />
            </div>
          </div>
        </div>

        {/* Pointer to the wrap-up */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 pt-2">
          <span>Next:</span>
          <span className="text-slate-300 font-medium">05 · The Full Stack</span>
          <ArrowRight size={12} />
          <span className="text-slate-500">everything we built today, in one frame</span>
        </div>
      </div>
    </ChapterShell>
  );
}

function DirectionCard({
  from: From, to: To, arrow, title, body,
}: {
  from: typeof Workflow; to: typeof Workflow; arrow: "left" | "right"; title: string; body: string;
}) {
  const Arrow = arrow === "right" ? ArrowRight : ArrowLeft;
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <From size={15} className="text-[var(--color-elastic)]" />
        <Arrow size={14} className="text-slate-500" />
        <To size={15} className="text-[var(--color-elastic)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 ml-1">{title}</span>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{body}</p>
    </div>
  );
}

function Tile({ n, title, body, accent }: { n: string; title: string; body: string; accent?: boolean }) {
  const ring = accent
    ? "border-[var(--color-nvidia)]/30 bg-[var(--color-nvidia)]/[0.05]"
    : "border-slate-700/40 bg-slate-950/40";
  const numClr = accent ? "text-[var(--color-nvidia)]" : "text-[var(--color-elastic)]";
  return (
    <div className={`rounded-lg border ${ring} px-3 py-2.5`}>
      <div className="flex items-baseline gap-2">
        <span className={`text-[10px] font-mono font-bold ${numClr}`}>{n}</span>
        <span className="text-xs font-semibold text-slate-200">{title}</span>
      </div>
      <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{body}</p>
    </div>
  );
}
