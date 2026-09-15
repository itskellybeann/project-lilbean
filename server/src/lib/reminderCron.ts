import cron from "node-cron";
import { prisma } from "../db";
import { pushEnabled, sendPushToUser } from "./push";

function dateOnly(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function runDailyReminderCheck() {
  const today = dateOnly(new Date());
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  const users = await prisma.user.findMany({ select: { id: true } });

  for (const user of users) {
    const [workoutToday, diaryToday] = await Promise.all([
      prisma.workout.findFirst({ where: { userId: user.id, startedAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.diaryEntry.findFirst({ where: { userId: user.id, date: today } }),
    ]);

    if (!workoutToday && !diaryToday) {
      await sendPushToUser(user.id, {
        title: "LilBean",
        body: "Nothing logged today yet — a quick workout or meal entry keeps your streak alive.",
      });
    }
  }
}

// Runs once a day (default 8pm server time) and nudges anyone who hasn't
// logged a workout or a meal yet. Best-effort: silently a no-op if push
// isn't configured (no VAPID keys) or nobody has an active subscription.
export function startReminderCron() {
  if (!pushEnabled) return;

  const time = process.env.REMINDER_CRON || "0 20 * * *";
  cron.schedule(time, () => {
    runDailyReminderCheck().catch((err) => console.error("Daily reminder check failed:", err));
  });
  console.log(`Daily reminder cron scheduled: "${time}"`);
}
