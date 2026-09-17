export default function MacroRing({
  label,
  value,
  target,
  unit = "g",
  color = "#f5348c",
}: {
  label: string;
  value: number;
  target: number;
  unit?: string;
  color?: string;
}) {
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const size = 76;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 absolute inset-0">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#242428" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-sm font-bold">{Math.round(value)}</div>
          <div className="text-[10px] text-white/40">
            /{Math.round(target)}
            {unit}
          </div>
        </div>
      </div>
      <div className="text-xs text-white/60">{label}</div>
    </div>
  );
}
