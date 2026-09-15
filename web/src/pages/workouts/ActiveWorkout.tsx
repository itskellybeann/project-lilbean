import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopBar from "../../components/TopBar";
import ExerciseLibrary from "./ExerciseLibrary";
import { api } from "../../api/client";

interface SetRow {
  id: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe: number | null;
  isWarmup: boolean;
  exercise: { name: string };
}

interface WorkoutData {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  sets: SetRow[];
}

function useRestTimer() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef<number | null>(null);

  function start(seconds: number) {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setSecondsLeft(seconds);
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
  }, []);

  return { secondsLeft, start };
}

export default function ActiveWorkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<WorkoutData | null>(null);
  const [picking, setPicking] = useState(false);
  const [activeExercise, setActiveExercise] = useState<{ id: string; name: string } | null>(null);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  const timer = useRestTimer();

  function load() {
    if (!id) return;
    api.get<WorkoutData>(`/workouts/${id}`).then(setWorkout);
  }
  useEffect(load, [id]);

  const exerciseGroups = new Map<string, SetRow[]>();
  for (const s of workout?.sets || []) {
    if (!exerciseGroups.has(s.exerciseId)) exerciseGroups.set(s.exerciseId, []);
    exerciseGroups.get(s.exerciseId)!.push(s);
  }

  async function logSet() {
    if (!activeExercise || !weight || !reps) return;
    const existing = exerciseGroups.get(activeExercise.id) || [];
    await api.post(`/workouts/${id}/sets`, {
      exerciseId: activeExercise.id,
      setNumber: existing.length + 1,
      weightKg: Number(weight),
      reps: Number(reps),
      rpe: rpe ? Number(rpe) : null,
    });
    setReps("");
    setRpe("");
    load();
    timer.start(90);
  }

  async function finish() {
    await api.post(`/workouts/${id}/finish`);
    navigate("/workouts/history");
  }

  async function deleteSet(setId: string) {
    await api.del(`/workouts/sets/${setId}`);
    load();
  }

  const isCompleted = !!workout?.endedAt;

  if (picking) {
    return (
      <div>
        <TopBar title="Add exercise" right={<button className="btn-secondary text-sm px-3 py-1.5" onClick={() => setPicking(false)}>Cancel</button>} />
        <ExerciseLibrary
          onPick={(ex) => {
            setActiveExercise(ex);
            setPicking(false);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <TopBar
        title={workout?.name || "Workout"}
        right={
          isCompleted ? (
            <span className="text-bean-400 text-sm font-semibold px-3 py-1.5">Completed ✓</span>
          ) : (
            <button className="btn-primary text-sm px-3 py-1.5" onClick={finish}>
              Finish
            </button>
          )
        }
      />
      <div className="p-4 space-y-4">
        {!isCompleted && timer.secondsLeft > 0 && (
          <div className="card bg-bean-500/10 border-bean-600 text-center">
            <p className="text-xs text-bean-300 uppercase tracking-wide">Rest</p>
            <p className="text-3xl font-bold tabular-nums">
              {Math.floor(timer.secondsLeft / 60)}:{String(timer.secondsLeft % 60).padStart(2, "0")}
            </p>
          </div>
        )}

        {!isCompleted &&
          (!activeExercise ? (
            <button className="btn-primary w-full" onClick={() => setPicking(true)}>
              + Add exercise
            </button>
          ) : (
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold">{activeExercise.name}</p>
                <button className="text-white/40 text-sm" onClick={() => setPicking(true)}>
                  Switch
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label">Weight (kg)</label>
                  <input className="input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>
                <div>
                  <label className="label">Reps</label>
                  <input className="input" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
                </div>
                <div>
                  <label className="label">RPE</label>
                  <input className="input" inputMode="decimal" value={rpe} onChange={(e) => setRpe(e.target.value)} />
                </div>
              </div>
              <button className="btn-primary w-full mt-3" onClick={logSet}>
                Log set
              </button>
            </div>
          ))}

        {Array.from(exerciseGroups.entries()).map(([exId, sets]) => (
          <div key={exId} className="card">
            <p className="font-semibold mb-2">{sets[0].exercise.name}</p>
            <div className="space-y-1.5">
              {sets.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span>
                    Set {s.setNumber}: {s.weightKg}kg × {s.reps} {s.rpe ? `@RPE ${s.rpe}` : ""}
                  </span>
                  <button className="text-white/30" onClick={() => deleteSet(s.id)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
