import { prisma } from "../db";

// Returns the effective macro target for a given date: the main target on a
// training day (a workout was started that day), or the optional rest-day
// target when one has been configured and no workout was logged that day.
export async function resolveTargetForDate(userId: string, date: Date) {
  const target = await prisma.nutritionTarget.findUnique({ where: { userId } });
  if (!target) return null;
  if (target.restCalories == null) return target;

  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const workout = await prisma.workout.findFirst({
    where: { userId, startedAt: { gte: dayStart, lte: dayEnd } },
  });
  if (workout) return target;

  return {
    ...target,
    calories: target.restCalories,
    protein: target.restProtein ?? target.protein,
    carbs: target.restCarbs ?? target.carbs,
    fat: target.restFat ?? target.fat,
  };
}
