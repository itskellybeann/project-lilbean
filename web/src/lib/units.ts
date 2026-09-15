// Weights are stored in the database as kilograms everywhere (workout sets,
// body weight, goals); the UI displays and accepts pounds. Convert at this
// one boundary rather than changing what's persisted.
const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

// Rounded for display — one decimal place is plenty for a bodyweight or a
// loaded barbell, and avoids ugly floating-point tails from the conversion.
export function formatLb(kg: number): string {
  const lb = kgToLb(kg);
  return (Math.round(lb * 10) / 10).toString();
}

export function roundLb(kg: number): number {
  return Math.round(kgToLb(kg));
}
