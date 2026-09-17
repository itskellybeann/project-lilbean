import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const recipesRouter = Router();
recipesRouter.use(requireAuth);

function macrosForRecipe(recipe: { items: { quantity: number; food: any }[]; servings: number }) {
  const totals = recipe.items.reduce(
    (acc, item) => {
      const factor = item.quantity / item.food.servingSize;
      acc.calories += item.food.calories * factor;
      acc.protein += item.food.protein * factor;
      acc.carbs += item.food.carbs * factor;
      acc.fat += item.food.fat * factor;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const servings = recipe.servings || 1;
  return {
    total: totals,
    perServing: {
      calories: totals.calories / servings,
      protein: totals.protein / servings,
      carbs: totals.carbs / servings,
      fat: totals.fat / servings,
    },
  };
}

recipesRouter.get("/", async (req: AuthedRequest, res) => {
  const recipes = await prisma.recipe.findMany({
    where: { userId: req.userId! },
    include: { items: { include: { food: true } } },
    orderBy: { name: "asc" },
  });
  res.json(recipes.map((r) => ({ ...r, macros: macrosForRecipe(r) })));
});

recipesRouter.post("/", async (req: AuthedRequest, res) => {
  const { name, servings, items } = req.body || {};
  if (!name || !items?.length) return res.status(400).json({ error: "name and items required" });
  const recipe = await prisma.recipe.create({
    data: {
      userId: req.userId!,
      name,
      servings: servings ?? 1,
      items: { create: items.map((i: any) => ({ foodId: i.foodId, quantity: i.quantity })) },
    },
    include: { items: { include: { food: true } } },
  });
  res.status(201).json({ ...recipe, macros: macrosForRecipe(recipe) });
});

recipesRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const recipe = await prisma.recipe.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!recipe) return res.status(404).json({ error: "Not found" });
  await prisma.recipe.delete({ where: { id: recipe.id } });
  res.json({ ok: true });
});

export { macrosForRecipe };
