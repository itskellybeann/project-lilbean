import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import TopBar from "../../components/TopBar";
import { api } from "../../api/client";

interface Stats {
  heaviestSet: { weightKg: number; reps: number; date: string } | null;
  estimated1RM: number | null;
  estimated1RMDate: string | null;
  volumeOverTime: { date: string; volume: number }[];
  totalSets: number;
}

interface HistorySet {
  id: string;
  weightKg: number;
  reps: number;
  rpe: number | null;
  completedAt: string;
  workout: { name: string; startedAt: string };
}

export default function ExerciseDetail() {
  const { id } = useParams();
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistorySet[]>([]);

  useEffect(() => {
    if (!id) return;
    api.get<Stats>(`/exercises/${id}/stats`).then(setStats);
    api.get<HistorySet[]>(`/exercises/${id}/history`).then(setHistory);
  }, [id]);

  const chartData = (stats?.volumeOverTime || []).map((v) => ({
    date: new Date(v.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    volume: Math.round(v.volume),
  }));

  return (
    <div>
      <TopBar title="Exercise" />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center">
            <p className="text-xl font-bold text-bean-400">
              {stats?.heaviestSet ? `${stats.heaviestSet.weightKg}kg × ${stats.heaviestSet.reps}` : "—"}
            </p>
            <p className="text-xs text-white/50 mt-1">Heaviest set (PR)</p>
          </div>
          <div className="card text-center">
            <p className="text-xl font-bold text-bean-400">{stats?.estimated1RM ? `${stats.estimated1RM}kg` : "—"}</p>
            <p className="text-xs text-white/50 mt-1">Estimated 1RM</p>
          </div>
        </div>

        {chartData.length > 1 && (
          <div className="card">
            <p className="text-sm font-semibold mb-2">Volume over time</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} />
                <YAxis stroke="#666" fontSize={11} tickLine={false} width={40} />
                <Tooltip contentStyle={{ background: "#1a1a1d", border: "1px solid #333338", borderRadius: 8 }} />
                <Line type="monotone" dataKey="volume" stroke="#f5348c" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="card">
          <p className="text-sm font-semibold mb-3">Recent sets</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history.map((s) => (
              <div key={s.id} className="flex justify-between text-sm border-b border-ink-800 pb-2">
                <span className="text-white/50">{new Date(s.completedAt).toLocaleDateString()}</span>
                <span>
                  {s.weightKg}kg × {s.reps} {s.rpe ? `@RPE ${s.rpe}` : ""}
                </span>
              </div>
            ))}
            {history.length === 0 && <p className="text-white/30 text-sm">No sets logged yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
