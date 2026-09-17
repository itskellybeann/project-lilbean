import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TopBar from "../../components/TopBar";
import BarcodeScanner from "../../components/BarcodeScanner";
import { api } from "../../api/client";

interface FoodEstimate {
  name: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: "low" | "medium" | "high";
  notes: string;
}

interface Food {
  id: string;
  name: string;
  brand: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function FoodRow({
  food,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: {
  food: Food;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="card flex items-center gap-2">
      <button className="flex-1 text-left" onClick={onSelect}>
        <p className="font-medium">{food.name}</p>
        <p className="text-white/40 text-xs">
          {Math.round(food.calories)} kcal / {food.servingSize}
          {food.servingUnit}
          {food.brand ? ` · ${food.brand}` : ""}
        </p>
      </button>
      <button
        className={isFavorite ? "text-bean-400 text-lg" : "text-white/20 text-lg"}
        onClick={onToggleFavorite}
        aria-label="Toggle favorite"
      >
        {isFavorite ? "★" : "☆"}
      </button>
    </div>
  );
}

export default function AddFood() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const date = params.get("date") || new Date().toISOString().slice(0, 10);
  const meal = params.get("meal") || "snack";

  const [q, setQ] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [recent, setRecent] = useState<Food[]>([]);
  const [favorites, setFavorites] = useState<Food[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    servingSize: "100",
    servingUnit: "g",
  });
  const [photoNote, setPhotoNote] = useState<{ confidence: string; notes: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  function loadQuickLists() {
    api.get<Food[]>("/foods/recent").then(setRecent);
    api.get<Food[]>("/foods/favorites").then(setFavorites);
  }
  useEffect(loadQuickLists, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      api.get<Food[]>(`/foods?q=${encodeURIComponent(q)}`).then(setResults);
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  const favoriteIds = new Set(favorites.map((f) => f.id));

  async function toggleFavorite(food: Food) {
    if (favoriteIds.has(food.id)) {
      await api.del(`/foods/favorites/${food.id}`);
    } else {
      await api.post("/foods/favorites", { foodId: food.id });
    }
    loadQuickLists();
  }

  async function handleBarcode(code: string) {
    setScanning(false);
    try {
      const food = await api.get<Food>(`/foods/barcode/${code}`);
      setSelected(food);
    } catch {
      alert("Product not found. You can add it manually below.");
      setShowCustom(true);
    }
  }

  async function logSelected() {
    if (!selected) return;
    await api.post("/nutrition/diary", {
      date,
      meal,
      foodId: selected.id,
      quantity: Number(quantity),
    });
    navigate("/nutrition");
  }

  async function saveCustomAndLog() {
    if (!custom.name || !custom.calories) return;
    const servingSize = Number(custom.servingSize || 100);
    const food = await api.post<Food>("/foods", {
      name: custom.name,
      calories: Number(custom.calories),
      protein: Number(custom.protein || 0),
      carbs: Number(custom.carbs || 0),
      fat: Number(custom.fat || 0),
      servingSize,
      servingUnit: custom.servingUnit || "g",
    });
    await api.post("/nutrition/diary", { date, meal, foodId: food.id, quantity: servingSize });
    navigate("/nutrition");
  }

  async function analyzePhoto() {
    const file = photoRef.current?.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setAnalyzing(true);
    setPhotoNote(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      const estimate = await api.post<FoodEstimate>("/foods/analyze-photo", form);
      setCustom({
        name: estimate.name,
        calories: String(Math.round(estimate.calories)),
        protein: String(Math.round(estimate.protein)),
        carbs: String(Math.round(estimate.carbs)),
        fat: String(Math.round(estimate.fat)),
        servingSize: String(estimate.servingSize),
        servingUnit: estimate.servingUnit,
      });
      setPhotoNote({ confidence: estimate.confidence, notes: estimate.notes });
      setShowCustom(true);
    } catch (err: any) {
      alert(err?.message || "Couldn't analyze that photo");
      setPhotoPreview(null);
    } finally {
      setAnalyzing(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  }

  if (scanning) {
    return <BarcodeScanner onDetected={handleBarcode} onClose={() => setScanning(false)} />;
  }

  if (selected) {
    const factor = Number(quantity || 0) / selected.servingSize;
    return (
      <div>
        <TopBar title={selected.name} />
        <div className="p-4 space-y-4">
          <div className="card">
            <label className="label">Amount ({selected.servingUnit})</label>
            <input className="input" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <div className="grid grid-cols-4 gap-2 mt-3 text-center">
              <div>
                <p className="font-bold">{Math.round(selected.calories * factor)}</p>
                <p className="text-[10px] text-white/40">kcal</p>
              </div>
              <div>
                <p className="font-bold">{Math.round(selected.protein * factor)}g</p>
                <p className="text-[10px] text-white/40">protein</p>
              </div>
              <div>
                <p className="font-bold">{Math.round(selected.carbs * factor)}g</p>
                <p className="text-[10px] text-white/40">carbs</p>
              </div>
              <div>
                <p className="font-bold">{Math.round(selected.fat * factor)}g</p>
                <p className="text-[10px] text-white/40">fat</p>
              </div>
            </div>
          </div>
          <button className="btn-primary w-full" onClick={logSelected}>
            Add to {meal}
          </button>
          <button className="btn-secondary w-full" onClick={() => setSelected(null)}>
            Back to search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={`Add to ${meal}`} />
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Search foods…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-secondary px-4" onClick={() => setScanning(true)} aria-label="Scan barcode">
            📷
          </button>
        </div>

        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={analyzePhoto}
        />
        <button
          className="relative w-full overflow-hidden rounded-2xl p-4 flex items-center gap-3 text-left bg-gradient-to-br from-bean-500 via-bean-600 to-purple-700 shadow-lg shadow-bean-900/30 active:scale-[0.99] transition-transform disabled:opacity-70"
          disabled={analyzing}
          onClick={() => photoRef.current?.click()}
        >
          <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full bg-white/10 blur-md" />
          <div className="absolute -right-2 bottom-0 w-16 h-16 rounded-full bg-white/10" />
          <div className="relative flex items-center justify-center w-11 h-11 rounded-full bg-white/15 text-2xl shrink-0">
            {analyzing ? (
              <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              "📸"
            )}
          </div>
          <div className="relative flex-1">
            <p className="font-semibold text-white text-sm">
              {analyzing ? "Analyzing your photo…" : "Snap a photo, get instant macros"}
            </p>
            <p className="text-white/70 text-xs mt-0.5">
              {analyzing ? "Claude is estimating calories and macros" : "AI-powered calorie & macro estimate"}
            </p>
          </div>
          {!analyzing && <span className="relative text-white/50 text-lg">›</span>}
        </button>

        {q.trim() ? (
          <div className="space-y-2">
            {results.map((f) => (
              <FoodRow
                key={f.id}
                food={f}
                isFavorite={favoriteIds.has(f.id)}
                onSelect={() => setSelected(f)}
                onToggleFavorite={() => toggleFavorite(f)}
              />
            ))}
            {results.length === 0 && <p className="text-white/30 text-sm text-center">No matches.</p>}
          </div>
        ) : (
          <>
            {favorites.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-white/40 mb-2">Favorites</p>
                <div className="space-y-2">
                  {favorites.map((f) => (
                    <FoodRow key={f.id} food={f} isFavorite onSelect={() => setSelected(f)} onToggleFavorite={() => toggleFavorite(f)} />
                  ))}
                </div>
              </div>
            )}
            {recent.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-white/40 mb-2 mt-3">Recent</p>
                <div className="space-y-2">
                  {recent.map((f) => (
                    <FoodRow
                      key={f.id}
                      food={f}
                      isFavorite={favoriteIds.has(f.id)}
                      onSelect={() => setSelected(f)}
                      onToggleFavorite={() => toggleFavorite(f)}
                    />
                  ))}
                </div>
              </div>
            )}
            {favorites.length === 0 && recent.length === 0 && (
              <p className="text-white/30 text-sm text-center">Search for a food, or scan a barcode.</p>
            )}
          </>
        )}

        {!showCustom ? (
          <button className="btn-secondary w-full" onClick={() => setShowCustom(true)}>
            + Create custom food
          </button>
        ) : (
          <div className="card space-y-2">
            <p className="font-semibold text-sm">Custom food</p>
            {photoNote && (
              <div className="flex gap-3 rounded-xl border border-bean-500/30 bg-gradient-to-br from-bean-500/10 to-purple-700/10 p-3">
                {photoPreview && (
                  <img src={photoPreview} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-white/10" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm">✨</span>
                    <span className="text-xs font-semibold text-bean-300">AI estimate</span>
                    <span
                      className={
                        "text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full " +
                        (photoNote.confidence === "high"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : photoNote.confidence === "medium"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-white/10 text-white/50")
                      }
                    >
                      {photoNote.confidence} confidence
                    </span>
                  </div>
                  <p className="text-xs text-white/60 mt-1">{photoNote.notes} Double-check before saving.</p>
                </div>
              </div>
            )}
            <input className="input" placeholder="Name" value={custom.name} onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                placeholder="Serving size"
                inputMode="decimal"
                value={custom.servingSize}
                onChange={(e) => setCustom((c) => ({ ...c, servingSize: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Unit (g, cup, plate…)"
                value={custom.servingUnit}
                onChange={(e) => setCustom((c) => ({ ...c, servingUnit: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <input className="input" placeholder="kcal" inputMode="decimal" value={custom.calories} onChange={(e) => setCustom((c) => ({ ...c, calories: e.target.value }))} />
              <input className="input" placeholder="protein" inputMode="decimal" value={custom.protein} onChange={(e) => setCustom((c) => ({ ...c, protein: e.target.value }))} />
              <input className="input" placeholder="carbs" inputMode="decimal" value={custom.carbs} onChange={(e) => setCustom((c) => ({ ...c, carbs: e.target.value }))} />
              <input className="input" placeholder="fat" inputMode="decimal" value={custom.fat} onChange={(e) => setCustom((c) => ({ ...c, fat: e.target.value }))} />
            </div>
            <p className="text-[10px] text-white/40">These values are for the whole serving size above, not per-100g.</p>
            <button className="btn-primary w-full" onClick={saveCustomAndLog}>
              Save &amp; add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
