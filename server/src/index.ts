import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { authRouter } from "./routes/auth";
import { exercisesRouter } from "./routes/exercises";
import { routinesRouter } from "./routes/routines";
import { workoutsRouter } from "./routes/workouts";
import { foodsRouter } from "./routes/foods";
import { foodVisionRouter } from "./routes/foodVision";
import { recipesRouter } from "./routes/recipes";
import { nutritionRouter } from "./routes/nutrition";
import { bodyRouter } from "./routes/body";
import { healthRouter } from "./routes/health";
import { dashboardRouter } from "./routes/dashboard";
import { importsRouter } from "./routes/imports";
import { exportRouter } from "./routes/exportData";
import { pushRouter } from "./routes/push";
import { startReminderCron } from "./lib/reminderCron";

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/exercises", exercisesRouter);
app.use("/api/routines", routinesRouter);
app.use("/api/workouts", workoutsRouter);
app.use("/api/foods", foodsRouter);
app.use("/api/foods", foodVisionRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/nutrition", nutritionRouter);
app.use("/api/body", bodyRouter);
app.use("/api/health-metrics", healthRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/imports", importsRouter);
app.use("/api/export", exportRouter);
app.use("/api/push", pushRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

app.listen(PORT, () => {
  console.log(`lilbean server listening on :${PORT}`);
  startReminderCron();
});
