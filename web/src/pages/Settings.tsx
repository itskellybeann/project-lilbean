import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { isSubscribed, pushSupported, sendTestPush, subscribeToPush, unsubscribeFromPush } from "../lib/push";
import { todayLocalISO } from "../lib/date";

interface Target {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  restCalories?: number | null;
  restProtein?: number | null;
  restCarbs?: number | null;
  restFat?: number | null;
}

interface HevyImportSummary {
  workoutsImported: number;
  workoutsSkippedExisting: number;
  setsImported: number;
  setsSkippedNoWeightOrReps: number;
  exercisesCreated: number;
  errors: string[];
}

export default function Settings() {
  const { user, logout } = useAuth();
  const [target, setTarget] = useState<Target>({ calories: 2200, protein: 150, carbs: 220, fat: 70 });
  const [useRestTarget, setUseRestTarget] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<HevyImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get<Target | null>("/nutrition/targets").then((t) => {
      if (t) {
        setTarget(t);
        setUseRestTarget(t.restCalories != null);
      }
    });
    isSubscribed().then(setPushOn);
  }, []);

  async function togglePush() {
    setPushBusy(true);
    setPushMessage(null);
    try {
      if (pushOn) {
        await unsubscribeFromPush();
        setPushOn(false);
      } else {
        await subscribeToPush();
        setPushOn(true);
      }
    } catch (err: any) {
      setPushMessage(err.message || "Something went wrong");
    } finally {
      setPushBusy(false);
    }
  }

  async function testPush() {
    setPushMessage(null);
    try {
      const result = await sendTestPush();
      setPushMessage(result.sent > 0 ? "Test sent — check your notifications." : "No active subscription found.");
    } catch (err: any) {
      setPushMessage(err.message || "Failed to send test");
    }
  }

  async function exportData() {
    setExporting(true);
    try {
      await api.download("/export/me", `lilbean-export-${todayLocalISO()}.json`);
    } catch (err: any) {
      alert(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function save() {
    await api.put("/nutrition/targets", {
      ...target,
      restCalories: useRestTarget ? target.restCalories ?? target.calories : null,
      restProtein: useRestTarget ? target.restProtein ?? target.protein : null,
      restCarbs: useRestTarget ? target.restCarbs ?? target.carbs : null,
      restFat: useRestTarget ? target.restFat ?? target.fat : null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function importHevy() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await api.post<HevyImportSummary>("/imports/hevy", form);
      setImportResult(result);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      setImportError(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
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

          <label className="flex items-center gap-2 text-xs text-white/60 pt-1">
            <input type="checkbox" checked={useRestTarget} onChange={(e) => setUseRestTarget(e.target.checked)} />
            Use a separate target on rest days (no workout logged)
          </label>

          {useRestTarget && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="label">Rest cal</label>
                <input
                  className="input"
                  inputMode="numeric"
                  value={target.restCalories ?? target.calories}
                  onChange={(e) => setTarget((t) => ({ ...t, restCalories: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="label">Rest protein (g)</label>
                <input
                  className="input"
                  inputMode="numeric"
                  value={target.restProtein ?? target.protein}
                  onChange={(e) => setTarget((t) => ({ ...t, restProtein: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="label">Rest carbs (g)</label>
                <input
                  className="input"
                  inputMode="numeric"
                  value={target.restCarbs ?? target.carbs}
                  onChange={(e) => setTarget((t) => ({ ...t, restCarbs: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="label">Rest fat (g)</label>
                <input
                  className="input"
                  inputMode="numeric"
                  value={target.restFat ?? target.fat}
                  onChange={(e) => setTarget((t) => ({ ...t, restFat: Number(e.target.value) }))}
                />
              </div>
            </div>
          )}

          <button className="btn-primary w-full" onClick={save}>
            {saved ? "Saved ✓" : "Save targets"}
          </button>
        </div>

        <div className="card space-y-2">
          <p className="font-semibold text-sm">Import from Hevy</p>
          <p className="text-white/50 text-xs leading-relaxed">
            In the Hevy app: Settings → Export Data, to get a CSV of your workout history.
            Upload it here to bring your past workouts, sets, and exercises into LilBean.
            Cardio/duration-only sets (no weight or reps) are skipped since this app tracks
            strength sets; already-imported workouts are skipped automatically if you run
            this more than once.
          </p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="input" />
          <button className="btn-secondary w-full" onClick={importHevy} disabled={importing}>
            {importing ? "Importing…" : "Import CSV"}
          </button>
          {importError && <p className="text-bean-400 text-sm">{importError}</p>}
          {importResult && (
            <div className="text-xs text-white/60 space-y-1 pt-1">
              <p>
                ✓ {importResult.workoutsImported} workout{importResult.workoutsImported === 1 ? "" : "s"} imported
                {importResult.workoutsSkippedExisting > 0 && `, ${importResult.workoutsSkippedExisting} already existed`}
              </p>
              <p>
                {importResult.setsImported} set{importResult.setsImported === 1 ? "" : "s"} imported
                {importResult.setsSkippedNoWeightOrReps > 0 &&
                  `, ${importResult.setsSkippedNoWeightOrReps} skipped (no weight/reps)`}
              </p>
              {importResult.exercisesCreated > 0 && <p>{importResult.exercisesCreated} new exercise(s) created</p>}
              {importResult.errors.length > 0 && (
                <div className="text-bean-400">
                  {importResult.errors.slice(0, 5).map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <Link to="/household" className="card block">
          <p className="font-semibold">Household</p>
          <p className="text-white/50 text-sm">See how everyone's doing today</p>
        </Link>

        <div className="card space-y-2">
          <p className="font-semibold text-sm">Notifications</p>
          {pushSupported() ? (
            <>
              <p className="text-white/50 text-xs leading-relaxed">
                A daily nudge if nothing's been logged yet. Needs HTTPS to work — plain LAN/Tailscale IP access
                won't be able to subscribe unless you put an HTTPS proxy in front (see README).
              </p>
              <button className="btn-secondary w-full" onClick={togglePush} disabled={pushBusy}>
                {pushBusy ? "Working…" : pushOn ? "Disable notifications" : "Enable notifications"}
              </button>
              {pushOn && (
                <button className="btn-secondary w-full" onClick={testPush}>
                  Send test notification
                </button>
              )}
              {pushMessage && <p className="text-xs text-bean-400">{pushMessage}</p>}
            </>
          ) : (
            <p className="text-white/40 text-xs">Not supported in this browser/context.</p>
          )}
        </div>

        <div className="card space-y-2">
          <p className="font-semibold text-sm">Your data</p>
          <button className="btn-secondary w-full" onClick={exportData} disabled={exporting}>
            {exporting ? "Preparing…" : "Export my data (JSON)"}
          </button>
        </div>

        <button className="btn-secondary w-full" onClick={logout}>
          Sign out
        </button>
      </div>
    </div>
  );
}
