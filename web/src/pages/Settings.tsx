import { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import { api } from "../api/client";
import { useAuth } from "../state/auth";

interface Target {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export default function Settings() {
  const { user, logout } = useAuth();
  const [target, setTarget] = useState<Target>({ calories: 2200, protein: 150, carbs: 220, fat: 70 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<Target | null>("/nutrition/targets").then((t) => {
      if (t) setTarget(t);
    });
  }, []);

  async function save() {
    await api.put("/nutrition/targets", target);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div>
      <TopBar title="You" />
      <div className="p-4 space-y-4">
        <div className="card">
          <p className="font-semibold">{user?.name}</p>
          <p className="text-white/40 text-sm">{user?.email}</p>
        </div>

        <div className="card space-y-2">
          <p className="font-semibold text-sm">Daily macro targets</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Calories</label>
              <input
                className="input"
                inputMode="numeric"
                value={target.calories}
                onChange={(e) => setTarget((t) => ({ ...t, calories: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="label">Protein (g)</label>
              <input
                className="input"
                inputMode="numeric"
                value={target.protein}
                onChange={(e) => setTarget((t) => ({ ...t, protein: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="label">Carbs (g)</label>
              <input
                className="input"
                inputMode="numeric"
                value={target.carbs}
                onChange={(e) => setTarget((t) => ({ ...t, carbs: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="label">Fat (g)</label>
              <input
                className="input"
                inputMode="numeric"
                value={target.fat}
                onChange={(e) => setTarget((t) => ({ ...t, fat: Number(e.target.value) }))}
              />
            </div>
          </div>
          <button className="btn-primary w-full" onClick={save}>
            {saved ? "Saved ✓" : "Save targets"}
          </button>
        </div>

        <button className="btn-secondary w-full" onClick={logout}>
          Sign out
        </button>
      </div>
    </div>
  );
}
