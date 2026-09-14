import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TopBar from "../../components/TopBar";
import { api } from "../../api/client";

interface Routine {
  id: string;
  name: string;
  notes: string | null;
  exercises: { exercise: { name: string } }[];
}

export default function RoutineList() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const navigate = useNavigate();

  function load() {
    api.get<Routine[]>("/routines").then(setRoutines);
  }
  useEffect(load, []);

  async function startFromRoutine(routineId: string, name: string) {
    const workout = await api.post<{ id: string }>("/workouts", { name, routineId });
    navigate(`/workouts/active/${workout.id}`);
  }

  async function remove(id: string) {
    if (!confirm("Delete this routine?")) return;
    await api.del(`/routines/${id}`);
    load();
  }

  return (
    <div>
      <TopBar
        title="Routines"
        right={
          <Link to="/workouts/routines/new" className="btn-primary text-sm px-3 py-1.5">
            + New
          </Link>
        }
      />
      <div className="p-4 space-y-3">
        {routines.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{r.name}</p>
                <p className="text-white/40 text-xs mt-0.5">{r.exercises.map((e) => e.exercise.name).join(", ")}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn-primary flex-1" onClick={() => startFromRoutine(r.id, r.name)}>
                Start
              </button>
              <Link to={`/workouts/routines/${r.id}/edit`} className="btn-secondary flex-1 text-center">
                Edit
              </Link>
              <button className="btn-secondary px-3" onClick={() => remove(r.id)}>
                🗑
              </button>
            </div>
          </div>
        ))}
        {routines.length === 0 && <p className="text-white/30 text-sm text-center mt-8">No routines yet — build one.</p>}
      </div>
    </div>
  );
}
