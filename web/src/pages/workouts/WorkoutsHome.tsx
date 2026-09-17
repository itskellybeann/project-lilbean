import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import TopBar from "../../components/TopBar";
import { api } from "../../api/client";
import { kgToLb } from "../../lib/units";

interface MuscleVolume {
  muscleGroup: string;
  volume: number;
}

export default function WorkoutsHome() {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [muscleVolume, setMuscleVolume] = useState<MuscleVolume[]>([]);

  useEffect(() => {
    api
      .get<MuscleVolume[]>("/dashboard/muscle-volume?days=7")
      .then((data) => setMuscleVolume(data.map((d) => ({ ...d, volume: Math.round(kgToLb(d.volume)) }))));
  }, []);

  async function startBlank() {
    setStarting(true);
    try {
      const workout = await api.post<{ id: string }>("/workouts", { name: "Workout" });
      navigate(`/workouts/active/${workout.id}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div>
      <TopBar title="Lift" />
      <div className="p-4 space-y-3">
        <button className="btn-primary w-full" onClick={startBlank} disabled={starting}>
          {starting ? "Starting…" : "+ Start empty workout"}
        </button>

        <Link to="/workouts/routines" className="card flex items-center gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-400/15 text-xl shrink-0">🗂️</span>
          <div>
            <p className="font-semibold">Routines</p>
            <p className="text-white/50 text-sm">Your templates — start from one or build a new one</p>
          </div>
        </Link>

        <Link to="/workouts/exercises" className="card flex items-center gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/15 text-xl shrink-0">📚</span>
          <div>
            <p className="font-semibold">Exercise library</p>
            <p className="text-white/50 text-sm">Browse exercises, PRs, and 1RM history</p>
          </div>
        </Link>

        <Link to="/workouts/history" className="card flex items-center gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/15 text-xl shrink-0">🗓️</span>
          <div>
            <p className="font-semibold">History &amp; calendar</p>
            <p className="text-white/50 text-sm">Past workouts and volume trends</p>
          </div>
        </Link>

        <Link to="/workouts/prs" className="card flex items-center gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-bean-500/15 text-xl shrink-0">🏆</span>
          <div>
            <p className="font-semibold">PR feed</p>
            <p className="text-white/50 text-sm">Every weight and 1RM personal record, in order</p>
          </div>
        </Link>

        {muscleVolume.length > 0 && (
          <div className="card">
            <p className="text-sm font-semibold mb-2">Volume by muscle group (7 days, lbs)</p>
            <ResponsiveContainer width="100%" height={Math.max(120, muscleVolume.length * 34)}>
              <BarChart data={muscleVolume} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" stroke="#666" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="muscleGroup" stroke="#999" fontSize={12} width={80} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1a1a1d", border: "1px solid #333338", borderRadius: 8 }} />
                <Bar dataKey="volume" fill="#2dd4bf" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
