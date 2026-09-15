import webpush from "web-push";
import { prisma } from "../db";

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

export const pushEnabled = Boolean(PUBLIC_KEY && PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    PUBLIC_KEY,
    PRIVATE_KEY
  );
} else {
  console.warn("VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — push notifications are disabled.");
}

export function getPublicKey() {
  return PUBLIC_KEY;
}

export async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!pushEnabled) return { sent: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
        sent++;
      } catch (err: any) {
        // 404/410 means the browser dropped the subscription (uninstalled, permissions revoked, etc.)
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error(`Push failed for subscription ${sub.id}:`, err?.message || err);
        }
      }
    })
  );

  return { sent };
}
