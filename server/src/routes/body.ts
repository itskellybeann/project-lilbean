import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const bodyRouter = Router();
bodyRouter.use(requireAuth);

function dateOnly(d: string | Date) {
  const date = new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Body metrics (weight, body fat %, tape measurements)
bodyRouter.get("/metrics", async (req: AuthedRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const metrics = await prisma.bodyMetric.findMany({
    where: {
      userId: req.userId!,
      ...(from || to
        ? { date: { ...(from ? { gte: dateOnly(from) } : {}), ...(to ? { lte: dateOnly(to) } : {}) } }
        : {}),
    },
    orderBy: { date: "asc" },
  });
  res.json(metrics);
});

bodyRouter.post("/metrics", async (req: AuthedRequest, res) => {
  const { date, weightKg, bodyFatPct, measurements } = req.body || {};
  if (!date) return res.status(400).json({ error: "date required" });
  const existing = await prisma.bodyMetric.findFirst({ where: { userId: req.userId!, date: dateOnly(date) } });
  const metric = existing
    ? await prisma.bodyMetric.update({ where: { id: existing.id }, data: { weightKg, bodyFatPct, measurements } })
    : await prisma.bodyMetric.create({
        data: { userId: req.userId!, date: dateOnly(date), weightKg, bodyFatPct, measurements },
      });
  res.status(201).json(metric);
});

bodyRouter.delete("/metrics/:id", async (req: AuthedRequest, res) => {
  const metric = await prisma.bodyMetric.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!metric) return res.status(404).json({ error: "Not found" });
  await prisma.bodyMetric.delete({ where: { id: metric.id } });
  res.json({ ok: true });
});

// Goal weight + a simple linear projection based on recent weigh-ins
bodyRouter.get("/goal", async (req: AuthedRequest, res) => {
  const goal = await prisma.userGoal.findUnique({ where: { userId: req.userId! } });
  if (!goal?.goalWeightKg) return res.json({ goal: null, projection: null });

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 60);
  const metrics = await prisma.bodyMetric.findMany({
    where: { userId: req.userId!, weightKg: { not: null }, date: { gte: since } },
    orderBy: { date: "asc" },
  });

  let projection: { currentRateKgPerWeek: number; projectedDate: string } | null = null;
  if (metrics.length >= 2) {
    const first = metrics[0];
    const last = metrics[metrics.length - 1];
    const daysBetween = (last.date.getTime() - first.date.getTime()) / 86400000;
    if (daysBetween >= 3 && first.weightKg != null && last.weightKg != null) {
      const changePerDay = (last.weightKg - first.weightKg) / daysBetween;
      const remaining = goal.goalWeightKg - last.weightKg;
      const movingTowardGoal = (remaining > 0 && changePerDay > 0) || (remaining < 0 && changePerDay < 0);
      if (movingTowardGoal) {
        const daysToGoal = remaining / changePerDay;
        const projectedDate = new Date(last.date.getTime() + daysToGoal * 86400000);
        projection = {
          currentRateKgPerWeek: Math.round(changePerDay * 7 * 100) / 100,
          projectedDate: projectedDate.toISOString().slice(0, 10),
        };
      }
    }
  }

  res.json({ goal, projection });
});

bodyRouter.put("/goal", async (req: AuthedRequest, res) => {
  const { goalWeightKg } = req.body || {};
  const goal = await prisma.userGoal.upsert({
    where: { userId: req.userId! },
    update: { goalWeightKg: goalWeightKg ?? null },
    create: { userId: req.userId!, goalWeightKg: goalWeightKg ?? null },
  });
  res.json(goal);
});

// Progress photos
const uploadDir = path.join(__dirname, "..", "..", "uploads", "photos");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req: any, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${req.userId}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error("Only image uploads are allowed"));
    cb(null, true);
  },
});

bodyRouter.get("/photos", async (req: AuthedRequest, res) => {
  const photos = await prisma.progressPhoto.findMany({
    where: { userId: req.userId! },
    orderBy: { date: "desc" },
  });
  res.json(photos);
});

bodyRouter.post("/photos", upload.single("photo"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "photo file required" });
  const { date, notes } = req.body || {};
  const photo = await prisma.progressPhoto.create({
    data: {
      userId: req.userId!,
      date: dateOnly(date || new Date()),
      filePath: `/uploads/photos/${req.file.filename}`,
      notes: notes || null,
    },
  });
  res.status(201).json(photo);
});

bodyRouter.delete("/photos/:id", async (req: AuthedRequest, res) => {
  const photo = await prisma.progressPhoto.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!photo) return res.status(404).json({ error: "Not found" });
  const filePath = path.join(__dirname, "..", "..", photo.filePath.replace(/^\/uploads/, "uploads"));
  fs.unlink(filePath, () => {});
  await prisma.progressPhoto.delete({ where: { id: photo.id } });
  res.json({ ok: true });
});
