import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import TopBar from "../../components/TopBar";
import { api } from "../../api/client";

interface TrendPoint {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export default function Trends() {
  const [data, setData] = useState<TrendPoint[]>([]);

  useEffect(() => {
    api.get<TrendPoint[]>("/nutrition/trends?days=14").then(setData);
  }, []);

  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.date + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));

  return (
    <div>
      <TopBar title="Trends" />
      <div className="p-4 space-y-4">
        <div className="card">
          <p className="text-sm font-semibold mb-2">Calories, last 14 days</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <XAxis dataKey="label" stroke="#666" fontSize={10} tickLine={false} />
              <YAxis stroke="#666" fontSize={11} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background: "#1a1a1d", border: "1px solid #333338", borderRadius: 8 }} />
              <Bar dataKey="calories" fill="#f5348c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <p className="text-sm font-semibold mb-2">Macros, last 14 days</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <XAxis dataKey="label" stroke="#666" fontSize={10} tickLine={false} />
              <YAxis stroke="#666" fontSize={11} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background: "#1a1a1d", border: "1px solid #333338", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="protein" stackId="m" fill="#ff85bd" />
              <Bar dataKey="carbs" stackId="m" fill="#ffadd2" />
              <Bar dataKey="fat" stackId="m" fill="#d81b70" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
