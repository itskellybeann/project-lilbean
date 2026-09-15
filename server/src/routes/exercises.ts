import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { estimate1RM } from "../lib/oneRepMax";

export const exercisesRouter = Router();
exercisesRouter.use(requireAuth);

exercisesRouter.get("/", async (req: AuthedRequest, res) => {
  const exercises = await prisma.exercise.findMany({
    where: {
      OR: [{ isCustom: false }, { createdByUserId: req.userId }],
    },
    orderBy: { name: "asc" },
  });
  res.json(exercises);
});

exercisesRouter.post("/", async (req: AuthedRequest, res) => {
  const { name, category, equipment, muscleGroups } = req.body || {};
  if (!name || !category) return res.status(400).json({ error: "name and category required" });
  const exercise = await prisma.exercise.create({
    data: {
      name,
      category,
      equipment: equipment || null,
      muscleGroups: muscleGroups || [],
      isCustom: true,
      createdByUserId: req.userId!,
    },
  });
  res.status(201).json(exercise);
});

// History of sets for an exercise for the current user, most recent first
exercisesRouter.get("/:id/history", async (req: AuthedRequest, res) => {
  const sets = await prisma.workoutSet.findMany({
    where: {
      exerciseId: req.params.id,
      workout: { userId: req.userId! },
    },
    include: { workout: { select: { startedAt: true, name: true } } },
    orderBy: { completedAt: "desc" },
    take: 200,
  });
  res.json(sets);
});

// PR + estimated 1RM + volume-over-time for an exercise
exercisesRouter.get("/:id/stats", async (req: AuthedRequest, res) => {
  const sets = await prisma.workoutSet.findMany({
    where: {
      exerciseId: req.params.id,
      workout: { userId: req.userId! },
      isWarmup: false,
    },
    include: { workout: { select: { startedAt: true } } },
    orderBy: { completedAt: "asc" },
  });

  let heaviestSet = null as null | { weightKg: number; reps: number; date: Date };
  let best1RM = 0;
  let best1RMDate: Date | null = null;
  const volumeByWorkout = new Map<string, { date: Date; volume: number }>();
  let lastWorkoutId: string | null = null;
  let lastWorkoutDate: Date | null = null;

  for (const s of sets) {
    if (!heaviestSet || s.weightKg > heaviestSet.weightKg) {
      heaviestSet = { weightKg: s.weightKg, reps: s.reps, date: s.workout.startedAt };
    }
    const est = estimate1RM(s.weightKg, s.reps);
    if (est > best1RM) {
      best1RM = est;
      best1RMDate = s.workout.startedAt;
    }
    const key = s.workoutId;
    const existing = volumeByWorkout.get(key);
    const vol = s.weightKg * s.reps;
    if (existing) existing.volume += vol;
    else volumeByWorkout.set(key, { date: s.workout.startedAt, volume: vol });

    // sets are ordered ascending by completedAt, so the last one processed
    // belongs to the most recent workout
    lastWorkoutId = s.workoutId;
    lastWorkoutDate = s.workout.startedAt;
  }

  // Progressive overload suggestion, based on the heaviest set from the most
  // recent workout that included this exercise: more reps than a normal working
  // set suggests adding a little weight next time; fewer suggests chasing a rep.
  let suggestion: { weightKg: number; reps: number; note: string } | null = null;
  if (lastWorkoutId) {
    const lastWorkoutSets = sets.filter((s) => s.workoutId === lastWorkoutId);
    const topSet = lastWorkoutSets.reduce((best, s) => (s.weightKg > best.weightKg ? s : best), lastWorkoutSets[0]);
    if (topSet) {
      if (topSet.reps >= 8) {
        suggestion = {
          weightKg: Math.round((topSet.weightKg + 2.5) * 10) / 10,
          reps: topSet.reps,
          note: `Last time: ${topSet.weightKg}kg × ${topSet.reps}. Try adding weight.`,
        };
      } else {
        suggestion = {
          weightKg: topSet.weightKg,
          reps: topSet.reps + 1,
          note: `Last time: ${topSet.weightKg}kg × ${topSet.reps}. Try one more rep.`,
        };
      }
    }
  }

  res.json({
    heaviestSet,
    estimated1RM: best1RM || null,
    estimated1RMDate: best1RMDate,
    volumeOverTime: Array.from(volumeByWorkout.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    ),
    totalSets: sets.length,
    suggestion,
    lastWorkoutDate,
  });
});
