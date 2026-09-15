import { Router } from "express";
import multer from "multer";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { importHevyCsv } from "../lib/hevyImport";

export const importsRouter = Router();
importsRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

importsRouter.post("/hevy", upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "CSV file required (field name: file)" });

  const csvText = req.file.buffer.toString("utf-8");
  const summary = await importHevyCsv(csvText, req.userId!);
  res.json(summary);
});
