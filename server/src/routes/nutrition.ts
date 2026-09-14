import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { macrosForRecipe } from "./recipes";

export const nutritionRouter = Router();
nutritionRouter.use(requireAuth);

function dateOnly(d: string | Date) {
  const date = new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Diary: list entries for a date
nutritionRouter.get("/diary", async (req: AuthedRequest, res) => {
  const date = dateOnly(String(req.query.date || new Date().toISOString()));
  const entries = await prisma.diaryEntry.findMany({
    where: { userId: req.userId!, date },
    include: { food: true, recipe: true },
    orderBy: { createdAt: "asc" },
  });
  const totals = entries.reduce(
    (acc, e) => {
      acc.calories += e.calories;
      acc.protein += e.protein;
      acc.carbs += e.carbs;
      acc.fat += e.fat;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const target = await prisma.nutritionTarget.findUnique({ where: { userId: req.userId! } });
  res.json({ entries, totals, target });
});

// Add a diary entry from a food (quantity = amount in food's serving unit, e.g. grams) or a recipe (quantity = servings)
nutritionRouter.post("/diary", async (req: AuthedRequest, res) => {
  const { date, meal, foodId, recipeId, quantity } = req.body || {};
  if (!date || !meal || (!foodId && !recipeId)) {
    return res.status(400).json({ error: "date, meal, and foodId or recipeId required" });
  }
  const qty = quantity ?? 1;

  let macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  if (foodId) {
    const food = await prisma.food.findUnique({ where: { id: foodId } });
    if (!food) return res.status(404).json({ error: "Food not found" });
    const factor = qty / food.servingSize;
    macros = {
      calories: food.calories * factor,
      protein: food.protein * factor,
      carbs: food.carbs * factor,
      fat: food.fat * factor,
    };
  } else {
    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, userId: req.userId! },
      include: { items: { include: { food: true } } },
    });
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });
    const perServing = macrosForRecipe(recipe).perServing;
    macros = {
      calories: perServing.calories * qty,
      protein: perServing.protein * qty,
      carbs: perServing.carbs * qty,
      fat: perServing.fat * qty,
    };
  }

  const entry = await prisma.diaryEntry.create({
    data: {
      userId: req.userId!,
      date: dateOnly(date),
      meal,
      foodId: foodId || null,
      recipeId: recipeId || null,
      quantity: qty,
      ...macros,
    },
    include: { food: true, recipe: true },
  });
  res.status(201).json(entry);
});

nutritionRouter.delete("/diary/:id", async (req: AuthedRequest, res) => {
  const entry = await prisma.diaryEntry.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!entry) return res.status(404).json({ error: "Not found" });
  await prisma.diaryEntry.delete({ where: { id: entry.id } });
  res.json({ ok: true });
});

// Weekly / range trends
nutritionRouter.get("/trends", async (req: AuthedRequest, res) => {
  const days = Number(req.query.days || 7);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const entries = await prisma.diaryEntry.findMany({
    where: { userId: req.userId!, date: { gte: dateOnly(since) } },
  });

  const byDate = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
  for (const e of entries) {
    const key = e.date.toISOString().slice(0, 10);
    const existing = byDate.get(key) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
    existing.calories += e.calories;
    existing.protein += e.protein;
    existing.carbs += e.carbs;
    existing.fat += e.fat;
    byDate.set(key, existing);
  }

  res.json(
    Array.from(byDate.entries())
      .map(([date, macros]) => ({ date, ...macros }))
      .sort((a, b) => a.date.localeCompare(b.date))
  );
});

// Targets
nutritionRouter.get("/targets", async (req: AuthedRequest, res) => {
  const target = await prisma.nutritionTarget.findUnique({ where: { userId: req.userId! } });
  res.json(target);
});

nutritionRouter.put("/targets", async (req: AuthedRequest, res) => {
  const { calories, protein, carbs, fat } = req.body || {};
  if ([calories, protein, carbs, fat].some((v) => v == null)) {
    return res.status(400).json({ error: "calories, protein, carbs, fat required" });
  }
  const target = await prisma.nutritionTarget.upsert({
    where: { userId: req.userId! },
    update: { calories, protein, carbs, fat },
    create: { userId: req.userId!, calories, protein, carbs, fat },
  });
  res.json(target);
});
