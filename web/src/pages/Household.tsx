import { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import { api } from "../api/client";

interface MemberSummary {
  userId: string;
  name: string;
  colorAccent: string;
  isMe: boolean;
  streaks: { workout: number; logging: number };
  workoutLoggedToday: boolean;
  caloriesLoggedToday: number;
  calorieTarget: number | null;
}

export default function Household() {
  const [members, setMembers] = useState<MemberSummary[]>([]);

  useEffect(() => {
    api.get<MemberSummary[]>("/dashboard/household").then(setMembers);
  }, []);

  return (
    <div>
      <TopBar title="Household" />
      <div className="p-4 space-y-3">
        <p className="text-white/40 text-xs">
          A quick look at how everyone's doing today — no diary details or photos, just streaks and status.
        </p>
        {members.map((m) => (
          <div key={m.userId} className={`card ${m.isMe ? "border-bean-600" : ""}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold">
                {m.name} {m.isMe && <span className="text-bean-400 text-xs">(you)</span>}
              </p>
              <span className={m.workoutLoggedToday ? "text-bean-400 text-xs font-semibold" : "text-white/30 text-xs"}>
                {m.workoutLoggedToday ? "Trained today ✓" : "No workout yet"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold">🔥 {m.streaks.workout}</p>
                <p className="text-[10px] text-white/40">Workout streak</p>
              </div>
              <div>
                <p className="text-lg font-bold">📔 {m.streaks.logging}</p>
                <p className="text-[10px] text-white/40">Logging streak</p>
              </div>
              <div>
                <p className="text-lg font-bold">{Math.round(m.caloriesLoggedToday)}</p>
                <p className="text-[10px] text-white/40">
                  {m.calorieTarget ? `/ ${Math.round(m.calorieTarget)} kcal` : "kcal logged"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
