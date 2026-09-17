import { NavLink } from "react-router-dom";

// Each tab gets its own accent so the nav reads as more than one flat color —
// Eat/Body deliberately pick up the app's teal/violet secondary accents.
const items = [
  { to: "/", label: "Today", icon: "🏠", text: "text-bean-400", pill: "bg-bean-500/15" },
  { to: "/workouts", label: "Lift", icon: "🏋️", text: "text-bean-400", pill: "bg-bean-500/15" },
  { to: "/nutrition", label: "Eat", icon: "🧁", text: "text-teal-400", pill: "bg-teal-400/15" },
  { to: "/body", label: "Body", icon: "📈", text: "text-violet-400", pill: "bg-violet-500/15" },
  { to: "/settings", label: "You", icon: "⚙️", text: "text-amber-400", pill: "bg-amber-500/15" },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-ink-900/95 backdrop-blur border-t border-ink-700 flex justify-around"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-2 px-3 flex-1 text-xs font-medium ${
              isActive ? item.text : "text-white/50"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`text-lg leading-none w-9 h-7 flex items-center justify-center rounded-full transition-colors ${
                  isActive ? item.pill : ""
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
