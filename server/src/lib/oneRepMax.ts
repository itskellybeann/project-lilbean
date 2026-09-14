// Epley formula: widely used, simple, good enough for tracking trend over time.
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}
