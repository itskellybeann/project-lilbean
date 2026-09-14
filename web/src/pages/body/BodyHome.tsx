import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import TopBar from "../../components/TopBar";
import { api } from "../../api/client";

interface Metric {
  id: string;
  date: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  measurements: Record<string, number> | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function BodyHome() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [date, setDate] = useState(todayISO());
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [waist, setWaist] = useState("");
  const [chest, setChest] = useState("");
  const [arms, setArms] = useState("");

  function load() {
    api.get<Metric[]>("/body/metrics").then(setMetrics);
  }
  useEffect(load, []);

  async function save() {
    await api.post("/body/metrics", {
      date,
      weightKg: weightKg ? Number(weightKg) : null,
      bodyFatPct: bodyFatPct ? Number(bodyFatPct) : null,
      measurements: {
        ...(waist ? { waist: Number(waist) } : {}),
        ...(chest ? { chest: Number(chest) } : {}),
        ...(arms ? { arms: Number(arms) } : {}),
      },
    });
    setWeightKg("");
    setBodyFatPct("");
    setWaist("");
    setChest("");
    setArms("");
    load();
  }

  const chartData = metrics
    .filter((m) => m.weightKg != null)
    .map((m) => ({
      date: new Date(m.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      weight: m.weightKg,
    }));

  return (
    <div>
      <TopBar title="Body" />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Link to="/body/photos" className="card text-center">
            <p className="text-2xl">📸</p>
            <p className="text-sm font-semibold mt-1">Progress photos</p>
          </Link>
          <Link to="/body/health" className="card text-center">
            <p className="text-2xl">💍</p>
            <p className="text-sm font-semibold mt-1">Ring &amp; sleep data</p>
          </Link>
        </div>

        {chartData.length > 1 && (
          <div className="card">
            <p className="text-sm font-semibold mb-2">Weight over time</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} />
                <YAxis stroke="#666" fontSize={11} tickLine={false} width={40} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "#1a1a1d", border: "1px solid #333338", borderRadius: 8 }} />
                <Line type="monotone" dataKey="weight" stroke="#f5348c" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="card space-y-2">
          <p className="font-semibold text-sm">Log measurements</p>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Weight (kg)</label>
              <input className="input" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
            <div>
              <label className="label">Body fat %</label>
              <input className="input" inputMode="decimal" value={bodyFatPct} onChange={(e) => setBodyFatPct(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label">Waist (cm)</label>
              <input className="input" inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} />
            </div>
            <div>
              <label className="label">Chest (cm)</label>
              <input className="input" inputMode="decimal" value={chest} onChange={(e) => setChest(e.target.value)} />
            </div>
            <div>
              <label className="label">Arms (cm)</label>
              <input className="input" inputMode="decimal" value={arms} onChange={(e) => setArms(e.target.value)} />
            </div>
          </div>
          <button className="btn-primary w-full" onClick={save}>
            Save
          </button>
        </div>

        <div className="card">
          <p className="font-semibold text-sm mb-2">Recent entries</p>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {[...metrics]
              .reverse()
              .slice(0, 20)
              .map((m) => (
                <div key={m.id} className="flex justify-between text-sm border-b border-ink-800 pb-1.5">
                  <span className="text-white/50">{new Date(m.date).toLocaleDateString()}</span>
                  <span>
                    {m.weightKg ? `${m.weightKg}kg` : ""} {m.bodyFatPct ? `· ${m.bodyFatPct}%` : ""}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
