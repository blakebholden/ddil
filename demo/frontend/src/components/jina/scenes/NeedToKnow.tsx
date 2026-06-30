import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Search, Loader2, Shield, ShieldAlert, FileText, Sparkles, Lock, Image as ImageIcon, ExternalLink } from "lucide-react";
import {
  useAnalysts, useDlsSearch, useDlsAnswer,
  figUrl, pdfUrl, CLS_TONE, CLS_LABEL,
  type Analyst, type DlsHit, type Figure, type AnswerSource,
} from "../lib/api";

const EXAMPLES = [
  "What methods are used for single-cell RNA sequencing?",
  "Summarize findings on CRISPR off-target effects",
  "Which imaging techniques detect early-stage tumors?",
  "What is known about gut microbiome and immunity?",
];

export function NeedToKnow() {
  const analysts = useAnalysts();
  const [analyst, setAnalyst] = useState<string>("public");
  const [query, setQuery] = useState("");
  const { result, search } = useDlsSearch();
  const { result: answer, loading: answering, ask, reset } = useDlsAnswer();

  // Re-browse (accessible corpus + facets) whenever the analyst changes.
  useEffect(() => {
    search(query, analyst);
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyst]);

  const submit = (q?: string) => {
    const text = (q ?? query).trim();
    if (!text) return;
    setQuery(text);
    search(text, analyst);
    ask(text, analyst);
  };

  const current = analysts.find((a) => a.id === analyst);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-1 text-xs uppercase tracking-[0.2em] text-violet-400 font-semibold">
        Track 2 · Need-to-Know
      </div>
      <h2 className="text-3xl font-bold text-slate-100 mb-1">Research corpus under document-level security</h2>
      <p className="text-sm text-slate-400 mb-6 max-w-3xl">
        509 research papers, marked with a fictional classification model. Switch analyst and watch the
        accessible corpus — and every answer — change. Retrieval is hybrid (BM25 + kNN RRF) with a DLS
        pre-filter; the analyst can never retrieve, cite, or even count what they aren't cleared to see.
      </p>

      {/* Analyst switcher */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {analysts.map((a) => (
          <AnalystCard key={a.id} a={a} active={a.id === analyst} onClick={() => setAnalyst(a.id)} />
        ))}
      </div>

      {/* Accessible-corpus banner */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 mb-5 flex items-center gap-5 flex-wrap"
        >
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-violet-400" />
            <div>
              <div className="text-2xl font-bold text-slate-100 leading-none">
                {result.accessible.docs}
                <span className="text-sm font-normal text-slate-500"> / 509 docs</span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
                visible to {current?.name ?? "—"}
              </div>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-700/60" />
          <div className="flex items-center gap-2 flex-wrap">
            {result.accessible.classification.map((b) => (
              <span key={String(b.key)} className={`text-[10px] font-semibold px-2 py-1 rounded-full ring-1 ${CLS_TONE[String(b.key)] ?? "bg-slate-700/40 text-slate-300 ring-slate-600"}`}>
                {String(b.key)} · {b.count.toLocaleString()}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Search */}
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="relative mb-4">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Ask the corpus as ${current?.name ?? "an analyst"}…`}
          className="w-full pl-11 pr-28 py-3.5 bg-slate-900/60 border border-slate-700/60 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
        />
        <button
          type="submit"
          disabled={answering || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white text-sm font-medium flex items-center gap-1.5"
        >
          {answering ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Ask
        </button>
      </form>

      {!answer && !answering && (
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 self-center">Try:</span>
          {EXAMPLES.map((q) => (
            <button key={q} onClick={() => submit(q)} className="text-xs px-3 py-1 rounded-full border border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[1fr_320px] gap-6">
        {/* LEFT: answer + sources */}
        <div className="space-y-4">
          {answering && (
            <div className="rounded-2xl border border-violet-500/30 bg-violet-500/[0.04] p-5 text-sm text-slate-400 flex items-center gap-2">
              <Loader2 size={15} className="animate-spin text-violet-400" />
              Reasoning over the documents {current?.name} is cleared to see…
            </div>
          )}

          <AnimatePresence>
            {answer && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-violet-500/30 bg-violet-500/[0.04] overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-2.5 bg-slate-900/60 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-violet-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">Research Paper Analyst</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    answer scoped to {answer.analyst.clearance} clearance
                  </span>
                </div>
                <div className="p-5 prose-jina">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer.answer}</ReactMarkdown>
                </div>
                {answer.sources.length > 0 && (
                  <div className="px-5 pb-4 flex flex-wrap gap-1.5">
                    {answer.sources.map((s) => <SourceChip key={s.parent_id} s={s} />)}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Retrieved source documents (DLS-visible) */}
          {result && result.hits.length > 0 && (
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-500">
                Retrieved documents · {current?.name} can see these
              </div>
              {result.hits.map((h) => <SourceCard key={h.parent_id} h={h} />)}
            </div>
          )}
        </div>

        {/* RIGHT: cross-modal figures */}
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-500 flex items-center gap-1.5">
            <ImageIcon size={12} /> Cross-modal figures
          </div>
          {result && result.figures.length > 0 ? (
            result.figures.map((f, i) => <FigureCard key={`${f.parent_id}-${i}`} f={f} />)
          ) : (
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 text-xs text-slate-500 italic">
              Figures matching your query (that this analyst is cleared to see) appear here — image vectors
              live in the same space as the text.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AnalystCard({ a, active, onClick }: { a: Analyst; active: boolean; onClick: () => void }) {
  const Icon = a.clearance === "U" ? Shield : ShieldAlert;
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border p-3 transition-all ${
        active ? "border-violet-500/60 bg-violet-500/10" : "border-slate-700/60 bg-slate-900/40 hover:border-slate-600"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={active ? "text-violet-300" : "text-slate-500"} />
        <span className="text-sm font-semibold text-slate-200">{a.name}</span>
      </div>
      <div className="text-[10px] text-slate-500 leading-tight">{a.label}</div>
    </button>
  );
}

function ClassBadge({ cls, compartments, caveats }: { cls: string; compartments?: string[]; caveats?: string[] }) {
  const marking = [cls, ...(compartments ?? []), ...(caveats ?? [])].join("//");
  return (
    <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ring-1 ${CLS_TONE[cls] ?? "bg-slate-700/40 text-slate-300 ring-slate-600"}`} title={CLS_LABEL[cls] ?? cls}>
      {marking}
    </span>
  );
}

function SourceCard({ h }: { h: DlsHit }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <ClassBadge cls={h.classification} compartments={h.compartments} caveats={h.caveats} />
            <span className="text-sm font-medium text-slate-200 truncate">{h.doc_title}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            {h.parent_id} · {h.journal} · {h.year} · {h.source_type}
          </div>
        </div>
        <a href={pdfUrl(h.parent_id)} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-200 shrink-0" title="Open source PDF">
          <FileText size={14} />
        </a>
      </div>
      {h.passage && <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{h.passage}</p>}
    </div>
  );
}

function FigureCard({ f }: { f: Figure }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 overflow-hidden">
      <div className="relative aspect-square bg-slate-950 flex items-center justify-center overflow-hidden">
        <img src={figUrl(f.media_path)} alt={f.doc_title} className="max-h-full max-w-full object-contain" onError={(e) => { e.currentTarget.style.opacity = "0.1"; }} />
        <div className="absolute top-1.5 left-1.5">
          <ClassBadge cls={f.classification} compartments={f.compartments} caveats={f.caveats} />
        </div>
      </div>
      <div className="p-2">
        <div className="text-[10px] text-slate-400 truncate" title={f.doc_title}>{f.doc_title}</div>
        <div className="text-[9px] text-slate-600 font-mono">{f.parent_id} · p{f.page}</div>
      </div>
    </div>
  );
}

function SourceChip({ s }: { s: AnswerSource }) {
  return (
    <a
      href={pdfUrl(s.parent_id)}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] bg-slate-900/60 hover:bg-slate-800 text-slate-300 ring-1 ring-slate-700/60"
      title={s.doc_title}
    >
      <ClassBadge cls={s.classification} compartments={s.compartments} caveats={s.caveats} />
      <span className="font-mono">{s.parent_id}</span>
      <ExternalLink size={9} className="text-slate-500" />
    </a>
  );
}
