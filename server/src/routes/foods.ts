import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { lookupBarcode } from "../lib/openfoodfacts";

export const foodsRouter = Router();
foodsRouter.use(requireAuth);

// Search foods (own custom foods + shared/seeded foods)
foodsRouter.get("/", async (req: AuthedRequest, res) => {
  const q = String(req.query.q || "").trim();
  const foods = await prisma.food.findMany({
    where: {
      AND: [
        { OR: [{ ownerUserId: null }, { ownerUserId: req.userId }] },
        q ? { name: { contains: q, mode: "insensitive" } } : {},
      ],
    },
    orderBy: { name: "asc" },
    take: 50,
  });
  res.json(foods);
});

foodsRouter.post("/", async (req: AuthedRequest, res) => {
  const { name, brand, servingSize, servingUnit, calories, protein, carbs, fat, fiber, sugar, sodium, barcode } =
    req.body || {};
  if (!name || calories == null || protein == null || carbs == null || fat == null) {
    return res.status(400).json({ error: "name, calories, protein, carbs, fat required" });
  }
  const food = await prisma.food.create({
    data: {
      name,
      brand: brand || null,
      barcode: barcode || null,
      servingSize: servingSize ?? 100,
      servingUnit: servingUnit ?? "g",
      calories,
      protein,
      carbs,
      fat,
      fiber: fiber ?? null,
      sugar: sugar ?? null,
      sodium: sodium ?? null,
      ownerUserId: req.userId!,
      source: "manual",
    },
  });
  res.status(201).json(food);
});

// Barcode lookup: check local DB first (shared cache), then OpenFoodFacts, caching the result.
foodsRouter.get("/barcode/:code", async (req: AuthedRequest, res) => {
  const code = req.params.code;
  const existing = await prisma.food.findUnique({ where: { barcode: code } });
  if (existing) return res.json(existing);

  try {
    const product = await lookupBarcode(code);
    if (!product) return res.status(404).json({ error: "Product not found on OpenFoodFacts" });

    const food = await prisma.food.create({
      data: {
        name: product.name,
        brand: product.brand,
        barcode: product.barcode,
        servingSize: product.servingSize,
        servingUnit: product.servingUnit,
        calories: product.calories,
        protein: product.protein,
        carbs: product.carbs,
        fat: product.fat,
        fiber: product.fiber,
        sugar: product.sugar,
        sodium: product.sodium,
        ownerUserId: null,
        source: "openfoodfacts",
      },
    });
    res.json(food);
  } catch (err) {
    res.status(502).json({ error: "Failed to reach OpenFoodFacts" });
  }
});

foodsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const food = await prisma.food.findFirst({ where: { id: req.params.id, ownerUserId: req.userId! } });
  if (!food) return res.status(404).json({ error: "Not found or not yours to delete" });
  await prisma.food.delete({ where: { id: food.id } });
  res.json({ ok: true });
});
