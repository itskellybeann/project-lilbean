// Per-user accent colors (see User.colorAccent in the schema) so each
// household member gets a distinct identity across shared views like
// Household and the TopBar dot — not just a single hardcoded brand color.
export const ACCENTS = {
  pink: { text: "text-bean-400", dot: "bg-bean-500", border: "border-bean-600", soft: "bg-bean-500/10" },
  teal: { text: "text-teal-400", dot: "bg-teal-400", border: "border-teal-500", soft: "bg-teal-400/10" },
  violet: { text: "text-violet-400", dot: "bg-violet-500", border: "border-violet-600", soft: "bg-violet-500/10" },
  amber: { text: "text-amber-400", dot: "bg-amber-500", border: "border-amber-600", soft: "bg-amber-500/10" },
} as const;

export type AccentName = keyof typeof ACCENTS;

export function accentClasses(name?: string | null) {
  return ACCENTS[(name as AccentName) in ACCENTS ? (name as AccentName) : "pink"];
}
