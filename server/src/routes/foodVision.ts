import { Router } from "express";
import multer from "multer";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { analyzeFoodPhoto, foodPhotoEnabled } from "../lib/foodVision";

export const foodVisionRouter = Router();
foodVisionRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error("Only image uploads are allowed"));
    cb(null, true);
  },
});

foodVisionRouter.post("/analyze-photo", upload.single("photo"), async (req: AuthedRequest, res) => {
  if (!foodPhotoEnabled) {
    return res.status(400).json({ error: "Food photo analysis is not configured on this server" });
  }
  if (!req.file) return res.status(400).json({ error: "photo file required" });

  try {
    const estimate = await analyzeFoodPhoto(req.file.buffer.toString("base64"), req.file.mimetype);
    res.json(estimate);
  } catch (err: any) {
    console.error("Food photo analysis failed:", err?.message || err);
    res.status(502).json({ error: "Couldn't analyze that photo — try again or enter it manually" });
  }
});
