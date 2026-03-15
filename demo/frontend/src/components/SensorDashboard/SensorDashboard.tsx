import { useState, useEffect } from "react";
import { Activity, Droplets, Thermometer, FlaskConical } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Area,
  AreaChart,
} from "recharts";

interface SensorReading {
  moisture: number;
  temp6: number;
  temp12: number;
  ec: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  timestamp: string;
}

function GaugeCard({
  label,
  value,
  unit,
  icon,
  min,
  max,
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  min: number;
  max: number;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-mono font-bold text-slate-100">
        {value.toFixed(1)}
        <span className="text-sm text-slate-500 ml-1">{unit}</span>
      </div>
      <div className="mt-2 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

// Mock data for development
function useMockSensorData(): SensorReading {
  const [reading, setReading] = useState<SensorReading>({
    moisture: 34.2,
    temp6: 18.4,
    temp12: 16.1,
    ec: 0.42,
    nitrogen: 42,
    phosphorus: 28,
    potassium: 186,
    ph: 6.2,
    timestamp: new Date().toISOString(),
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setReading((prev) => ({
        moisture: prev.moisture + (Math.random() - 0.5) * 0.3,
        temp6: prev.temp6 + (Math.random() - 0.5) * 0.1,
        temp12: prev.temp12 + (Math.random() - 0.5) * 0.05,
        ec: prev.ec + (Math.random() - 0.5) * 0.01,
        nitrogen: prev.nitrogen + (Math.random() - 0.5) * 0.5,
        phosphorus: prev.phosphorus + (Math.random() - 0.5) * 0.3,
        potassium: prev.potassium + (Math.random() - 0.5) * 1,
        ph: prev.ph + (Math.random() - 0.5) * 0.02,
        timestamp: new Date().toISOString(),
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return reading;
}

export function SensorDashboard() {
  const reading = useMockSensorData();
  const [history, setHistory] = useState<{ time: string; moisture: number; avg: number }[]>([]);

  useEffect(() => {
    setHistory((prev) => {
      const next = [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          moisture: reading.moisture,
          avg: 38.5, // Historical average placeholder
        },
      ];
      return next.slice(-30);
    });
  }, [reading.moisture]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-1">Live Sensors</h2>
      <p className="text-sm text-slate-400 mb-6">
        RS485 Modbus &middot; Real-time readings with historical context
      </p>

      {/* Soil Probe */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Droplets size={16} className="text-blue-400" />
          Soil Probe (RS485 Modbus)
        </h3>
        <div className="grid grid-cols-4 gap-3">
          <GaugeCard
            label="Moisture"
            value={reading.moisture}
            unit="%"
            icon={<Droplets size={14} />}
            min={0}
            max={100}
          />
          <GaugeCard
            label="Temp 6in"
            value={reading.temp6}
            unit="°C"
            icon={<Thermometer size={14} />}
            min={-10}
            max={45}
          />
          <GaugeCard
            label="Temp 12in"
            value={reading.temp12}
            unit="°C"
            icon={<Thermometer size={14} />}
            min={-10}
            max={45}
          />
          <GaugeCard
            label="EC"
            value={reading.ec}
            unit="dS/m"
            icon={<Activity size={14} />}
            min={0}
            max={2}
          />
        </div>
      </div>

      {/* NPK Sensor */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <FlaskConical size={16} className="text-purple-400" />
          NPK Sensor (RS485 Modbus)
        </h3>
        <div className="grid grid-cols-4 gap-3">
          <GaugeCard
            label="Nitrogen"
            value={reading.nitrogen}
            unit="mg/kg"
            icon={<span className="text-xs font-bold">N</span>}
            min={0}
            max={140}
          />
          <GaugeCard
            label="Phosphorus"
            value={reading.phosphorus}
            unit="mg/kg"
            icon={<span className="text-xs font-bold">P</span>}
            min={0}
            max={145}
          />
          <GaugeCard
            label="Potassium"
            value={reading.potassium}
            unit="mg/kg"
            icon={<span className="text-xs font-bold">K</span>}
            min={0}
            max={205}
          />
          <GaugeCard
            label="pH"
            value={reading.ph}
            unit=""
            icon={<span className="text-xs font-bold">pH</span>}
            min={3.5}
            max={9.5}
          />
        </div>
      </div>

      {/* Moisture Chart with Historical Average */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">
          Soil Moisture — Live vs 9-Year Historical Average
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false}
              />
              <YAxis
                domain={[20, 50]}
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="avg"
                stroke="#64748b"
                fill="#64748b"
                fillOpacity={0.1}
                strokeDasharray="4 4"
                name="Historical Avg"
              />
              <Area
                type="monotone"
                dataKey="moisture"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.2}
                name="Live"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Context Card */}
      <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
        <div className="text-sm text-amber-400 font-medium mb-1">
          Historical Context (kNN on reading_vector)
        </div>
        <p className="text-sm text-slate-300">
          Current moisture ({reading.moisture.toFixed(1)}%) is in the{" "}
          <span className="text-amber-400 font-medium">bottom 5th percentile</span>{" "}
          for this season across 9 years of USDA Cook Farm data. Similar
          conditions in 2012 preceded a drought stress event.
        </p>
      </div>
    </div>
  );
}
