import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Today", icon: "🏠" },
  { to: "/workouts", label: "Lift", icon: "🏋️" },
  { to: "/nutrition", label: "Eat", icon: "🧁" },
  { to: "/body", label: "Body", icon: "📈" },
  { to: "/settings", label: "You", icon: "⚙️" },
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
            `flex flex-col items-center gap-0.5 py-2.5 px-3 flex-1 text-xs font-medium ${
              isActive ? "text-bean-400" : "text-white/50"
            }`
          }
        >
          <span className="text-lg leading-none">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
