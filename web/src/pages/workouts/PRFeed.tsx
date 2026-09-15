import { useEffect, useState } from "react";
import TopBar from "../../components/TopBar";
import { api } from "../../api/client";
import { formatLb } from "../../lib/units";

interface PREvent {
  type: "weight" | "1rm";
  exerciseName: string;
  weightKg: number;
  reps: number;
  value: number;
  date: string;
  workoutName: string;
}

export default function PRFeed() {
  const [events, setEvents] = useState<PREvent[]>([]);

  useEffect(() => {
    api.get<PREvent[]>("/dashboard/prs").then(setEvents);
  }, []);

  return (
    <div>
      <TopBar title="PR feed" />
      <div className="p-4 space-y-3">
        {events.map((e, i) => (
          <div key={i} className="card flex items-center justify-between">
            <div>
              <p className="font-semibold">{e.exerciseName}</p>
              <p className="text-white/40 text-xs mt-0.5">
                {new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} ·{" "}
                {e.workoutName}
              </p>
            </div>
            <div className="text-right">
              <p className="text-bean-400 font-bold">
                {e.type === "weight" ? `${formatLb(e.weightKg)}lb × ${e.reps}` : `${formatLb(e.value)}lb 1RM`}
              </p>
              <p className="text-white/30 text-[10px] uppercase tracking-wide">
                {e.type === "weight" ? "Heaviest set" : "Est. 1RM"}
              </p>
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="text-white/30 text-sm text-center mt-8">No PRs logged yet — start lifting!</p>}
      </div>
    </div>
  );
}
