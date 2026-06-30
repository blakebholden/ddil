import { motion } from "framer-motion";
import { Grape, Landmark, ScanSearch, Network } from "lucide-react";

interface Props {
  onChoose: (adventure: "vineyard" | "sec" | "jina" | "ccs") => void;
}

export function AdventureChooser({ onChoose }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12 relative z-10"
      >
        <div className="text-xs font-mono text-slate-500 tracking-widest uppercase mb-3">
          DDIL Demo Kit &middot; Context Engineering Anywhere
        </div>
        <h1 className="text-5xl font-bold text-white mb-3">
          Choose Your Adventure
        </h1>
        <p className="text-lg text-slate-400 max-w-xl mx-auto">
          Experience GPU-accelerated AI search and agentic RAG — running completely
          disconnected from the cloud.
        </p>
      </motion.div>

      {/* Adventure Cards */}
      <div className="flex gap-6 relative z-10 flex-wrap justify-center max-w-5xl">
        {/* Vineyard */}
        <motion.button
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ scale: 1.03, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onChoose("vineyard")}
          className="w-80 bg-gradient-to-b from-slate-900 to-slate-900/60 border border-emerald-500/20 hover:border-emerald-500/50 rounded-2xl p-8 text-left transition-all group"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:bg-emerald-500/20 transition-colors">
            <Grape size={36} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Vineyard Intelligence
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Step into the shoes of a vineyard owner managing 22 acres of premium
            wine grapes. Navigate soil sensors, nutrient data, disease imagery, and
            8 years of harvest history.
          </p>
          <div className="space-y-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              869K sensor records &middot; 6 vineyard blocks
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              17K disease images &middot; kNN similarity search
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              AI Agronomist &middot; Elastic Agent Builder
            </div>
          </div>
          <div className="mt-6 text-emerald-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
            Start demo &rarr;
          </div>
        </motion.button>

        {/* SEC / Finance */}
        <motion.button
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          whileHover={{ scale: 1.03, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onChoose("sec")}
          className="w-80 bg-gradient-to-b from-slate-900 to-slate-900/60 border border-blue-500/20 hover:border-blue-500/50 rounded-2xl p-8 text-left transition-all group"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
            <Landmark size={36} className="text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            SEC Findings
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Investigate SEC EDGAR filings as a financial analyst. Search through
            regulatory documents, detect anomalies, and build compliance reports
            with AI assistance.
          </p>
          <div className="space-y-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              EDGAR dataset &middot; 10-K / 10-Q filings
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Semantic search &middot; Document analysis
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              AI Compliance Analyst &middot; Agent Builder
            </div>
          </div>
          <div className="mt-6 text-blue-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
            Start demo &rarr;
          </div>
        </motion.button>

        {/* Multimodal + DLS (HPE / Jina) */}
        <motion.button
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          whileHover={{ scale: 1.03, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onChoose("jina")}
          className="w-80 bg-gradient-to-b from-slate-900 to-slate-900/60 border border-violet-500/20 hover:border-violet-500/50 rounded-2xl p-8 text-left transition-all group"
        >
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-6 group-hover:bg-violet-500/20 transition-colors">
            <ScanSearch size={36} className="text-violet-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Multimodal Intelligence
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Search images by typing words, then investigate a classified research
            corpus as four analysts — where document-level security enforces
            need-to-know on every result.
          </p>
          <div className="space-y-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              Jina omni embeddings &middot; text + image, one space
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              509 papers &middot; hybrid RRF &middot; cross-modal figures
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              Document-level security &middot; 4 clearance personas
            </div>
          </div>
          <div className="mt-6 text-violet-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
            Start demo &rarr;
          </div>
        </motion.button>

        {/* CCS edge federation */}
        <motion.button
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          whileHover={{ scale: 1.03, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onChoose("ccs")}
          className="w-80 bg-gradient-to-b from-slate-900 to-slate-900/60 border border-cyan-500/20 hover:border-cyan-500/50 rounded-2xl p-8 text-left transition-all group"
        >
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 group-hover:bg-cyan-500/20 transition-colors">
            <Network size={36} className="text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Edge Federation
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            The cloud can&rsquo;t see the airgapped box — until you bring it online.
            Hit <span className="text-cyan-300">Synchronise Now</span> and watch a
            cloud search reach down into the edge over cross-cluster search.
          </p>
          <div className="space-y-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              Elastic Cloud Hosted &middot; coordinating cluster
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              DDIL box as a remote &middot; CCS over the uplink
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              Results expand cloud &rarr; cloud + edge, live
            </div>
          </div>
          <div className="mt-6 text-cyan-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
            Start demo &rarr;
          </div>
        </motion.button>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-12 flex items-center gap-6 text-xs text-slate-600 relative z-10"
      >
        <span>Elasticsearch 9.3 + NVIDIA cuVS</span>
        <span>&middot;</span>
        <span>GPT-OSS 120B on DGX Spark</span>
        <span>&middot;</span>
        <span>Fully Airgapped</span>
      </motion.div>
    </div>
  );
}
