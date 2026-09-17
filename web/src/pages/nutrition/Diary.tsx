import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TopBar from "../../components/TopBar";
import MacroRing from "../../components/MacroRing";
import { api } from "../../api/client";

interface DiaryEntry {
  id: string;
  meal: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  food: { name: string; servingUnit: string } | null;
  recipe: { name: string } | null;
}

interface DiaryResponse {
  entries: DiaryEntry[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
  target: { calories: number; protein: number; carbs: number; fat: number } | null;
}

const MEALS = ["breakfast", "lunch", "dinner", "snack"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const WATER_TARGET_ML = 2000;
const WATER_STEP_ML = 250;

export default function Diary() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<DiaryResponse | null>(null);
  const [waterMl, setWaterMl] = useState(0);
  const [copying, setCopying] = useState(false);

  function load() {
    api.get<DiaryResponse>(`/nutrition/diary?date=${date}`).then(setData);
    api.get<{ ml: number }>(`/nutrition/water?date=${date}`).then((w) => setWaterMl(w.ml));
  }
  useEffect(load, [date]);

  async function removeEntry(id: string) {
    await api.del(`/nutrition/diary/${id}`);
    load();
  }

  async function adjustWater(deltaMl: number) {
    const result = await api.post<{ ml: number }>("/nutrition/water", { date, deltaMl });
    setWaterMl(result.ml);
  }

  async function copyYesterday() {
    setCopying(true);
    try {
      const from = shiftDate(date, -1);
      const result = await api.post<{ copied: number }>("/nutrition/diary/copy", { fromDate: from, toDate: date });
      if (result.copied === 0) alert("No entries found on the previous day to copy.");
      load();
    } finally {
      setCopying(false);
    }
  }

  const target = data?.target || { calories: 2200, protein: 150, carbs: 220, fat: 70 };
  const totals = data?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };

  return (
    <div>
      <TopBar
        title="Diary"
        right={
          <Link to="/nutrition/trends" className="btn-secondary text-sm px-3 py-1.5">
            Trends
          </Link>
        }
      />
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button className="btn-secondary px-3" onClick={() => setDate((d) => shiftDate(d, -1))}>
            ←
          </button>
          <input type="date" className="input flex-1" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn-secondary px-3" onClick={() => setDate((d) => shiftDate(d, 1))}>
            →
          </button>
        </div>

        <div className="card">
          <div className="flex justify-around">
            <MacroRing label="Cal" value={totals.calories} target={target.calories} unit="" color="#f5348c" />
            <MacroRing label="Protein" value={totals.protein} target={target.protein} color="#2dd4bf" />
            <MacroRing label="Carbs" value={totals.carbs} target={target.carbs} color="#fbbf24" />
            <MacroRing label="Fat" value={totals.fat} target={target.fat} color="#a78bfa" />
          </div>
        </div>

        <div className="card flex items-center justify-between border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent">
          <div>
            <p className="text-sm font-semibold text-cyan-300">💧 Water</p>
            <p className="text-white/40 text-xs">
              {(waterMl / 1000).toFixed(2)}L / {(WATER_TARGET_ML / 1000).toFixed(1)}L
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary px-3 py-1.5" onClick={() => adjustWater(-WATER_STEP_ML)} disabled={waterMl <= 0}>
              −
            </button>
            <button className="btn-teal px-3 py-1.5" onClick={() => adjustWater(WATER_STEP_ML)}>
              +{WATER_STEP_ML}ml
            </button>
          </div>
        </div>

        <button className="btn-secondary w-full" onClick={copyYesterday} disabled={copying}>
          {copying ? "Copying…" : "Copy previous day's diary"}
        </button>

        {MEALS.map((meal) => {
          const entries = data?.entries.filter((e) => e.meal === meal) || [];
          return (
            <div key={meal} className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold capitalize">{meal}</p>
                <Link to={`/nutrition/add?date=${date}&meal=${meal}`} className="text-bean-400 text-sm font-semibold">
                  + Add
                </Link>
              </div>
              {entries.length === 0 && <p className="text-white/30 text-sm">Nothing logged</p>}
              <div className="space-y-1.5">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span>{e.food?.name || e.recipe?.name}</span>
                      <span className="text-white/40 ml-2">{Math.round(e.calories)} kcal</span>
                    </div>
                    <button className="text-white/30" onClick={() => removeEntry(e.id)}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <Link to="/nutrition/recipes" className="btn-secondary w-full text-center block">
          Manage recipes
        </Link>
      </div>
    </div>
  );
}

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
