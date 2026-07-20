// Inventory tracking types shared by the /inventory tablet page, the admin
// catalog manager, and the API routes.

export type KegSize = "1/2" | "1/6";

// Cases are now measured simply in cases; the only distinction that matters
// is whether a case is a 12-pack. "4-pack"/"6-pack" are kept so entries
// logged before this change still display correctly.
export type PackSize = "case" | "12-pack" | "4-pack" | "6-pack";

// Human label for a case-added entry, e.g. "3 cases" or "3 cases (12-pack)".
export function caseUnitLabel(quantity: number, packSize?: PackSize): string {
  const noun = quantity === 1 ? "case" : "cases";
  if (!packSize || packSize === "case") return `${quantity} ${noun}`;
  return `${quantity} ${noun} (${packSize})`;
}

export type InventoryEntryType = "keg-tapped" | "keg-blew" | "case-added";

// One row in the activity log. Discriminated by `type` so keg vs case entries
// carry the fields that make sense for them.
export type InventoryEntry =
  | {
      id: string;
      type: "keg-tapped" | "keg-blew";
      timestamp: string; // ISO 8601 (UTC)
      beerName: string;
      size: KegSize;
      note?: string;
      // Set when the manager marks this entry as entered into EKOS.
      reconciledAt?: string;
    }
  | {
      id: string;
      type: "case-added";
      timestamp: string;
      beerName: string;
      quantity: number;
      // Optional for backward compatibility with entries logged before the
      // pack-size field was added; new entries always set it.
      packSize?: PackSize;
      note?: string;
      reconciledAt?: string;
    };

// A durable record of one inventory movement that was entered into EKOS.
// Written when an entry is checked off (reconciled) and kept for a year, so
// the EKOS hand-off has an audit trail independent of the live activity log
// (which is capped and drops its oldest entries). `ekosName` is snapshotted
// at check-off time so the record reflects exactly what was entered.
export interface ReconcileRecord {
  id: string;
  type: InventoryEntryType;
  beerName: string;
  ekosName: string;
  size?: KegSize; // keg entries
  packSize?: PackSize; // case entries
  quantity?: number; // case entries
  note?: string;
  loggedAt: string; // when it physically happened (entry timestamp, UTC)
  enteredAt: string; // when it was entered into EKOS (reconciledAt, UTC)
}

// A beer/can/bottle in the picker catalog. `format` lets us filter the
// dropdown by the action being logged (keg actions show drafts, case action
// shows cans/bottles).
export interface CatalogBeer {
  id: string;
  name: string;
  brewery?: string;
  format: "keg" | "can" | "bottle";
  // Exact item name in EKOS, if it differs from `name`. When set, the EKOS
  // export/sync uses it so the import matches without hand-fixing.
  ekosName?: string;
  // EKOS names 12-packs as a distinct item from a regular case (e.g.
  // "Cowboy Cold Case (Case - 2x12 ...)" vs "Cowboy Cold (Case - 4x6 ...)").
  // Cans/bottles only; used when a case entry is flagged as a 12-pack.
  ekosNameTwelvePack?: string;
}

// Normalize a beer name for matching log entries against the catalog:
// case-insensitive, curly quotes flattened, whitespace collapsed.
export function normalizeBeerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
