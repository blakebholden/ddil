import { useMemo, useState } from "react";
import { Copy, Check, Code2, Terminal, Layers } from "lucide-react";

type Tab = "curl" | "python" | "console";

interface Props {
  method: string;
  path: string;       // e.g. /sec_10k_2026/_search
  body: Record<string, unknown>;
  esHost?: string;    // for cURL — default localhost
}

/**
 * "Here's the call we just made" — three flavors of the same request:
 *   - cURL (against the AWS GPU box ES)
 *   - Python (elasticsearch-py)
 *   - Kibana Dev Tools (copy-paste into /s/nvidia/app/dev_tools)
 */
export function ShowTheCall({ method, path, body, esHost = "http://localhost:9200" }: Props) {
  const [tab, setTab] = useState<Tab>("curl");
  const [copied, setCopied] = useState<Tab | null>(null);

  const snippet = useMemo(() => ({
    curl: curlSnippet(method, path, body, esHost),
    python: pythonSnippet(path, body, esHost),
    console: consoleSnippet(method, path, body),
  }), [method, path, body, esHost]);

  const copy = async (which: Tab) => {
    await navigator.clipboard.writeText(snippet[which]);
    setCopied(which);
    setTimeout(() => setCopied(null), 1400);
  };

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80">
        <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Show the call</span>
        <div className="flex gap-1">
          <TabBtn id="curl"    active={tab} onClick={setTab} icon={<Terminal size={11} />} label="cURL" />
          <TabBtn id="python"  active={tab} onClick={setTab} icon={<Code2 size={11} />}    label="Python" />
          <TabBtn id="console" active={tab} onClick={setTab} icon={<Layers size={11} />}   label="Dev Tools" />
        </div>
      </div>
      <div className="relative">
        <pre className="text-xs leading-relaxed font-mono text-slate-200 bg-slate-950/60 p-4 overflow-x-auto overflow-y-auto max-h-[420px]">
          <code>{snippet[tab]}</code>
        </pre>
        <button
          onClick={() => copy(tab)}
          className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300"
        >
          {copied === tab ? <Check size={11} /> : <Copy size={11} />}
          {copied === tab ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function TabBtn({ id, active, onClick, icon, label }: {
  id: Tab; active: Tab; onClick: (t: Tab) => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
        active === id
          ? "bg-[var(--color-elastic)]/20 text-[var(--color-elastic)] ring-1 ring-[var(--color-elastic)]/30"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
      }`}
    >
      {icon}{label}
    </button>
  );
}

function curlSnippet(method: string, path: string, body: Record<string, unknown>, host: string): string {
  return `curl -sS -X ${method} "${host}${path}" \\
  -H 'Content-Type: application/json' \\
  -d '${JSON.stringify(body, null, 2)}'`;
}

function pythonSnippet(path: string, body: Record<string, unknown>, host: string): string {
  // method+path → index + endpoint
  const m = path.match(/^\/([^/]+)\/_search$/);
  const index = m ? m[1] : "<index>";
  const bodyStr = JSON.stringify(body, null, 4).replace(/\n/g, "\n");
  const pyHost = (host || "http://localhost:9200").replace(/^(https?:\/\/)[^@]*@/, "$1");
  return `from elasticsearch import Elasticsearch

es = Elasticsearch(
    "${pyHost}",
    basic_auth=("elastic", "***"),
    verify_certs=False,
)

response = es.search(
    index="${index}",
    body=${bodyStr},
)

for hit in response["hits"]["hits"]:
    src = hit["_source"]
    print(f"{src['ticker']:6}  {src['sector']:18}  {hit['_score']:.3f}")
    print(f"  {src['text'][:180]}…")
`;
}

function consoleSnippet(method: string, path: string, body: Record<string, unknown>): string {
  // Kibana Dev Tools format: METHOD path + JSON on next lines
  return `${method} ${path}
${JSON.stringify(body, null, 2)}`;
}
