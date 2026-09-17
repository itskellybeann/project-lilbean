import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const routinesRouter = Router();
routinesRouter.use(requireAuth);

routinesRouter.get("/", async (req: AuthedRequest, res) => {
  const routines = await prisma.routine.findMany({
    where: { userId: req.userId! },
    include: { exercises: { include: { exercise: true }, orderBy: { order: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json(routines);
});

routinesRouter.get("/:id", async (req: AuthedRequest, res) => {
  const routine = await prisma.routine.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: { exercises: { include: { exercise: true }, orderBy: { order: "asc" } } },
  });
  if (!routine) return res.status(404).json({ error: "Not found" });
  res.json(routine);
});

routinesRouter.post("/", async (req: AuthedRequest, res) => {
  const { name, notes, exercises } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const routine = await prisma.routine.create({
    data: {
      userId: req.userId!,
      name,
      notes: notes || null,
      exercises: {
        create: (exercises || []).map((e: any, i: number) => ({
          exerciseId: e.exerciseId,
          order: i,
          targetSets: e.targetSets ?? 3,
          targetReps: e.targetReps ?? "8-12",
          targetWeight: e.targetWeight ?? null,
          restSeconds: e.restSeconds ?? 90,
          supersetId: e.supersetId ?? null,
        })),
      },
    },
    include: { exercises: { include: { exercise: true } } },
  });
  res.status(201).json(routine);
});

routinesRouter.put("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.routine.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { name, notes, exercises } = req.body || {};

  await prisma.$transaction([
    prisma.routineExercise.deleteMany({ where: { routineId: existing.id } }),
    prisma.routine.update({
      where: { id: existing.id },
      data: {
        name: name ?? existing.name,
        notes: notes ?? existing.notes,
        exercises: {
          create: (exercises || []).map((e: any, i: number) => ({
            exerciseId: e.exerciseId,
            order: i,
            targetSets: e.targetSets ?? 3,
            targetReps: e.targetReps ?? "8-12",
            targetWeight: e.targetWeight ?? null,
            restSeconds: e.restSeconds ?? 90,
            supersetId: e.supersetId ?? null,
          })),
        },
      },
    }),
  ]);

  const updated = await prisma.routine.findUnique({
    where: { id: existing.id },
    include: { exercises: { include: { exercise: true }, orderBy: { order: "asc" } } },
  });
  res.json(updated);
});

routinesRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.routine.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.routine.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});
