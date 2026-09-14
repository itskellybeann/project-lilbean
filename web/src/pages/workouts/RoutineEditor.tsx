import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopBar from "../../components/TopBar";
import ExerciseLibrary from "./ExerciseLibrary";
import { api } from "../../api/client";

interface ExerciseRow {
  exerciseId: string;
  name: string;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
}

export default function RoutineEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<any>(`/routines/${id}`).then((routine) => {
      setName(routine.name);
      setNotes(routine.notes || "");
      setRows(
        routine.exercises.map((e: any) => ({
          exerciseId: e.exerciseId,
          name: e.exercise.name,
          targetSets: e.targetSets,
          targetReps: e.targetReps,
          restSeconds: e.restSeconds,
        }))
      );
    });
  }, [id]);

  function addExercise(ex: { id: string; name: string }) {
    setRows((r) => [...r, { exerciseId: ex.id, name: ex.name, targetSets: 3, targetReps: "8-12", restSeconds: 90 }]);
    setPicking(false);
  }

  function updateRow(i: number, patch: Partial<ExerciseRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!name.trim() || rows.length === 0) {
      alert("Give the routine a name and at least one exercise");
      return;
    }
    const payload = { name, notes, exercises: rows };
    if (id) {
      await api.put(`/routines/${id}`, payload);
    } else {
      await api.post("/routines", payload);
    }
    navigate("/workouts/routines");
  }

  if (picking) {
    return (
      <div>
        <TopBar title="Add exercise" right={<button className="btn-secondary text-sm px-3 py-1.5" onClick={() => setPicking(false)}>Cancel</button>} />
        <ExerciseLibrary onPick={addExercise} />
      </div>
    );
  }

  return (
    <div>
      <TopBar title={id ? "Edit routine" : "New routine"} />
      <div className="p-4 space-y-3">
        <input className="input" placeholder="Routine name" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea className="input" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="card">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{row.name}</p>
                <button className="text-white/40" onClick={() => removeRow(i)}>
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div>
                  <label className="label">Sets</label>
                  <input
                    className="input"
                    type="number"
                    value={row.targetSets}
                    onChange={(e) => updateRow(i, { targetSets: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">Reps</label>
                  <input
                    className="input"
                    value={row.targetReps}
                    onChange={(e) => updateRow(i, { targetReps: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Rest (s)</label>
                  <input
                    className="input"
                    type="number"
                    value={row.restSeconds}
                    onChange={(e) => updateRow(i, { restSeconds: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="btn-secondary w-full" onClick={() => setPicking(true)}>
          + Add exercise
        </button>
        <button className="btn-primary w-full" onClick={save}>
          Save routine
        </button>
      </div>
    </div>
  );
}
