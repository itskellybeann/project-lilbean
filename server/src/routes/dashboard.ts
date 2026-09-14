import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

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

  const [activeWorkout, todaysWorkouts, diaryEntries, target, todayHealth, latestBodyMetric, workoutStreak, loggingStreak] =
    await Promise.all([
      prisma.workout.findFirst({ where: { userId, endedAt: null }, orderBy: { startedAt: "desc" } }),
      prisma.workout.findMany({
        where: { userId, startedAt: { gte: todayStart, lte: todayEnd } },
        include: { sets: true },
      }),
      prisma.diaryEntry.findMany({ where: { userId, date: today } }),
      prisma.nutritionTarget.findUnique({ where: { userId } }),
      prisma.healthMetric.findFirst({ where: { userId, date: today }, orderBy: { id: "desc" } }),
      prisma.bodyMetric.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
      computeWorkoutStreak(userId),
      computeLoggingStreak(userId),
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
    todayHealth,
    latestBodyMetric,
    streaks: { workout: workoutStreak, logging: loggingStreak },
  });
});
