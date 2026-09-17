import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { macrosForRecipe } from "./recipes";
import { resolveTargetForDate } from "../lib/targets";

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
  const target = await resolveTargetForDate(req.userId!, date);
  res.json({ entries, totals, target });
});

// Duplicate every diary entry from one date onto another (e.g. "copy yesterday").
nutritionRouter.post("/diary/copy", async (req: AuthedRequest, res) => {
  const { fromDate, toDate } = req.body || {};
  if (!fromDate || !toDate) return res.status(400).json({ error: "fromDate and toDate required" });

  const source = await prisma.diaryEntry.findMany({
    where: { userId: req.userId!, date: dateOnly(fromDate) },
  });
  if (source.length === 0) return res.json({ copied: 0 });

  const target = dateOnly(toDate);
  await prisma.diaryEntry.createMany({
    data: source.map((e) => ({
      userId: req.userId!,
      date: target,
      meal: e.meal,
      foodId: e.foodId,
      recipeId: e.recipeId,
      quantity: e.quantity,
      calories: e.calories,
      protein: e.protein,
      carbs: e.carbs,
      fat: e.fat,
    })),
  });
  res.json({ copied: source.length });
});

// Add a diary entry from a food (quantity = amount in food's serving unit, e.g. grams) or a recipe
// (quantity = servings, unless `items` overrides individual ingredient weights for this log only —
// the recipe's own saved quantities are left untouched).
nutritionRouter.post("/diary", async (req: AuthedRequest, res) => {
  const { date, meal, foodId, recipeId, quantity, items: itemOverrides } = req.body || {};
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

    if (Array.isArray(itemOverrides) && itemOverrides.length) {
      const foodById = new Map(recipe.items.map((i) => [i.foodId, i.food]));
      macros = itemOverrides.reduce(
        (acc: typeof macros, o: { foodId: string; quantity: number }) => {
          const food = foodById.get(o.foodId);
          if (!food || !o.quantity) return acc;
          const factor = o.quantity / food.servingSize;
          acc.calories += food.calories * factor;
          acc.protein += food.protein * factor;
          acc.carbs += food.carbs * factor;
          acc.fat += food.fat * factor;
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
    } else {
      const perServing = macrosForRecipe(recipe).perServing;
      macros = {
        calories: perServing.calories * qty,
        protein: perServing.protein * qty,
        carbs: perServing.carbs * qty,
        fat: perServing.fat * qty,
      };
    }
  }

  // `quantity` is left at its default of 1 for an item-overridden recipe log: once each
  // ingredient can be scaled independently there's no single serving-multiplier left to
  // record (macros are already computed and stored directly above). Don't repurpose this
  // field to mean anything else for that case without also handling it in copy/export.
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
  const { calories, protein, carbs, fat, restCalories, restProtein, restCarbs, restFat } = req.body || {};
  if ([calories, protein, carbs, fat].some((v) => v == null)) {
    return res.status(400).json({ error: "calories, protein, carbs, fat required" });
  }
  // Rest-day fields are optional as a group: send restCalories to enable a
  // separate rest-day target, or omit/null it to always use the main target.
  const restFields = {
    restCalories: restCalories ?? null,
    restProtein: restCalories != null ? restProtein ?? null : null,
    restCarbs: restCalories != null ? restCarbs ?? null : null,
    restFat: restCalories != null ? restFat ?? null : null,
  };
  const target = await prisma.nutritionTarget.upsert({
    where: { userId: req.userId! },
    update: { calories, protein, carbs, fat, ...restFields },
    create: { userId: req.userId!, calories, protein, carbs, fat, ...restFields },
  });
  res.json(target);
});

// Water intake
nutritionRouter.get("/water", async (req: AuthedRequest, res) => {
  const date = dateOnly(String(req.query.date || new Date().toISOString()));
  const entry = await prisma.waterIntake.findFirst({ where: { userId: req.userId!, date } });
  res.json({ ml: entry?.ml ?? 0 });
});

nutritionRouter.post("/water", async (req: AuthedRequest, res) => {
  const { date, deltaMl } = req.body || {};
  if (!date || deltaMl == null) return res.status(400).json({ error: "date and deltaMl required" });
  const day = dateOnly(date);
  const existing = await prisma.waterIntake.findFirst({ where: { userId: req.userId!, date: day } });
  const newMl = Math.max(0, (existing?.ml || 0) + Number(deltaMl));
  const entry = existing
    ? await prisma.waterIntake.update({ where: { id: existing.id }, data: { ml: newMl } })
    : await prisma.waterIntake.create({ data: { userId: req.userId!, date: day, ml: newMl } });
  res.json({ ml: entry.ml });
});
