export const DEFAULT_BAR_LB = 45;
export const DEFAULT_PLATES_LB = [45, 35, 25, 10, 5, 2.5];

export interface PlateBreakdown {
  perSide: number;
  plates: number[];
  remainderLb: number;
}

// Greedy plate fill — good enough for standard gym plate sets (no fractional
// plates smaller than 2.5lb assumed available). Operates purely in whatever
// display unit is passed in (pounds); it never touches stored kg values.
export function calculatePlates(
  targetWeightLb: number,
  barLb: number = DEFAULT_BAR_LB,
  availablePlates: number[] = DEFAULT_PLATES_LB
): PlateBreakdown {
  const perSide = (targetWeightLb - barLb) / 2;
  if (perSide <= 0) return { perSide: 0, plates: [], remainderLb: 0 };

  let remaining = perSide;
  const plates: number[] = [];
  for (const plate of [...availablePlates].sort((a, b) => b - a)) {
    while (remaining >= plate - 0.01) {
      plates.push(plate);
      remaining -= plate;
    }
  }
  return { perSide, plates, remainderLb: Math.round(remaining * 100) / 100 };
}
