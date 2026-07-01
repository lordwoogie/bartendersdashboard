// Inventory tracking types shared by the /inventory tablet page, the admin
// catalog manager, and the API routes.

export type KegSize = "1/2" | "1/6";

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
    }
  | {
      id: string;
      type: "case-added";
      timestamp: string;
      beerName: string;
      quantity: number;
      note?: string;
    };

// A beer/can/bottle in the picker catalog. `format` lets us filter the
// dropdown by the action being logged (keg actions show drafts, case action
// shows cans/bottles).
export interface CatalogBeer {
  id: string;
  name: string;
  brewery?: string;
  format: "keg" | "can" | "bottle";
}
