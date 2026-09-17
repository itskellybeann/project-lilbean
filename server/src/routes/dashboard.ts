import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { estimate1RM } from "../lib/oneRepMax";
import { resolveTargetForDate } from "../lib/targets";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

function dateOnly(d: string | Date) {
  const date = new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function computeWorkoutStreak(userId: string): Promise<number> {
  const workouts = await prisma.workout.findMany({
    where: { userId, endedAt: { not: null } },
    select: { startedAt: true },
    orderBy: { startedAt: "desc" },
  });
  const days = new Set(workouts.map((w) => w.startedAt.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else if (streak === 0 && key === new Date().toISOString().slice(0, 10)) {
      // today not logged yet, don't break the streak on today
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

async function computeLoggingStreak(userId: string): Promise<number> {
  const entries = await prisma.diaryEntry.findMany({
    where: { userId },
    select: { date: true },
  });
  const days = new Set(entries.map((e) => e.date.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else if (streak === 0 && key === new Date().toISOString().slice(0, 10)) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

dashboardRouter.get("/today", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const today = dateOnly(new Date());
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  const [
    activeWorkout,
    todaysWorkouts,
    diaryEntries,
    target,
    latestBodyMetric,
    workoutStreak,
    loggingStreak,
    water,
  ] = await Promise.all([
    prisma.workout.findFirst({ where: { userId, endedAt: null }, orderBy: { startedAt: "desc" } }),
    prisma.workout.findMany({
      where: { userId, startedAt: { gte: todayStart, lte: todayEnd } },
      include: { sets: { include: { exercise: true } } },
      orderBy: { startedAt: "desc" },
    }),
    prisma.diaryEntry.findMany({ where: { userId, date: today } }),
    resolveTargetForDate(userId, today),
    prisma.bodyMetric.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
    computeWorkoutStreak(userId),
    computeLoggingStreak(userId),
    prisma.waterIntake.findFirst({ where: { userId, date: today } }),
  ]);

  const macroTotals = diaryEntries.reduce(
    (acc, e) => {
      acc.calories += e.calories;
      acc.protein += e.protein;
      acc.carbs += e.carbs;
      acc.fat += e.fat;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  res.json({
    activeWorkout,
    todaysWorkouts,
    macroTotals,
    target,
    latestBodyMetric,
    streaks: { workout: workoutStreak, logging: loggingStreak },
    waterMl: water?.ml ?? 0,
  });
});

// Chronological feed of PR moments: every time a set beat the previous best
// weight or estimated 1RM for its exercise.
dashboardRouter.get("/prs", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const sets = await prisma.workoutSet.findMany({
    where: { workout: { userId }, isWarmup: false },
    include: { exercise: { select: { name: true } }, workout: { select: { startedAt: true, name: true } } },
    orderBy: { completedAt: "asc" },
  });

  // Keyed by exerciseId -> the best (weightKg, reps) pair seen so far. Comparing on
  // weight alone means a bodyweight exercise (always weightKg=0) can never register a
  // "weight" PR no matter how many more reps it gets — 0 > 0 is always false — so ties
  // on weight still count as a new best if reps improved.
  const bestSet = new Map<string, { weightKg: number; reps: number }>();
  const best1RM = new Map<string, number>();
  const events: {
    type: "weight" | "1rm";
    exerciseId: string;
    exerciseName: string;
    weightKg: number;
    reps: number;
    value: number;
    date: Date;
    workoutName: string;
  }[] = [];

  for (const s of sets) {
    const prevBest = bestSet.get(s.exerciseId);
    const isNewBest = !prevBest || s.weightKg > prevBest.weightKg || (s.weightKg === prevBest.weightKg && s.reps > prevBest.reps);
    if (isNewBest) {
      bestSet.set(s.exerciseId, { weightKg: s.weightKg, reps: s.reps });
      events.push({
        type: "weight",
        exerciseId: s.exerciseId,
        exerciseName: s.exercise.name,
        weightKg: s.weightKg,
        reps: s.reps,
        value: s.weightKg,
        date: s.workout.startedAt,
        workoutName: s.workout.name,
      });
    }

    // The Epley estimate is definitionally 0 at weightKg=0 (a 1-rep-max *weight* isn't
    // a meaningful concept for a pure-bodyweight set) — the rep-PR handled above is the
    // right signal there, so skip 1RM tracking entirely rather than let a fixed 0 lock
    // out every future set for that exercise.
    if (s.weightKg > 0) {
      const est = estimate1RM(s.weightKg, s.reps);
      const prev1RM = best1RM.get(s.exerciseId) ?? 0;
      if (est > prev1RM) {
        best1RM.set(s.exerciseId, est);
        events.push({
          type: "1rm",
          exerciseId: s.exerciseId,
          exerciseName: s.exercise.name,
          weightKg: s.weightKg,
          reps: s.reps,
          value: est,
          date: s.workout.startedAt,
          workoutName: s.workout.name,
        });
      }
    }
  }

  events.sort((a, b) => b.date.getTime() - a.date.getTime());
  res.json(events.slice(0, 100));
});

// Volume (kg lifted) grouped by muscle group over the last N days.
dashboardRouter.get("/muscle-volume", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const days = Number(req.query.days || 7);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  const sets = await prisma.workoutSet.findMany({
    where: { workout: { userId, startedAt: { gte: since } }, isWarmup: false },
    include: { exercise: { select: { muscleGroups: true } } },
  });

  const volumeByGroup = new Map<string, number>();
  for (const s of sets) {
    const groups = s.exercise.muscleGroups.length ? s.exercise.muscleGroups : ["Other"];
    const vol = s.weightKg * s.reps;
    for (const g of groups) {
      volumeByGroup.set(g, (volumeByGroup.get(g) || 0) + vol);
    }
  }

  res.json(
    Array.from(volumeByGroup.entries())
      .map(([muscleGroup, volume]) => ({ muscleGroup, volume: Math.round(volume) }))
      .sort((a, b) => b.volume - a.volume)
  );
});

// Household view: a light, non-sensitive summary of every account on this
// server (there are only ever a couple, and both are already authenticated
// users of the same household) — streaks and today's status, side by side.
// No diary contents, photos, or workout detail are exposed here.
dashboardRouter.get("/household", async (req: AuthedRequest, res) => {
  const today = dateOnly(new Date());
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  const users = await prisma.user.findMany({ select: { id: true, name: true, colorAccent: true } });

  const summaries = await Promise.all(
    users.map(async (u) => {
      const [workoutStreak, loggingStreak, workoutToday, diaryEntries, target] = await Promise.all([
        computeWorkoutStreak(u.id),
        computeLoggingStreak(u.id),
        prisma.workout.findFirst({ where: { userId: u.id, startedAt: { gte: todayStart, lte: todayEnd } } }),
        prisma.diaryEntry.findMany({ where: { userId: u.id, date: today } }),
        resolveTargetForDate(u.id, today),
      ]);
      const caloriesLogged = diaryEntries.reduce((sum, e) => sum + e.calories, 0);
      return {
        userId: u.id,
        name: u.name,
        colorAccent: u.colorAccent,
        isMe: u.id === req.userId,
        streaks: { workout: workoutStreak, logging: loggingStreak },
        workoutLoggedToday: !!workoutToday,
        caloriesLoggedToday: Math.round(caloriesLogged),
        calorieTarget: target?.calories ?? null,
      };
    })
  );

  res.json(summaries);
});
