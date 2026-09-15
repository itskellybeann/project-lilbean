import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { getPublicKey, pushEnabled, sendPushToUser } from "../lib/push";

export const pushRouter = Router();
pushRouter.use(requireAuth);

pushRouter.get("/vapid-public-key", (_req, res) => {
  res.json({ publicKey: getPublicKey(), enabled: pushEnabled });
});

pushRouter.post("/subscribe", async (req: AuthedRequest, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "endpoint and keys.p256dh/keys.auth required" });
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: req.userId!, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId: req.userId!, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
  res.status(201).json({ ok: true });
});

pushRouter.post("/unsubscribe", async (req: AuthedRequest, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: "endpoint required" });
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.userId! } });
  res.json({ ok: true });
});

pushRouter.post("/test", async (req: AuthedRequest, res) => {
  if (!pushEnabled) return res.status(400).json({ error: "Push notifications are not configured on this server" });
  const result = await sendPushToUser(req.userId!, {
    title: "LilBean",
    body: "Test notification — if you can see this, push is working!",
  });
  res.json(result);
});
