import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import TopBar from "../../components/TopBar";
import { api } from "../../api/client";

interface HealthMetric {
  id: string;
  date: string;
  source: string;
  sleepMinutes: number | null;
  restingHr: number | null;
  hrv: number | null;
  steps: number | null;
  spo2: number | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseImportText(text: string): any[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  // CSV: date,sleepMinutes,restingHr,hrv,steps,spo2,caloriesBurned
  const lines = trimmed.split("\n").filter(Boolean);
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, any> = {};
    header.forEach((key, i) => {
      const value = cells[i];
      row[key] = value === undefined || value === "" ? null : isNaN(Number(value)) ? value : Number(value);
    });
    return row;
  });
}

export default function HealthMetrics() {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [date, setDate] = useState(todayISO());
  const [sleepHours, setSleepHours] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [hrv, setHrv] = useState("");
  const [steps, setSteps] = useState("");
  const [spo2, setSpo2] = useState("");
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);

  function load() {
    api.get<HealthMetric[]>("/health-metrics").then(setMetrics);
  }
  useEffect(load, []);

  async function saveManual() {
    await api.post("/health-metrics", {
      date,
      sleepMinutes: sleepHours ? Math.round(Number(sleepHours) * 60) : null,
      restingHr: restingHr ? Number(restingHr) : null,
      hrv: hrv ? Number(hrv) : null,
      steps: steps ? Number(steps) : null,
      spo2: spo2 ? Number(spo2) : null,
      source: "manual",
    });
    setSleepHours("");
    setRestingHr("");
    setHrv("");
    setSteps("");
    setSpo2("");
    load();
  }

  async function runImport() {
    try {
      const rows = parseImportText(importText);
      if (!rows.length) return;
      const result = await api.post<{ imported: number }>("/health-metrics/import", { rows, source: "ringconn" });
      setImportMsg(`Imported ${result.imported} day(s).`);
      setImportText("");
      load();
    } catch (err: any) {
      setImportMsg(`Couldn't parse that: ${err.message}`);
    }
  }

  const chartData = metrics.map((m) => ({
    date: new Date(m.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    sleep: m.sleepMinutes ? Math.round((m.sleepMinutes / 60) * 10) / 10 : null,
    hr: m.restingHr,
  }));

  return (
    <div>
      <TopBar title="Ring & sleep" />
      <div className="p-4 space-y-4">
        <div className="card bg-teal-500/5 border-teal-700/50">
          <p className="text-xs text-white/60 leading-relaxed">
            RingConn doesn't offer a public sync API, so there's no live auto-sync yet. Log a night manually below, or
            paste a CSV/JSON export from the RingConn app (or Apple Health / Google Fit, if you route it through
            there) into the bulk import box.
          </p>
        </div>

        {chartData.some((d) => d.sleep || d.hr) && (
          <div className="card">
            <p className="text-sm font-semibold mb-2">Sleep (hrs) &amp; resting HR</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" stroke="#666" fontSize={10} tickLine={false} />
                <YAxis yAxisId="sleep" stroke="#2dd4bf" fontSize={11} tickLine={false} width={30} />
                <YAxis yAxisId="hr" orientation="right" stroke="#a78bfa" fontSize={11} tickLine={false} width={30} />
                <Tooltip contentStyle={{ background: "#1a1a1d", border: "1px solid #333338", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="sleep" type="monotone" name="Sleep (hrs)" dataKey="sleep" stroke="#2dd4bf" strokeWidth={2} dot={false} connectNulls />
                <Line yAxisId="hr" type="monotone" name="Resting HR" dataKey="hr" stroke="#a78bfa" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="card space-y-2">
          <p className="font-semibold text-sm">Log a day manually</p>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Sleep (hrs)</label>
              <input className="input" inputMode="decimal" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} />
            </div>
            <div>
              <label className="label">Resting HR</label>
              <input className="input" inputMode="numeric" value={restingHr} onChange={(e) => setRestingHr(e.target.value)} />
            </div>
            <div>
              <label className="label">HRV</label>
              <input className="input" inputMode="decimal" value={hrv} onChange={(e) => setHrv(e.target.value)} />
            </div>
            <div>
              <label className="label">Steps</label>
              <input className="input" inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} />
            </div>
            <div>
              <label className="label">SpO2 %</label>
              <input className="input" inputMode="decimal" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
            </div>
          </div>
          <button className="btn-primary w-full" onClick={saveManual}>
            Save
          </button>
        </div>

        <div className="card space-y-2">
          <p className="font-semibold text-sm">Bulk import (CSV or JSON)</p>
          <textarea
            className="input h-28"
            placeholder={"date,sleepMinutes,restingHr,hrv,steps,spo2\n2026-09-10,432,58,45,8123,97"}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <button className="btn-secondary w-full" onClick={runImport}>
            Import
          </button>
          {importMsg && <p className="text-xs text-white/50">{importMsg}</p>}
        </div>
      </div>
    </div>
  );
}
