"use client";

import { useEffect, useState } from "react";
import { HOUSE_DOCUMENTS, type ManualLink } from "@/lib/manuals";
import { BackToDashboard } from "@/components/BackToDashboard";

// Short staff-facing guide + links to external manuals (POS, equipment).
// Manuals are managed in /admin → Help Manuals.

const GUIDE = [
  {
    icon: "🛢",
    title: "Inventory — log it when it happens (5 seconds)",
    lines: [
      "Tap a new keg → Inventory → Tap New Keg → pick the beer, pick 1/2 or 1/6.",
      "Keg kicks → Inventory → Keg Blew → same thing.",
      "Move cases/packs to the front fridge → Inventory → Add Cases → beer, pack size, how many.",
      "Beer not in the list? Pick “Other…” and type it. Mis-tapped? Hit Undo next to the entry.",
    ],
  },
  {
    icon: "📖",
    title: "The Book — daily duties",
    lines: [
      "Opens on today. Check tasks off as you do them, including the starred Special Tasks.",
      "It saves as you go — closing the tab or switching pages loses nothing.",
      "When the last box is checked, the day logs automatically. Finish the list.",
    ],
  },
  {
    icon: "🛒",
    title: "Supplies",
    lines: [
      "Out of Coke, Capri Suns, limes? Add it to the To Buy list.",
      "Something the next shift should know (“ice machine leaking”)? Drop it in Shift Notes.",
    ],
  },
  {
    icon: "🏭",
    title: "Production board",
    lines: [
      "Production → the week's canning, cellar, prep, and brew tasks, plus who's in and who's out.",
      "Tap a task to check it off. Needs to Happen and Logs work the same way.",
      "Going to be gone? Availability → Request time off. The head brewer confirms it.",
      "Head brewer: tap Edit and enter the production password to build the week.",
      "For the shop TV, open Production → TV (or /production/tv) and hit Fullscreen. It refreshes itself.",
    ],
  },
  {
    icon: "🍺",
    title: "Customer questions",
    lines: [
      "Beer List and Wine List have descriptions — tap any beer for tasting notes.",
    ],
  },
];

export default function HelpPage() {
  const [manuals, setManuals] = useState<ManualLink[]>([]);

  useEffect(() => {
    fetch("/api/manuals")
      .then((r) => r.json())
      .then((data) => setManuals(data.manuals || []))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-card-border px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <BackToDashboard />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-amber tracking-tight">
              ❓ Help
            </h1>
            <p className="text-sm text-muted mt-0.5">
              How to use the app, plus manuals for our software and equipment.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Usage guide */}
        <section className="bg-card-bg border border-card-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-amber mb-4">
            Using this app
          </h2>
          <div className="space-y-5">
            {GUIDE.map((g) => (
              <div key={g.title}>
                <h3 className="font-medium text-foreground flex items-center gap-2 mb-1.5">
                  <span>{g.icon}</span>
                  {g.title}
                </h3>
                <ul className="space-y-1 pl-7">
                  {g.lines.map((line) => (
                    <li key={line} className="text-sm text-muted list-disc">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-sm text-copper mt-5 pt-4 border-t border-card-border">
            Something broken or annoying? Tell the manager — that&apos;s how it
            gets fixed.
          </p>
        </section>

        {/* Manuals & support links */}
        <section className="bg-card-bg border border-card-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-amber mb-1">
            Manuals &amp; Support
          </h2>
          <p className="text-xs text-muted mb-4">
            Documentation for the software and equipment we use.
          </p>

          {/* Our own PDFs, bundled with the app (see HOUSE_DOCUMENTS). */}
          <p className="text-[10px] uppercase tracking-wider text-copper font-semibold mb-2">
            Our documents
          </p>
          <div className="space-y-2 mb-5">
            {HOUSE_DOCUMENTS.map((d) => (
              <a
                key={d.id}
                href={d.file}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-card-border bg-surface px-4 py-3 hover:border-amber transition-colors"
              >
                <span className="text-sm font-medium text-foreground flex items-center justify-between gap-2">
                  <span className="min-w-0">📄 {d.title}</span>
                  <span className="text-[10px] text-copper border border-copper/40 rounded px-1.5 py-0.5 shrink-0">
                    PDF
                  </span>
                </span>
                {d.note && (
                  <span className="block text-xs text-muted mt-0.5">{d.note}</span>
                )}
              </a>
            ))}
          </div>

          <p className="text-[10px] uppercase tracking-wider text-copper font-semibold mb-2">
            Software &amp; equipment
          </p>
          {manuals.length === 0 ? (
            <p className="text-sm text-muted">No manuals added yet.</p>
          ) : (
            <div className="space-y-2">
              {manuals.map((m) => (
                <a
                  key={m.id}
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-card-border bg-surface px-4 py-3 hover:border-amber transition-colors"
                >
                  <span className="text-sm font-medium text-foreground flex items-center justify-between gap-2">
                    {m.title}
                    <span className="text-copper shrink-0" aria-hidden="true">
                      ↗
                    </span>
                  </span>
                  {m.note && (
                    <span className="block text-xs text-muted mt-0.5">
                      {m.note}
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
