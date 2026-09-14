import { useEffect, useRef, useState } from "react";
import TopBar from "../../components/TopBar";
import { api } from "../../api/client";

interface Photo {
  id: string;
  date: string;
  filePath: string;
  notes: string | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ProgressPhotos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  function load() {
    api.get<Photo[]>("/body/photos").then(setPhotos);
  }
  useEffect(load, []);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("photo", file);
    form.append("date", date);
    form.append("notes", notes);
    try {
      await api.post("/body/photos", form);
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
      load();
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this photo?")) return;
    await api.del(`/body/photos/${id}`);
    load();
  }

  return (
    <div>
      <TopBar title="Progress photos" />
      <div className="p-4 space-y-4">
        <div className="card space-y-2">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="input" />
          <input className="input" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn-primary w-full" onClick={upload} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload photo"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="card p-2">
              <img src={p.filePath} alt={p.date} className="rounded-lg w-full aspect-[3/4] object-cover" />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-white/50">{new Date(p.date).toLocaleDateString()}</span>
                <button className="text-white/30 text-xs" onClick={() => remove(p.id)}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
        {photos.length === 0 && <p className="text-white/30 text-sm text-center">No photos yet.</p>}
      </div>
    </div>
  );
}
