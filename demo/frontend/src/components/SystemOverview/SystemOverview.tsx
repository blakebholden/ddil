import { Monitor, Cpu, HardDrive, Wifi, Box } from "lucide-react";

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-emerald-400">{value}</div>
      {detail && <div className="text-xs text-slate-500 mt-1">{detail}</div>}
    </div>
  );
}

function NodeCard({
  name,
  ip,
  icon,
  services,
}: {
  name: string;
  ip: string;
  icon: React.ReactNode;
  services: string[];
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-emerald-400">{icon}</span>
        <div>
          <div className="font-semibold text-sm">{name}</div>
          <div className="text-xs text-slate-500 font-mono">{ip}</div>
        </div>
        <div className="ml-auto w-2 h-2 rounded-full bg-emerald-500" />
      </div>
      <div className="space-y-1">
        {services.map((s) => (
          <div
            key={s}
            className="text-xs text-slate-400 flex items-center gap-2"
          >
            <div className="w-1 h-1 rounded-full bg-slate-600" />
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SystemOverview() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-1">System Overview</h2>
      <p className="text-sm text-slate-400 mb-6">
        Everything you just saw is running from a Pelican case
      </p>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="AI Compute" value="1 PFLOP" detail="Blackwell GPU" />
        <StatCard
          label="Vectors Indexed"
          value="615K+"
          detail="GPU: ~22s / CPU: ~150s"
        />
        <StatCard
          label="Search Latency"
          value="<50ms"
          detail="Hybrid RRF (BM25 + kNN)"
        />
        <StatCard
          label="Connectivity"
          value="Zero"
          detail="Fully airgapped"
        />
      </div>

      {/* Network Diagram */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <NodeCard
          name="Framework Desktop"
          ip="192.168.1.10"
          icon={<Monitor size={18} />}
          services={[
            "FastAPI Backend (:8000)",
            "React Frontend (:3000)",
            "Ollama — nomic-embed-text (:11434)",
            "Sensor Data Ingestion (RS485)",
          ]}
        />
        <NodeCard
          name="NVIDIA DGX Spark"
          ip="192.168.1.20"
          icon={<Cpu size={18} />}
          services={[
            "Elasticsearch GPU (:9200) — cuVS",
            "Elasticsearch CPU (:9201)",
            "Ollama — llama3.1:70b (:11434)",
            "128GB Unified Memory",
          ]}
        />
      </div>

      {/* Hardware */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 flex items-center gap-3">
          <Wifi size={18} className="text-slate-500" />
          <div>
            <div className="text-sm font-medium">UniFi Express 7</div>
            <div className="text-xs text-slate-500">WiFi 7 AP + Router</div>
          </div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 flex items-center gap-3">
          <HardDrive size={18} className="text-slate-500" />
          <div>
            <div className="text-sm font-medium">Switch Flex Mini</div>
            <div className="text-xs text-slate-500">5-Port GbE Switch</div>
          </div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 flex items-center gap-3">
          <Box size={18} className="text-slate-500" />
          <div>
            <div className="text-sm font-medium">Pelican Air 1615</div>
            <div className="text-xs text-slate-500">8U Rack &middot; Under 50 lbs</div>
          </div>
        </div>
      </div>

      {/* Punchline */}
      <div className="text-center py-8 border border-emerald-500/20 bg-emerald-500/5 rounded-lg">
        <p className="text-3xl font-bold text-emerald-400 mb-2">
          "Context engineering — anywhere."
        </p>
        <p className="text-sm text-slate-500">
          Elastic + NVIDIA &middot; Disconnected, Degraded, Intermittent,
          Limited
        </p>
      </div>
    </div>
  );
}
