import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const healthRouter = Router();
healthRouter.use(requireAuth);

function dateOnly(d: string | Date) {
  const date = new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

healthRouter.get("/", async (req: AuthedRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const metrics = await prisma.healthMetric.findMany({
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

// Single manual entry (e.g. typing in last night's sleep/HR from the RingConn app)
healthRouter.post("/", async (req: AuthedRequest, res) => {
  const { date, sleepMinutes, restingHr, hrv, steps, spo2, caloriesBurned, source } = req.body || {};
  if (!date) return res.status(400).json({ error: "date required" });
  const src = source || "manual";
  const metric = await prisma.healthMetric.upsert({
    where: { userId_date_source: { userId: req.userId!, date: dateOnly(date), source: src } },
    update: { sleepMinutes, restingHr, hrv, steps, spo2, caloriesBurned },
    create: {
      userId: req.userId!,
      date: dateOnly(date),
      source: src,
      sleepMinutes,
      restingHr,
      hrv,
      steps,
      spo2,
      caloriesBurned,
    },
  });
  res.status(201).json(metric);
});

// Bulk import — for pasting a CSV/JSON export from the RingConn app or Apple Health/Google Fit,
// since RingConn has no public sync API as of now. Body: { rows: [{date, sleepMinutes, restingHr, hrv, steps, spo2, caloriesBurned}] }
healthRouter.post("/import", async (req: AuthedRequest, res) => {
  const { rows, source } = req.body || {};
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: "rows array required" });
  const src = source || "ringconn";

  let imported = 0;
  for (const row of rows) {
    if (!row.date) continue;
    await prisma.healthMetric.upsert({
      where: { userId_date_source: { userId: req.userId!, date: dateOnly(row.date), source: src } },
      update: {
        sleepMinutes: row.sleepMinutes ?? undefined,
        restingHr: row.restingHr ?? undefined,
        hrv: row.hrv ?? undefined,
        steps: row.steps ?? undefined,
        spo2: row.spo2 ?? undefined,
        caloriesBurned: row.caloriesBurned ?? undefined,
        raw: row,
      },
      create: {
        userId: req.userId!,
        date: dateOnly(row.date),
        source: src,
        sleepMinutes: row.sleepMinutes ?? null,
        restingHr: row.restingHr ?? null,
        hrv: row.hrv ?? null,
        steps: row.steps ?? null,
        spo2: row.spo2 ?? null,
        caloriesBurned: row.caloriesBurned ?? null,
        raw: row,
      },
    });
    imported++;
  }
  res.json({ imported });
});

healthRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const metric = await prisma.healthMetric.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!metric) return res.status(404).json({ error: "Not found" });
  await prisma.healthMetric.delete({ where: { id: metric.id } });
  res.json({ ok: true });
});
