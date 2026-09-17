import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import TopBar from "../../components/TopBar";
import { api } from "../../api/client";
import { formatLb, kgToLb, lbToKg } from "../../lib/units";
import { todayLocalISO } from "../../lib/date";

interface Metric {
  id: string;
  date: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  measurements: Record<string, number> | null;
}

interface GoalResponse {
  goal: { goalWeightKg: number | null } | null;
  projection: { currentRateKgPerWeek: number; projectedDate: string } | null;
}

const MEASUREMENT_LABELS: Record<string, string> = { waist: "Waist", chest: "Chest", arms: "Arms" };
const MEASUREMENT_COLORS = ["#a78bfa", "#fbbf24", "#2dd4bf"];

export default function BodyHome() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [date, setDate] = useState(todayLocalISO());
  const [weightLb, setWeightLb] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [waist, setWaist] = useState("");
  const [chest, setChest] = useState("");
  const [arms, setArms] = useState("");
  const [goalData, setGoalData] = useState<GoalResponse | null>(null);
  const [goalInput, setGoalInput] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);

  function load() {
    api.get<Metric[]>("/body/metrics").then(setMetrics);
  }
  useEffect(load, []);

  function loadGoal() {
    api.get<GoalResponse>("/body/goal").then((g) => {
      setGoalData(g);
      if (g.goal?.goalWeightKg) setGoalInput(formatLb(g.goal.goalWeightKg));
    });
  }
  useEffect(loadGoal, []);

  async function saveGoal() {
    setSavingGoal(true);
    try {
      await api.put("/body/goal", { goalWeightKg: goalInput ? lbToKg(Number(goalInput)) : null });
      loadGoal();
    } finally {
      setSavingGoal(false);
    }
  }

  async function save() {
    await api.post("/body/metrics", {
      date,
      weightKg: weightLb ? lbToKg(Number(weightLb)) : null,
      bodyFatPct: bodyFatPct ? Number(bodyFatPct) : null,
      measurements: {
        ...(waist ? { waist: Number(waist) } : {}),
        ...(chest ? { chest: Number(chest) } : {}),
        ...(arms ? { arms: Number(arms) } : {}),
      },
    });
    setWeightLb("");
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
      weight: Math.round(kgToLb(m.weightKg!) * 10) / 10,
    }));

  const measurementKeys = Array.from(
    new Set(metrics.flatMap((m) => Object.keys(m.measurements || {})))
  );
  const measurementCharts = measurementKeys.map((key) => ({
    key,
    data: metrics
      .filter((m) => m.measurements?.[key] != null)
      .map((m) => ({
        date: new Date(m.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: m.measurements![key],
      })),
  }));

  return (
    <div>
      <TopBar title="Body" />
      <div className="p-4 space-y-4">
        <Link to="/body/photos" className="card flex items-center gap-3 bg-gradient-to-br from-violet-500/10 to-transparent border-violet-500/25">
          <span className="text-2xl">📸</span>
          <p className="text-sm font-semibold">Progress photos</p>
        </Link>

        {chartData.length > 1 && (
          <div className="card">
            <p className="text-sm font-semibold mb-2">Weight over time (lbs)</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} />
                <YAxis stroke="#666" fontSize={11} tickLine={false} width={40} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "#1a1a1d", border: "1px solid #333338", borderRadius: 8 }} />
                <Line type="monotone" dataKey="weight" stroke="#2dd4bf" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="card space-y-2">
          <p className="font-semibold text-sm">Goal weight</p>
          <div className="flex gap-2">
            <input className="input flex-1" inputMode="decimal" placeholder="e.g. 145" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} />
            <button className="btn-secondary px-4" onClick={saveGoal} disabled={savingGoal}>
              Save
            </button>
          </div>
          {goalData?.goal?.goalWeightKg && (
            <p className="text-xs text-white/50">
              {goalData.projection ? (
                <>
                  At {Math.abs(kgToLb(goalData.projection.currentRateKgPerWeek)).toFixed(2)}lb/week, you'll hit{" "}
                  {formatLb(goalData.goal.goalWeightKg)}lb around{" "}
                  <span className="text-bean-400 font-semibold">
                    {new Date(goalData.projection.projectedDate).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  .
                </>
              ) : (
                "Log a couple more weigh-ins to get a projected date."
              )}
            </p>
          )}
        </div>

        {measurementCharts.map(
          ({ key, data }, i) =>
            data.length > 1 && (
              <div key={key} className="card">
                <p className="text-sm font-semibold mb-2">{MEASUREMENT_LABELS[key] || key} over time (cm)</p>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={data}>
                    <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} />
                    <YAxis stroke="#666" fontSize={11} tickLine={false} width={35} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ background: "#1a1a1d", border: "1px solid #333338", borderRadius: 8 }} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={MEASUREMENT_COLORS[i % MEASUREMENT_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
        )}

        <div className="card space-y-2">
          <p className="font-semibold text-sm">Log measurements</p>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Weight (lbs)</label>
              <input className="input" inputMode="decimal" value={weightLb} onChange={(e) => setWeightLb(e.target.value)} />
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
                    {m.weightKg ? `${formatLb(m.weightKg)}lb` : ""} {m.bodyFatPct ? `· ${m.bodyFatPct}%` : ""}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
