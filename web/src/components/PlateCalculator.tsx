import { useState } from "react";
import { calculatePlates, DEFAULT_BAR_LB } from "../lib/plates";

export default function PlateCalculator({ weightLb }: { weightLb: number }) {
  const [open, setOpen] = useState(false);
  const [barLb, setBarLb] = useState(String(DEFAULT_BAR_LB));

  const { plates, remainderLb } = calculatePlates(weightLb || 0, Number(barLb) || 0);

  return (
    <div>
      <button type="button" className="text-white/50 text-xs underline" onClick={() => setOpen((o) => !o)}>
        🧮 Plate calculator
      </button>
      {open && (
        <div className="card mt-2 bg-ink-800">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-white/50">Bar (lbs)</label>
            <input
              className="input w-20 py-1"
              inputMode="decimal"
              value={barLb}
              onChange={(e) => setBarLb(e.target.value)}
            />
          </div>
          {weightLb > 0 ? (
            plates.length > 0 || remainderLb === 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-white/50">Per side:</span>
                {plates.length === 0 && <span className="text-sm">bar only</span>}
                {plates.map((p, i) => (
                  <span key={i} className="bg-bean-500/20 text-bean-300 text-sm font-semibold rounded px-2 py-0.5">
                    {p}
                  </span>
                ))}
                {remainderLb > 0 && (
                  <span className="text-xs text-white/40">(+{remainderLb}lb not achievable with standard plates)</span>
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
