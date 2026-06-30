import { Cpu, Zap, Server, MemoryStick, HardDrive, DollarSign, Settings2, Network } from "lucide-react";
import { ChapterShell } from "../shared/ChapterShell";
import { HARDWARE, fmtUsd } from "../lib/pricing";

interface Spec {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}

interface SideProps {
  tone: "cpu" | "gpu";
  badge: string;          // "CPU · BASELINE" | "GPU · ACCELERATED"
  instance: string;       // "g6.8xlarge"
  tagline: string;
  specs: Spec[];
  esConfig: { setting: string; value: string }[];
  port: number;
  hostIp: string;
}

function Side({ tone, badge, instance, tagline, specs, esConfig, port, hostIp }: SideProps) {
  const cls = tone === "cpu"
    ? { ring: "border-amber-500/40", bg: "bg-amber-500/5", text: "text-amber-400", chip: "bg-amber-500/20 text-amber-200", Icon: Cpu }
    : { ring: "border-emerald-500/40", bg: "bg-emerald-500/5", text: "text-emerald-400", chip: "bg-emerald-500/20 text-emerald-200", Icon: Zap };
  const { Icon } = cls;
  return (
    <div className={`flex-1 rounded-2xl border ${cls.ring} ${cls.bg} p-6 flex flex-col`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${cls.text}`}>{badge}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${cls.chip}`}>{hostIp}:{port}</span>
      </div>
      <div className="flex items-center gap-3">
        <Icon size={28} className={cls.text} />
        <div>
          <h3 className="text-2xl font-bold text-slate-100 tracking-tight">{instance}</h3>
          <p className="text-sm text-slate-400">{tagline}</p>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {specs.map((s, i) => (
          <div key={i} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 text-slate-500">{s.icon}</span>
            <div className="flex-1">
              <div className="text-slate-200">{s.value}</div>
              {s.detail && <div className="text-xs text-slate-500 mt-0.5">{s.detail}</div>}
            </div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-slate-700/50">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400 mb-2">
          <Settings2 size={12} /> Elasticsearch 9.4.1 config
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-mono">
          {esConfig.map((c, i) => (
            <div key={i} className="flex justify-between text-slate-300">
              <span className="text-slate-500">{c.setting}</span>
              <span>{c.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Chapter00_Architecture() {
  return (
    <ChapterShell
      number="00"
      title="The Hardware Face-Off"
      subtitle="Same workload, same Elasticsearch version, same dataset. Two AWS instances — one with a GPU, one without. This is what we're racing."
    >
      <div className="flex flex-col gap-4 h-full">
        <div className="grid grid-cols-2 gap-4 flex-1">
          <Side
            tone="cpu"
            badge="CPU · Baseline"
            instance={HARDWARE.cpu.label}
            tagline="No GPU — pure CPU HNSW graph build"
            hostIp="192.168.1.10"
            port={9201}
            specs={[
              { icon: <Server size={16} />,      label: "vCPU",    value: "32 vCPU",  detail: "AMD EPYC (4th gen Genoa)" },
              { icon: <MemoryStick size={16} />, label: "Memory",  value: "128 GB",   detail: "DDR5 ECC" },
              { icon: <Zap size={16} />,         label: "GPU",     value: "—",        detail: "CPU-only baseline" },
              { icon: <HardDrive size={16} />,   label: "Storage", value: "2× 419 GB NVMe", detail: "instance-store SSD" },
              { icon: <DollarSign size={16} />,  label: "Cost",    value: `${fmtUsd(HARDWARE.cpu.rate)}/hr`, detail: "us-east-2 on-demand" },
            ]}
            esConfig={[
              { setting: "vectors.indexing.use_gpu", value: "false" },
              { setting: "index_options.type",       value: "hnsw" },
              { setting: "dense_vector.dims",        value: "1536" },
              { setting: "JVM heap (-Xms/-Xmx)",     value: "31g" },
              { setting: "discovery.type",           value: "single-node" },
              { setting: "path.data",                value: "/mnt/data" },
            ]}
          />

          <Side
            tone="gpu"
            badge="GPU · Accelerated"
            instance={HARDWARE.gpu.label}
            tagline="NVIDIA L4 · cuVS CAGRA → HNSW conversion"
            hostIp="192.168.1.20"
            port={9200}
            specs={[
              { icon: <Server size={16} />,      label: "vCPU",    value: "16 vCPU",  detail: "AMD EPYC (4th gen)" },
              { icon: <MemoryStick size={16} />, label: "Memory",  value: "64 GB",    detail: "DDR5 ECC" },
              { icon: <Zap size={16} />,         label: "GPU",     value: "NVIDIA L4",detail: "24 GB GDDR6 · Ada Lovelace · CUDA 12.9" },
              { icon: <HardDrive size={16} />,   label: "Storage", value: "559 GB NVMe", detail: "instance-store SSD (LVM-backed)" },
              { icon: <DollarSign size={16} />,  label: "Cost",    value: `${fmtUsd(HARDWARE.gpu.rate)}/hr`, detail: "us-east-2 on-demand" },
            ]}
            esConfig={[
              { setting: "vectors.indexing.use_gpu", value: "true" },
              { setting: "index_options.type",       value: "hnsw" },
              { setting: "dense_vector.dims",        value: "1536" },
              { setting: "JVM heap (-Xms/-Xmx)",     value: "30g" },
              { setting: "discovery.type",           value: "single-node" },
              { setting: "path.data",                value: "/mnt/data" },
            ]}
          />
        </div>

        {/* Center delta ribbon */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 px-5 py-4">
          <div className="grid grid-cols-5 gap-4 text-center">
            <Delta
              icon={<Server size={14} />}
              label="Hardware delta"
              value="+ 1× NVIDIA L4 GPU"
              detail="− 16 vCPU, − 64 GB RAM"
            />
            <Delta
              icon={<DollarSign size={14} />}
              label="Hourly cost delta"
              value={`+ ${fmtUsd(HARDWARE.gpu.rate - HARDWARE.cpu.rate)}`}
              detail={HARDWARE.gpu.rate < HARDWARE.cpu.rate
                ? `GPU box is cheaper per hour (smaller CPU/RAM)`
                : `GPU box costs ${fmtUsd(HARDWARE.gpu.rate - HARDWARE.cpu.rate)} more / hr`}
              accent={HARDWARE.gpu.rate < HARDWARE.cpu.rate}
            />
            <Delta
              icon={<Settings2 size={14} />}
              label="Config delta"
              value="vectors.indexing.use_gpu"
              detail="true vs false — that's it"
              accent
            />
            <Delta
              icon={<Network size={14} />}
              label="ES version"
              value="9.4.1 · identical"
              detail="cuVS GPU module is bundled OSS"
            />
            <Delta
              icon={<Zap size={14} />}
              label="What we're measuring"
              value="Ingest + force-merge"
              detail="Identical Rally OpenAI corpus (2.6M × 1536-d)"
            />
          </div>
        </div>
      </div>
    </ChapterShell>
  );
}

function Delta({ icon, label, value, detail, accent }: { icon: React.ReactNode; label: string; value: string; detail?: string; accent?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400">
        {icon}{label}
      </div>
      <div className={`mt-1 text-sm font-mono font-semibold ${accent ? "text-[var(--color-elastic)]" : "text-slate-200"}`}>
        {value}
      </div>
      {detail && <div className="text-[10px] text-slate-500 mt-0.5">{detail}</div>}
    </div>
  );
}
