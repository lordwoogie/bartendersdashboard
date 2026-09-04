import Image from "next/image";
import Link from "next/link";

// Prominent, tablet-friendly link that goes in the top-left of every
// subpage header. Keep it visually consistent everywhere so bartenders
// don't have to hunt for "how do I get back to the dashboard?"
//
// Carries the Lively lockup so every subpage header is branded: the full
// horizontal lockup on tablets and laptops, just the tree mark on phones
// where the header is tight. `tone` picks the white or green artwork to
// match the bar it sits on.
export function BackToDashboard({ tone = "paper" }: { tone?: "paper" | "green" }) {
  const onGreen = tone === "green";
  return (
    <Link
      href="/"
      aria-label="Back to dashboard"
      className="group inline-flex items-center gap-3 shrink-0"
    >
      <Image
        src={onGreen ? "/brand/lockup-horizontal-long-white.svg" : "/brand/lockup-horizontal-long-green.svg"}
        alt=""
        width={111}
        height={36}
        priority
        unoptimized
        className="hidden sm:block h-9 w-auto"
      />
      <Image
        src={onGreen ? "/brand/tree-white.svg" : "/brand/tree-green.svg"}
        alt=""
        width={28}
        height={32}
        priority
        unoptimized
        className="sm:hidden h-8 w-auto"
      />
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border-2 px-3 py-1.5 text-sm font-bold transition-colors duration-150 ${
          onGreen
            ? "border-paper/70 text-paper group-hover:bg-paper group-hover:text-green group-hover:border-paper"
            : "border-ink text-ink group-hover:bg-ink group-hover:text-paper"
        }`}
      >
        <span aria-hidden="true" className="text-base leading-none">←</span>
        <span>Dashboard</span>
      </span>
    </Link>
  );
}
