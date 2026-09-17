import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopBar from "../../components/TopBar";
import ExerciseLibrary from "./ExerciseLibrary";
import PlateCalculator from "../../components/PlateCalculator";
import { api } from "../../api/client";
import { enqueueMutation, isQueued, OFFLINE_SYNC_EVENT, queueForPath, removeFromQueue } from "../../offline/queue";
import { formatLb, lbToKg } from "../../lib/units";

interface SetRow {
  id: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe: number | null;
  isWarmup: boolean;
  supersetId: string | null;
  exercise: { name: string };
}

interface PlannedExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: string;
  exercise: { name: string };
}

interface WorkoutData {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  sets: SetRow[];
  routine: { id: string; name: string; exercises: PlannedExercise[] } | null;
}

interface ExerciseSuggestion {
  suggestion: {
    weightKg: number;
    reps: number;
    lastWeightKg: number;
    lastReps: number;
    kind: "weight" | "reps";
  } | null;
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

// Groups a chronological list of sets into rendering "blocks": a run of
// consecutive sets sharing a supersetId becomes one multi-exercise block,
// everything else is its own single-exercise block.
function buildBlocks(sets: SetRow[]) {
  const blocks: { supersetId: string | null; exerciseOrder: string[]; byExercise: Map<string, SetRow[]> }[] = [];
  for (const s of sets) {
    const last = blocks[blocks.length - 1];
    const continuesSuperset = s.supersetId && last?.supersetId === s.supersetId;
    const continuesSingle = !s.supersetId && !last?.supersetId && last?.exerciseOrder[0] === s.exerciseId;

    if (last && (continuesSuperset || continuesSingle)) {
      if (!last.byExercise.has(s.exerciseId)) {
        last.byExercise.set(s.exerciseId, []);
        last.exerciseOrder.push(s.exerciseId);
      }
      last.byExercise.get(s.exerciseId)!.push(s);
    } else {
      blocks.push({ supersetId: s.supersetId, exerciseOrder: [s.exerciseId], byExercise: new Map([[s.exerciseId, [s]]]) });
    }
  }
  return blocks;
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
  const [suggestion, setSuggestion] = useState<ExerciseSuggestion["suggestion"]>(null);
  const [supersetOn, setSupersetOn] = useState(false);
  const [supersetId, setSupersetId] = useState<string | null>(null);
  const [pendingSets, setPendingSets] = useState<SetRow[]>([]);
  const timer = useRestTimer();

  // Server truth and offline-queue truth are tracked separately and merged
  // only at render time. Refreshing the queue overlay is a pure IndexedDB
  // read that can never fail for being offline, so a set logged offline stays
  // visible (with a "syncing" badge) across reloads even before it reaches
  // the server — unlike a single combined loader, which would throw trying to
  // re-fetch the workout from the network while offline and never get that far.
  async function loadServer() {
    if (!id) return;
    try {
      const server = await api.get<WorkoutData>(`/workouts/${id}`);
      setWorkout(server);
    } catch {
      // offline or a transient error — keep whatever we last successfully loaded
    }
  }

  async function refreshPending() {
    if (!id) return;
    const queued = await queueForPath(`/workouts/${id}/sets`);
    const sets: SetRow[] = queued
      .filter((m) => m.method === "POST")
      .map((m) => {
        const body = m.body as {
          exerciseId: string;
          setNumber: number;
          weightKg: number;
          reps: number;
          rpe: number | null;
          supersetId: string | null;
        };
        return {
          id: m.id,
          exerciseId: body.exerciseId,
          setNumber: body.setNumber,
          weightKg: body.weightKg,
          reps: body.reps,
          rpe: body.rpe ?? null,
          isWarmup: false,
          supersetId: body.supersetId ?? null,
          exercise: { name: (m.meta?.exerciseName as string) || "…" },
        };
      });
    setPendingSets(sets);
  }

  useEffect(() => {
    loadServer();
    refreshPending();
  }, [id]);

  useEffect(() => {
    function onSync() {
      loadServer();
      refreshPending();
    }
    window.addEventListener(OFFLINE_SYNC_EVENT, onSync);
    return () => window.removeEventListener(OFFLINE_SYNC_EVENT, onSync);
  }, [id]);

  const pendingIds = new Set(pendingSets.map((s) => s.id));
  const allSets = [...(workout?.sets || []), ...pendingSets];

  useEffect(() => {
    if (!activeExercise) {
      setSuggestion(null);
      return;
    }
    api
      .get<ExerciseSuggestion>(`/exercises/${activeExercise.id}/stats`)
      .then((s) => setSuggestion(s.suggestion))
      .catch(() => setSuggestion(null));
  }, [activeExercise]);

  const blocks = buildBlocks(allSets);
  const exerciseCounts = new Map<string, number>();
  for (const s of allSets) {
    exerciseCounts.set(s.exerciseId, (exerciseCounts.get(s.exerciseId) || 0) + 1);
  }

  function toggleSuperset() {
    setSupersetOn((on) => {
      const next = !on;
      setSupersetId(next ? crypto.randomUUID() : null);
      return next;
    });
  }

  async function logSet() {
    if (!activeExercise || !weight || !reps || !id) return;
    const clientId = crypto.randomUUID();
    const setNumber = (exerciseCounts.get(activeExercise.id) || 0) + 1;
    const payload = {
      exerciseId: activeExercise.id,
      setNumber,
      weightKg: lbToKg(Number(weight)),
      reps: Number(reps),
      rpe: rpe ? Number(rpe) : null,
      supersetId,
      clientId,
    };

    try {
      await api.post(`/workouts/${id}/sets`, payload);
      await loadServer();
    } catch {
      await enqueueMutation({
        method: "POST",
        path: `/workouts/${id}/sets`,
        body: payload,
        id: clientId,
        meta: { exerciseName: activeExercise.name },
      });
      await refreshPending();
    }

    setReps("");
    setRpe("");
    if (!supersetOn) timer.start(90);
  }

  async function finish() {
    await api.post(`/workouts/${id}/finish`);
    navigate("/workouts/history");
  }

  async function deleteSet(setId: string) {
    if (await isQueued(setId)) {
      await removeFromQueue(setId);
      await refreshPending();
    } else {
      await api.del(`/workouts/sets/${setId}`);
      await loadServer();
    }
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

        {!isCompleted && !activeExercise && workout?.routine && workout.routine.exercises.length > 0 && (
          <div className="card space-y-2">
            <p className="text-xs uppercase tracking-wide text-white/40">{workout.routine.name} plan</p>
            {workout.routine.exercises.map((pe) => {
              const setsLogged = exerciseCounts.get(pe.exerciseId) || 0;
              return (
                <button
                  key={pe.exerciseId}
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setActiveExercise({ id: pe.exerciseId, name: pe.exercise.name })}
                >
                  <span className={setsLogged > 0 ? "text-white/40 line-through" : ""}>{pe.exercise.name}</span>
                  <span className="text-white/40 text-xs">
                    {setsLogged}/{pe.targetSets} × {pe.targetReps}
                  </span>
                </button>
              );
            })}
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
                <div className="flex items-center gap-3">
                  <button
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      supersetOn ? "bg-bean-500 text-white" : "bg-ink-800 text-white/50"
                    }`}
                    onClick={toggleSuperset}
                  >
                    🔗 Superset {supersetOn ? "on" : "off"}
                  </button>
                  <button className="text-white/40 text-sm" onClick={() => setPicking(true)}>
                    Switch
                  </button>
                </div>
              </div>

              {suggestion && (
                <p className="text-xs text-bean-300 bg-bean-500/10 rounded-lg px-2.5 py-1.5 mb-2">
                  💡 Last time: {formatLb(suggestion.lastWeightKg)}lb × {suggestion.lastReps}. Try{" "}
                  {suggestion.kind === "weight" ? "adding weight" : "one more rep"}:{" "}
                  {formatLb(suggestion.weightKg)}lb × {suggestion.reps}.
                </p>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label">Weight (lbs)</label>
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
              <div className="mt-2">
                <PlateCalculator weightLb={Number(weight) || 0} />
              </div>
              <button className="btn-primary w-full mt-3" onClick={logSet}>
                Log set
              </button>
            </div>
          ))}

        {blocks.map((block, i) => (
          <div key={i} className={block.supersetId ? "card border-bean-600 bg-bean-500/5 space-y-3" : "card"}>
            {block.supersetId && (
              <p className="text-bean-400 text-xs font-semibold uppercase tracking-wide">🔗 Superset</p>
            )}
            {block.exerciseOrder.map((exId) => {
              const sets = block.byExercise.get(exId)!;
              return (
                <div key={exId}>
                  <p className="font-semibold mb-1.5">{sets[0].exercise.name}</p>
                  <div className="space-y-1.5">
                    {sets.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-sm">
                        <span>
                          Set {s.setNumber}: {formatLb(s.weightKg)}lb × {s.reps} {s.rpe ? `@RPE ${s.rpe}` : ""}
                          {pendingIds.has(s.id) && <span className="text-white/30 ml-2 text-xs">⏳ syncing</span>}
                        </span>
                        <button className="text-white/30" onClick={() => deleteSet(s.id)}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
