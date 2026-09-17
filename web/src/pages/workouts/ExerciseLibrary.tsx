import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TopBar from "../../components/TopBar";
import { api } from "../../api/client";

interface Exercise {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
  muscleGroups: string[];
}

export default function ExerciseLibrary({ onPick }: { onPick?: (ex: Exercise) => void }) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Other");

  function load() {
    api.get<Exercise[]>("/exercises").then(setExercises);
  }
  useEffect(load, []);

  const grouped = useMemo(() => {
    const filtered = exercises.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));
    const map = new Map<string, Exercise[]>();
    for (const ex of filtered) {
      if (!map.has(ex.category)) map.set(ex.category, []);
      map.get(ex.category)!.push(ex);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [exercises, q]);

  async function createExercise() {
    if (!newName.trim()) return;
    await api.post("/exercises", { name: newName.trim(), category: newCategory, muscleGroups: [] });
    setNewName("");
    setShowNew(false);
    load();
  }

  return (
    <div>
      <TopBar title="Exercises" />
      <div className="p-4 space-y-3">
        <input className="input" placeholder="Search exercises…" value={q} onChange={(e) => setQ(e.target.value)} />

        {!showNew ? (
          <button className="btn-secondary w-full" onClick={() => setShowNew(true)}>
            + Add custom exercise
          </button>
        ) : (
          <div className="card space-y-2">
            <input className="input" placeholder="Exercise name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input className="input" placeholder="Category (e.g. Legs)" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={createExercise}>
                Save
              </button>
              <button className="btn-secondary flex-1" onClick={() => setShowNew(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {grouped.map(([category, list]) => (
          <div key={category}>
            <p className="text-xs uppercase tracking-wide text-white/40 mb-2 mt-4">{category}</p>
            <div className="space-y-2">
              {list.map((ex) =>
                onPick ? (
                  <button key={ex.id} onClick={() => onPick(ex)} className="card w-full text-left flex items-center justify-between">
                    <span>{ex.name}</span>
                    <span className="text-white/30 text-xs">{ex.equipment}</span>
                  </button>
                ) : (
                  <Link key={ex.id} to={`/workouts/exercises/${ex.id}`} className="card flex items-center justify-between">
                    <span>{ex.name}</span>
                    <span className="text-white/30 text-xs">{ex.equipment}</span>
                  </Link>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
