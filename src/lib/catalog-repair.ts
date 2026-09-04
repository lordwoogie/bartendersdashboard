// Self-repair for EKOS-mapping problems in the beer catalog.
//
// The EKOS name resolver keys on a row's display name, so two rows sharing a
// name (e.g. a 12oz-case and a 16oz-case "Mexican Lager") silently collide:
// the later row wins every export and the other SKU becomes unreachable, and
// the tablet picker shows two identical buttons. When the colliding rows
// carry EKOS SKUs that reveal their can size, they are renamed apart
// ("Mexican Lager 12oz" / "Mexican Lager 16oz") so both SKUs are reachable
// and the buttons are distinguishable. Rows that can't be disambiguated
// safely are left alone and surfaced by duplicateCatalogNames (/api/health).

import type { CatalogBeer } from "@/lib/inventory";
import { normalizeBeerName } from "@/lib/inventory";

// "Blonde Ale (Case - 6x4 - 16oz - Can)" -> "16oz"
export function sizeTokenFromEkosName(ekosName: string | undefined): string | null {
  const m = ekosName?.match(/\b(\d{1,2}oz)\b/i);
  return m ? m[1].toLowerCase() : null;
}

export function repairCatalog(catalog: CatalogBeer[]): {
  catalog: CatalogBeer[];
  changed: boolean;
} {
  const groups = new Map<string, CatalogBeer[]>();
  const allNames = new Set<string>();
  for (const b of catalog) {
    const key = `${b.format}|${normalizeBeerName(b.name)}`;
    const g = groups.get(key);
    if (g) g.push(b);
    else groups.set(key, [b]);
    allNames.add(normalizeBeerName(b.name));
  }

  const renames = new Map<string, string>(); // row id -> new display name
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    // Kegs don't carry a per-size SKU in the row (the size comes from the
    // entry), so there's nothing to disambiguate by — leave for health.
    if (rows[0].format === "keg") continue;
    const tokens = rows.map((r) => sizeTokenFromEkosName(r.ekosName));
    if (tokens.some((t) => !t)) continue;
    if (new Set(tokens).size !== rows.length) continue;
    // Don't rename onto a name some other row already uses.
    if (
      rows.some((r, i) =>
        allNames.has(normalizeBeerName(`${r.name} ${tokens[i]}`))
      )
    ) {
      continue;
    }
    rows.forEach((r, i) => renames.set(r.id, `${r.name} ${tokens[i]}`));
  }

  if (renames.size === 0) return { catalog, changed: false };
  return {
    catalog: catalog.map((b) =>
      renames.has(b.id) ? { ...b, name: renames.get(b.id)! } : b
    ),
    changed: true,
  };
}

// Names still ambiguous after repair: same display name and format on more
// than one row. These make exports pick a row arbitrarily.
export function duplicateCatalogNames(catalog: CatalogBeer[]): string[] {
  const seen = new Map<string, string>(); // format|normalized -> display name
  const dupes = new Set<string>();
  for (const b of catalog) {
    const key = `${b.format}|${normalizeBeerName(b.name)}`;
    if (seen.has(key)) dupes.add(seen.get(key)!);
    else seen.set(key, b.name);
  }
  return [...dupes].sort();
}
