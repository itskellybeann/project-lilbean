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
