import { useEffect, useState } from "react";
import TopBar from "../../components/TopBar";
import { api } from "../../api/client";

interface Food {
  id: string;
  name: string;
  servingSize: number;
  servingUnit: string;
}

interface RecipeItem {
  id: string;
  quantity: number;
  food: Food;
}

interface Recipe {
  id: string;
  name: string;
  servings: number;
  items: RecipeItem[];
  macros: { perServing: { calories: number; protein: number; carbs: number; fat: number } };
}

export default function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [name, setName] = useState("");
  const [servings, setServings] = useState("1");
  const [items, setItems] = useState<{ foodId: string; name: string; quantity: string }[]>([]);
  const [foodQuery, setFoodQuery] = useState("");

  function load() {
    api.get<Recipe[]>("/recipes").then(setRecipes);
  }
  useEffect(load, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (foodQuery) api.get<Food[]>(`/foods?q=${encodeURIComponent(foodQuery)}`).then(setFoods);
      else setFoods([]);
    }, 250);
    return () => clearTimeout(handle);
  }, [foodQuery]);

  function addItem(f: Food) {
    setItems((i) => [...i, { foodId: f.id, name: f.name, quantity: String(f.servingSize) }]);
    setFoodQuery("");
    setFoods([]);
  }

  async function saveRecipe() {
    if (!name.trim() || items.length === 0) return;
    await api.post("/recipes", {
      name,
      servings: Number(servings) || 1,
      items: items.map((i) => ({ foodId: i.foodId, quantity: Number(i.quantity) })),
    });
    setName("");
    setServings("1");
    setItems([]);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this recipe?")) return;
    await api.del(`/recipes/${id}`);
    load();
  }

  return (
    <div>
      <TopBar title="Recipes" />
      <div className="p-4 space-y-4">
        <div className="card space-y-2">
          <p className="font-semibold text-sm">New recipe</p>
          <input className="input" placeholder="Recipe name" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <label className="label">Servings</label>
            <input className="input" inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value)} />
          </div>

          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{item.name}</span>
              <input
                className="input w-20"
                inputMode="decimal"
                value={item.quantity}
                onChange={(e) =>
                  setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, quantity: e.target.value } : it)))
                }
              />
              <button className="text-white/40" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}>
                ✕
              </button>
            </div>
          ))}

          <input className="input" placeholder="Search food to add…" value={foodQuery} onChange={(e) => setFoodQuery(e.target.value)} />
          {foods.map((f) => (
            <button key={f.id} className="card w-full text-left text-sm" onClick={() => addItem(f)}>
              {f.name}
            </button>
          ))}

          <button className="btn-primary w-full" onClick={saveRecipe}>
            Save recipe
          </button>
        </div>

        {recipes.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{r.name}</p>
              <button className="text-white/30" onClick={() => remove(r.id)}>
                🗑
              </button>
            </div>
            <p className="text-white/40 text-xs mt-1">
              {Math.round(r.macros.perServing.calories)} kcal / serving · {r.servings} servings
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
