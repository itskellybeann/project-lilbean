// `new Date().toISOString().slice(0, 10)` gives *UTC* today, which is wrong for
// "today" in the user's own timezone (e.g. still yesterday-UTC at 6pm Pacific, or
// already tomorrow-UTC in the evening further east) — logging in the evening could
// silently land on the wrong day. This shifts by the local UTC offset first so the
// slice reflects the viewer's actual calendar date.
export function todayLocalISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
