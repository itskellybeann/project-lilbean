import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import TopBar from "../../components/TopBar";
import { api } from "../../api/client";

export default function WorkoutsHome() {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

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

        <Link to="/workouts/routines" className="card block">
          <p className="font-semibold">Routines</p>
          <p className="text-white/50 text-sm">Your templates — start from one or build a new one</p>
        </Link>

        <Link to="/workouts/exercises" className="card block">
          <p className="font-semibold">Exercise library</p>
          <p className="text-white/50 text-sm">Browse exercises, PRs, and 1RM history</p>
        </Link>

        <Link to="/workouts/history" className="card block">
          <p className="font-semibold">History &amp; calendar</p>
          <p className="text-white/50 text-sm">Past workouts and volume trends</p>
        </Link>
      </div>
    </div>
  );
}
