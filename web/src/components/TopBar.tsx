export default function TopBar({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div
      className="sticky top-0 z-30 bg-ink-950/95 backdrop-blur border-b border-ink-800 px-4 py-3 flex items-center justify-between"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
    >
      <h1 className="text-lg font-bold tracking-tight">
        {title} <span className="text-bean-500">.</span>
      </h1>
      {right}
    </div>
  );
}
