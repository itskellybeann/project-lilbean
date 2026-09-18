import fetch from "node-fetch";

export interface OFFProduct {
  barcode: string;
  name: string;
  brand: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
}

// OpenFoodFacts always keys per-100-unit nutrients as "..._100g" even for liquids —
// that suffix is just their convention, not a claim about the actual unit. The real
// unit lives in the product's own labeled quantity/serving size (e.g. "240 ml", "1.5 L"),
// so sniff that for a volume unit rather than hardcoding "g" for everything.
function detectServingUnit(p: any): string {
  const text = `${p.quantity || ""} ${p.serving_size || ""}`;
  return /\d\s*(ml|cl|dl|l)\b/i.test(text) ? "ml" : "g";
}

// OpenFoodFacts is free/open and needs no API key. We normalize to per-100g/ml values.
export async function lookupBarcode(barcode: string): Promise<OFFProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const resp = await fetch(url, { headers: { "User-Agent": "LilBeanFitnessApp/1.0" } });
  if (!resp.ok) return null;
  const data: any = await resp.json();
  if (!data || data.status !== 1 || !data.product) return null;

  const p = data.product;
  const n = p.nutriments || {};
  return {
    barcode,
    name: p.product_name || p.generic_name || "Unknown product",
    brand: p.brands || null,
    servingSize: 100,
    servingUnit: detectServingUnit(p),
    calories: Number(n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0) || 0,
    protein: Number(n["proteins_100g"] ?? 0) || 0,
    carbs: Number(n["carbohydrates_100g"] ?? 0) || 0,
    fat: Number(n["fat_100g"] ?? 0) || 0,
    fiber: n["fiber_100g"] != null ? Number(n["fiber_100g"]) : null,
    sugar: n["sugars_100g"] != null ? Number(n["sugars_100g"]) : null,
    sodium: n["sodium_100g"] != null ? Number(n["sodium_100g"]) : null,
  };
}
