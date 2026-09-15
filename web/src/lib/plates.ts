export const DEFAULT_BAR_KG = 20;
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

export interface PlateBreakdown {
  perSide: number;
  plates: number[];
  remainderKg: number;
}

// Greedy plate fill — good enough for standard gym plate sets (no fractional
// plates smaller than 1.25kg assumed available).
export function calculatePlates(
  targetWeightKg: number,
  barKg: number = DEFAULT_BAR_KG,
  availablePlates: number[] = DEFAULT_PLATES_KG
): PlateBreakdown {
  const perSide = (targetWeightKg - barKg) / 2;
  if (perSide <= 0) return { perSide: 0, plates: [], remainderKg: 0 };

  let remaining = perSide;
  const plates: number[] = [];
  for (const plate of [...availablePlates].sort((a, b) => b - a)) {
    while (remaining >= plate - 0.001) {
      plates.push(plate);
      remaining -= plate;
    }
  }
  return { perSide, plates, remainderKg: Math.round(remaining * 100) / 100 };
}
