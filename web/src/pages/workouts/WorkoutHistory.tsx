import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TopBar from "../../components/TopBar";
import { api } from "../../api/client";
import { kgToLb } from "../../lib/units";

interface Workout {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  routine: { name: string } | null;
  sets: { weightKg: number; reps: number; exercise: { name: string } }[];
}

export default function WorkoutHistory() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    api.get<Workout[]>("/workouts").then(setWorkouts);
  }, []);

  return (
    <div>
      <TopBar title="History" />
      <div className="p-4 space-y-3">
        {workouts.map((w) => {
          const totalVolume = w.sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
          const exerciseNames = Array.from(new Set(w.sets.map((s) => s.exercise.name)));
          return (
            <Link key={w.id} to={`/workouts/active/${w.id}`} className="card block">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{w.name}</p>
                  <p className="text-white/40 text-xs">
                    {new Date(w.startedAt).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                    {!w.endedAt && <span className="text-bean-400 ml-2">In progress</span>}
                  </p>
                </div>
                <p className="text-sm text-white/50">{Math.round(kgToLb(totalVolume))}lb vol</p>
              </div>
              <p className="text-white/40 text-xs mt-1 truncate">{exerciseNames.join(", ")}</p>
            </Link>
          );
        })}
        {workouts.length === 0 && <p className="text-white/30 text-sm text-center mt-8">No workouts logged yet.</p>}
      </div>
    </div>
  );
}
