import Link from "next/link";

// Prominent, tablet-friendly link that goes in the top-left of every
// subpage header. Keep it visually consistent everywhere so bartenders
// don't have to hunt for "how do I get back to the dashboard?"
export function BackToDashboard() {
  return (
    <Link
      href="/"
      aria-label="Back to dashboard"
      className="inline-flex items-center gap-1.5 rounded-lg border border-amber/50 bg-amber/10 hover:bg-amber hover:text-background text-amber px-3 py-2 text-sm font-medium transition-colors shrink-0"
    >
      <span aria-hidden="true" className="text-base leading-none">←</span>
      <span>Dashboard</span>
    </Link>
  );
}
