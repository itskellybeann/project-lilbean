import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import TopBar from "../components/TopBar";
import MacroRing from "../components/MacroRing";
import { useAuth } from "../state/auth";
import { formatLb, kgToLb } from "../lib/units";

interface TodaySet {
  weightKg: number;
  reps: number;
  exercise: { name: string };
}

interface TodayWorkout {
  id: string;
  name: string;
  endedAt: string | null;
  sets: TodaySet[];
}

interface TodayData {
  activeWorkout: { id: string; name: string; startedAt: string } | null;
  todaysWorkouts: TodayWorkout[];
  macroTotals: { calories: number; protein: number; carbs: number; fat: number };
  target: { calories: number; protein: number; carbs: number; fat: number } | null;
  todayHealth: { sleepMinutes: number | null; restingHr: number | null; steps: number | null } | null;
  latestBodyMetric: { weightKg: number | null; date: string } | null;
  streaks: { workout: number; logging: number };
  waterMl: number;
}

export default function Today() {
  const { user } = useAuth();
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<TodayData>("/dashboard/today")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const target = data?.target || { calories: 2200, protein: 150, carbs: 220, fat: 70 };
  const totals = data?.macroTotals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const completedToday = (data?.todaysWorkouts || []).filter((w) => w.endedAt);

  return (
    <div>
      <TopBar title={`Hey, ${user?.name || ""}`} />
      <div className="p-4 space-y-4">
        {loading && <p className="text-white/40 text-sm">Loading…</p>}

        {data?.activeWorkout ? (
          <Link to={`/workouts/active/${data.activeWorkout.id}`} className="card block border-bean-600 bg-bean-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-bean-400 text-xs font-semibold uppercase tracking-wide">Workout in progress</p>
                <p className="font-bold">{data.activeWorkout.name}</p>
              </div>
              <span className="text-2xl">→</span>
            </div>
          </Link>
        ) : completedToday.length === 0 ? (
          <Link to="/workouts" className="card block text-center">
            <p className="text-white/60 text-sm">No workout started today</p>
            <p className="text-bean-400 font-semibold mt-1">+ Start a workout</p>
          </Link>
        ) : null}

        {completedToday.map((w) => {
          const volume = w.sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
          const exerciseNames = Array.from(new Set(w.sets.map((s) => s.exercise.name)));
          return (
            <Link key={w.id} to={`/workouts/active/${w.id}`} className="card block">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-bean-400 text-xs font-semibold uppercase tracking-wide">Completed today ✓</p>
                  <p className="font-bold">{w.name}</p>
                  <p className="text-white/40 text-xs mt-0.5 truncate">{exerciseNames.join(", ") || "No sets logged"}</p>
                </div>
                <p className="text-sm text-white/50 whitespace-nowrap">{Math.round(kgToLb(volume))}lb</p>
              </div>
            </Link>
          );
        })}

        {!data?.activeWorkout && completedToday.length > 0 && (
          <Link to="/workouts" className="btn-secondary w-full text-center block">
            + Start another workout
          </Link>
        )}

        <div className="card">
          <p className="text-sm font-semibold mb-3">Today's macros</p>
          <div className="flex justify-around">
            <MacroRing label="Cal" value={totals.calories} target={target.calories} unit="" color="#f5348c" />
            <MacroRing label="Protein" value={totals.protein} target={target.protein} color="#ff85bd" />
            <MacroRing label="Carbs" value={totals.carbs} target={target.carbs} color="#ffadd2" />
            <MacroRing label="Fat" value={totals.fat} target={target.fat} color="#d81b70" />
          </div>
          <p className="text-center text-xs text-white/40 mt-2">
            💧 {((data?.waterMl ?? 0) / 1000).toFixed(2)}L water today
          </p>
          <Link to="/nutrition" className="btn-secondary w-full text-center mt-3 block">
            Open diary
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center">
            <p className="text-2xl font-bold text-bean-400">🔥 {data?.streaks.workout ?? 0}</p>
            <p className="text-xs text-white/50 mt-1">Workout streak (days)</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-bean-400">📔 {data?.streaks.logging ?? 0}</p>
            <p className="text-xs text-white/50 mt-1">Logging streak (days)</p>
          </div>
        </div>

        <div className="card">
          <p className="text-sm font-semibold mb-2">Ring &amp; body</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold">
                {data?.todayHealth?.sleepMinutes ? `${Math.round(data.todayHealth.sleepMinutes / 60)}h` : "—"}
              </p>
              <p className="text-[11px] text-white/40">Sleep</p>
            </div>
            <div>
              <p className="text-lg font-bold">{data?.todayHealth?.restingHr ?? "—"}</p>
              <p className="text-[11px] text-white/40">Resting HR</p>
            </div>
            <div>
              <p className="text-lg font-bold">
                {data?.latestBodyMetric?.weightKg ? `${formatLb(data.latestBodyMetric.weightKg)}lb` : "—"}
              </p>
              <p className="text-[11px] text-white/40">Weight</p>
            </div>
          </div>
          <Link to="/body" className="btn-secondary w-full text-center mt-3 block">
            Open body &amp; health
          </Link>
        </div>
      </div>
    </div>
  );
}
