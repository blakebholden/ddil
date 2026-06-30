/**
 * Elastic GPU Stack — mirrors deck pages 10 + 17.
 * Stack of layers from ES at top down to GPU + CPU at bottom.
 */

interface LayerProps {
  label: string;
  sublabel?: string;
  tone: "es" | "codec" | "java" | "cuvs" | "gpu" | "cpu";
}

const TONES: Record<LayerProps["tone"], string> = {
  es:    "bg-blue-600 text-white",
  codec: "bg-teal-500/90 text-slate-900",
  java:  "bg-purple-500/80 text-white",
  cuvs:  "bg-purple-700/80 text-white",
  gpu:   "bg-[var(--color-nvidia)]/90 text-slate-900",
  cpu:   "bg-sky-400/90 text-slate-900",
};

function Layer({ label, sublabel, tone }: LayerProps) {
  return (
    <div className={`rounded-md px-3 py-2 text-center text-sm font-semibold shadow-inner ${TONES[tone]}`}>
      {label}
      {sublabel && <div className="text-[10px] font-normal opacity-80 mt-0.5">{sublabel}</div>}
    </div>
  );
}

export function ElasticGpuStack({ compact = false }: { compact?: boolean }) {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-4 space-y-2">
        <Layer label="Elasticsearch — index & search" tone="es" />
        <Layer label="Elasticsearch-cuVS codecs"      tone="codec" />
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-2">
            <Layer label="cuvs-java" tone="java" />
            <Layer label="cuVS"      tone="cuvs" />
            <Layer label="GPU"       sublabel="NVIDIA L4 · CUDA 12" tone="gpu" />
          </div>
          <Layer label="CPU" sublabel="AMD EPYC" tone="cpu" />
        </div>
      </div>
      {!compact && (
        <p className="text-[10px] text-slate-500 text-center mt-2 italic">
          Elastic GPU Stack — bundled in Elasticsearch 9.4
        </p>
      )}
    </div>
  );
}
