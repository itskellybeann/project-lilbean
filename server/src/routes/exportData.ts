import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const exportRouter = Router();
exportRouter.use(requireAuth);

// A full dump of everything this account owns, as one JSON file. Progress
// photos are listed by their stored path/date/notes rather than embedded —
// the image bytes live under /uploads and are covered by the server's own
// filesystem backups.
exportRouter.get("/me", async (req: AuthedRequest, res) => {
  const userId = req.userId!;

  const [
    user,
    workouts,
    routines,
    diaryEntries,
    recipes,
    customFoods,
    bodyMetrics,
    progressPhotos,
    healthMetrics,
    target,
    waterIntakes,
    goal,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, createdAt: true } }),
    prisma.workout.findMany({
      where: { userId },
      include: { sets: { include: { exercise: { select: { name: true } } } } },
      orderBy: { startedAt: "asc" },
    }),
    prisma.routine.findMany({ where: { userId }, include: { exercises: { include: { exercise: true } } } }),
    prisma.diaryEntry.findMany({
      where: { userId },
      include: { food: { select: { name: true } }, recipe: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.recipe.findMany({ where: { userId }, include: { items: { include: { food: true } } } }),
    prisma.food.findMany({ where: { ownerUserId: userId } }),
    prisma.bodyMetric.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.progressPhoto.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.healthMetric.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.nutritionTarget.findUnique({ where: { userId } }),
    prisma.waterIntake.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.userGoal.findUnique({ where: { userId } }),
  ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    user,
    target,
    goal,
    workouts,
    routines,
    diaryEntries,
    recipes,
    customFoods,
    bodyMetrics,
    progressPhotos,
    healthMetrics,
    waterIntakes,
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="lilbean-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.send(JSON.stringify(exportPayload, null, 2));
});
