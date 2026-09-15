import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const workoutsRouter = Router();
workoutsRouter.use(requireAuth);

// List / history (optionally filter by month for calendar view: ?from=&to=)
workoutsRouter.get("/", async (req: AuthedRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const workouts = await prisma.workout.findMany({
    where: {
      userId: req.userId!,
      ...(from || to
        ? {
            startedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: {
      sets: { include: { exercise: true } },
      routine: { select: { name: true } },
    },
    orderBy: { startedAt: "desc" },
  });
  res.json(workouts);
});

workoutsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const workout = await prisma.workout.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: { sets: { include: { exercise: true }, orderBy: { completedAt: "asc" } }, routine: true },
  });
  if (!workout) return res.status(404).json({ error: "Not found" });
  res.json(workout);
});

// Start a workout, optionally from a routine
workoutsRouter.post("/", async (req: AuthedRequest, res) => {
  const { name, routineId } = req.body || {};
  const workout = await prisma.workout.create({
    data: {
      userId: req.userId!,
      routineId: routineId || null,
      name: name || "Workout",
    },
  });
  res.status(201).json(workout);
});

workoutsRouter.put("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.workout.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  const { name, notes, endedAt } = req.body || {};
  const workout = await prisma.workout.update({
    where: { id: existing.id },
    data: {
      name: name ?? existing.name,
      notes: notes ?? existing.notes,
      endedAt: endedAt ? new Date(endedAt) : existing.endedAt,
    },
  });
  res.json(workout);
});

workoutsRouter.post("/:id/finish", async (req: AuthedRequest, res) => {
  const existing = await prisma.workout.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  const workout = await prisma.workout.update({ where: { id: existing.id }, data: { endedAt: new Date() } });
  res.json(workout);
});

workoutsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.workout.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.workout.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

// Sets
workoutsRouter.post("/:id/sets", async (req: AuthedRequest, res) => {
  const workout = await prisma.workout.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!workout) return res.status(404).json({ error: "Not found" });

  const { exerciseId, setNumber, weightKg, reps, rpe, isWarmup, supersetId, clientId } = req.body || {};
  if (!exerciseId || weightKg == null || reps == null) {
    return res.status(400).json({ error: "exerciseId, weightKg, reps required" });
  }

  // clientId lets the offline queue safely replay a queued set creation without
  // double-logging it if the first attempt actually succeeded before the client
  // lost track of the response (e.g. request sent, connection dropped before reply).
  if (clientId) {
    const existing = await prisma.workoutSet.findUnique({
      where: { workoutId_clientId: { workoutId: workout.id, clientId } },
      include: { exercise: true },
    });
    if (existing) return res.status(201).json(existing);
  }

  const set = await prisma.workoutSet.create({
    data: {
      workoutId: workout.id,
      exerciseId,
      setNumber: setNumber ?? 1,
      weightKg,
      reps,
      rpe: rpe ?? null,
      isWarmup: !!isWarmup,
      supersetId: supersetId ?? null,
      clientId: clientId ?? null,
    },
    include: { exercise: true },
  });
  res.status(201).json(set);
});

workoutsRouter.put("/sets/:setId", async (req: AuthedRequest, res) => {
  const set = await prisma.workoutSet.findFirst({
    where: { id: req.params.setId, workout: { userId: req.userId! } },
  });
  if (!set) return res.status(404).json({ error: "Not found" });
  const { weightKg, reps, rpe, isWarmup } = req.body || {};
  const updated = await prisma.workoutSet.update({
    where: { id: set.id },
    data: {
      weightKg: weightKg ?? set.weightKg,
      reps: reps ?? set.reps,
      rpe: rpe ?? set.rpe,
      isWarmup: isWarmup ?? set.isWarmup,
    },
    include: { exercise: true },
  });
  res.json(updated);
});

workoutsRouter.delete("/sets/:setId", async (req: AuthedRequest, res) => {
  const set = await prisma.workoutSet.findFirst({
    where: { id: req.params.setId, workout: { userId: req.userId! } },
  });
  if (!set) return res.status(404).json({ error: "Not found" });
  await prisma.workoutSet.delete({ where: { id: set.id } });
  res.json({ ok: true });
});
