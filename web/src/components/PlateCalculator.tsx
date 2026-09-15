import { useState } from "react";
import { calculatePlates, DEFAULT_BAR_KG } from "../lib/plates";

export default function PlateCalculator({ weightKg }: { weightKg: number }) {
  const [open, setOpen] = useState(false);
  const [barKg, setBarKg] = useState(String(DEFAULT_BAR_KG));

  const { plates, remainderKg } = calculatePlates(weightKg || 0, Number(barKg) || 0);

  return (
    <div>
      <button type="button" className="text-white/50 text-xs underline" onClick={() => setOpen((o) => !o)}>
        🧮 Plate calculator
      </button>
      {open && (
        <div className="card mt-2 bg-ink-800">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-white/50">Bar (kg)</label>
            <input
              className="input w-20 py-1"
              inputMode="decimal"
              value={barKg}
              onChange={(e) => setBarKg(e.target.value)}
            />
          </div>
          {weightKg > 0 ? (
            plates.length > 0 || remainderKg === 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-white/50">Per side:</span>
                {plates.length === 0 && <span className="text-sm">bar only</span>}
                {plates.map((p, i) => (
                  <span key={i} className="bg-bean-500/20 text-bean-300 text-sm font-semibold rounded px-2 py-0.5">
                    {p}
                  </span>
                ))}
                {remainderKg > 0 && (
                  <span className="text-xs text-white/40">(+{remainderKg}kg not achievable with standard plates)</span>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/40">Target weight is less than the bar alone.</p>
            )
          ) : (
            <p className="text-xs text-white/40">Enter a weight above to calculate.</p>
          )}
        </div>
      )}
    </div>
  );
}
