import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders the agent's streamed final answer as markdown.
 * Custom components keep the styling consistent with the rest of the chapter
 * (slate/emerald palette, tight typography, code-block contrast).
 */
const COMPONENTS: Components = {
  h1: ({ children }) => <h2 className="text-lg font-bold text-slate-100 mt-4 mb-2">{children}</h2>,
  h2: ({ children }) => <h3 className="text-base font-semibold text-slate-100 mt-4 mb-2">{children}</h3>,
  h3: ({ children }) => <h4 className="text-sm font-semibold text-slate-200 mt-3 mb-1.5">{children}</h4>,
  h4: ({ children }) => <h5 className="text-sm font-semibold text-slate-300 mt-3 mb-1">{children}</h5>,
  p:  ({ children }) => <p className="text-sm text-slate-200 leading-relaxed mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="text-sm text-slate-200 list-disc list-outside ml-5 mb-3 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="text-sm text-slate-200 list-decimal list-outside ml-5 mb-3 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--color-elastic)]">{children}</strong>,
  em: ({ children }) => <em className="italic text-slate-100">{children}</em>,
  code: ({ children, className }) => {
    const inline = !className;
    if (inline) return <code className="font-mono text-[12px] px-1 py-0.5 rounded bg-slate-800/80 text-amber-200">{children}</code>;
    return <code className="font-mono text-[11px] block p-2 rounded bg-slate-900/80 text-slate-200 overflow-x-auto">{children}</code>;
  },
  pre: ({ children }) => <pre className="mb-3">{children}</pre>,
  a:  ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="text-[var(--color-elastic)] hover:underline">{children}</a>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-slate-700 pl-3 text-slate-300 italic my-3">{children}</blockquote>,
  hr: () => <hr className="border-slate-700/60 my-4" />,
  table: ({ children }) => <div className="overflow-x-auto mb-3"><table className="text-xs w-full border-collapse">{children}</table></div>,
  thead: ({ children }) => <thead className="text-slate-400 border-b border-slate-700">{children}</thead>,
  th: ({ children }) => <th className="text-left px-2 py-1 font-semibold">{children}</th>,
  td: ({ children }) => <td className="px-2 py-1 border-b border-slate-800/60 text-slate-200">{children}</td>,
};

export function AnswerMarkdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
