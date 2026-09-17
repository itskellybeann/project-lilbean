import { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import { api } from "../api/client";
import { accentClasses } from "../lib/accent";

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
        {members.map((m) => {
          const accent = accentClasses(m.colorAccent);
          return (
            <div key={m.userId} className={`card border-l-4 ${accent.border} bg-gradient-to-br ${accent.soft} to-transparent`}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${accent.dot}`} />
                  {m.name} {m.isMe && <span className={`${accent.text} text-xs`}>(you)</span>}
                </p>
                <span className={m.workoutLoggedToday ? `${accent.text} text-xs font-semibold` : "text-white/30 text-xs"}>
                  {m.workoutLoggedToday ? "Trained today ✓" : "No workout yet"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className={`text-lg font-bold ${accent.text}`}>🔥 {m.streaks.workout}</p>
                  <p className="text-[10px] text-white/40">Workout streak</p>
                </div>
                <div>
                  <p className={`text-lg font-bold ${accent.text}`}>📔 {m.streaks.logging}</p>
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
          );
        })}
      </div>
    </div>
  );
}
