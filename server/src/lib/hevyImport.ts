import { parse } from "csv-parse/sync";
import { prisma } from "../db";

// Hevy's CSV export (Settings > Export Data in the Hevy app) is one row per set,
// with these columns. Older/newer app versions have been seen to vary date
// formatting, so date parsing below is deliberately tolerant.
interface HevyRow {
  title: string;
  start_time: string;
  end_time: string;
  description: string;
  exercise_title: string;
  superset_id: string;
  exercise_notes: string;
  set_index: string;
  set_type: string;
  weight_kg: string;
  reps: string;
  distance_km: string;
  duration_seconds: string;
  rpe: string;
}

export interface HevyImportSummary {
  workoutsImported: number;
  workoutsSkippedExisting: number;
  setsImported: number;
  setsSkippedNoWeightOrReps: number;
  exercisesCreated: number;
  errors: string[];
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Handles ISO-ish strings and Hevy's "25 Dec 2023, 09:15" style export format.
function parseHevyDate(raw: string): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  const iso = new Date(trimmed);
  if (!isNaN(iso.getTime())) return iso;

  const match = trimmed.match(/^(\d{1,2})\s+(\w{3})\w*\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const [, day, monName, year, hour, minute, second] = match;
    const month = MONTHS[monName.toLowerCase().slice(0, 3)];
    if (month !== undefined) {
      return new Date(Date.UTC(Number(year), month, Number(day), Number(hour), Number(minute), Number(second || 0)));
    }
  }
  return null;
}

function toNumberOrNull(v: string | undefined): number | null {
  if (v === undefined || v === null || v.trim() === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export async function importHevyCsv(csvText: string, userId: string): Promise<HevyImportSummary> {
  const summary: HevyImportSummary = {
    workoutsImported: 0,
    workoutsSkippedExisting: 0,
    setsImported: 0,
    setsSkippedNoWeightOrReps: 0,
    exercisesCreated: 0,
    errors: [],
  };

  let rows: HevyRow[];
  try {
    rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) as HevyRow[];
  } catch (err: any) {
    summary.errors.push(`Could not parse CSV: ${err.message}`);
    return summary;
  }

  if (rows.length === 0) {
    summary.errors.push("No rows found in file.");
    return summary;
  }

  // Group rows into workouts, keyed by title + start_time + end_time (a Hevy export
  // has one row per set, all rows for one workout share these three fields).
  const groups = new Map<string, HevyRow[]>();
  for (const row of rows) {
    const key = `${row.title}__${row.start_time}__${row.end_time}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const exerciseCache = new Map<string, string>(); // name.toLowerCase() -> exerciseId

  for (const [, groupRows] of groups) {
    const first = groupRows[0];
    const startedAt = parseHevyDate(first.start_time);
    if (!startedAt) {
      summary.errors.push(`Skipped workout "${first.title}": unrecognized date "${first.start_time}"`);
      continue;
    }
    const endedAt = parseHevyDate(first.end_time);

    const existing = await prisma.workout.findFirst({
      where: { userId, name: first.title || "Workout", startedAt },
    });
    if (existing) {
      summary.workoutsSkippedExisting++;
      continue;
    }

    const workout = await prisma.workout.create({
      data: {
        userId,
        name: first.title || "Workout",
        notes: first.description || null,
        startedAt,
        endedAt: endedAt || undefined,
      },
    });
    summary.workoutsImported++;

    const setCounters = new Map<string, number>(); // exerciseId -> running set count in this workout

    for (const row of groupRows) {
      const exerciseName = (row.exercise_title || "").trim();
      if (!exerciseName) continue;

      const weightKg = toNumberOrNull(row.weight_kg);
      const reps = toNumberOrNull(row.reps);
      // Hevy also exports cardio/duration-only sets (distance_km/duration_seconds);
      // this app tracks strength sets as weight x reps, so those don't map cleanly
      // and are skipped rather than recorded as 0kg x 0 reps. Skip before touching
      // the exercise library so a cardio-only movement never creates a dangling entry.
      if (weightKg === null || reps === null) {
        summary.setsSkippedNoWeightOrReps++;
        continue;
      }

      const cacheKey = exerciseName.toLowerCase();
      let exerciseId = exerciseCache.get(cacheKey);
      if (!exerciseId) {
        const found = await prisma.exercise.findFirst({
          where: {
            name: { equals: exerciseName, mode: "insensitive" },
            OR: [{ isCustom: false }, { createdByUserId: userId }],
          },
        });
        if (found) {
          exerciseId = found.id;
        } else {
          const created = await prisma.exercise.create({
            data: {
              name: exerciseName,
              category: "Imported",
              isCustom: true,
              createdByUserId: userId,
              muscleGroups: [],
            },
          });
          exerciseId = created.id;
          summary.exercisesCreated++;
        }
        exerciseCache.set(cacheKey, exerciseId);
      }

      const setNumber = (setCounters.get(exerciseId) || 0) + 1;
      setCounters.set(exerciseId, setNumber);

      await prisma.workoutSet.create({
        data: {
          workoutId: workout.id,
          exerciseId,
          setNumber,
          weightKg,
          reps,
          rpe: toNumberOrNull(row.rpe),
          isWarmup: (row.set_type || "").trim().toLowerCase() === "warmup",
          completedAt: endedAt || startedAt,
        },
      });
      summary.setsImported++;
    }
  }

  return summary;
}
