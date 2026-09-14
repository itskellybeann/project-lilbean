import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { signToken, requireAuth, AuthedRequest } from "../middleware/auth";

export const authRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
  maxAge: 90 * 24 * 60 * 60 * 1000,
};

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid email or password" });

  const token = signToken(user.id);
  res.cookie("token", token, COOKIE_OPTS);
  res.json({ id: user.id, email: user.email, name: user.name, colorAccent: user.colorAccent, token });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ id: user.id, email: user.email, name: user.name, colorAccent: user.colorAccent });
});
