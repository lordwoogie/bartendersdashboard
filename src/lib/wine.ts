// Wine list entries — read-only reference info for bartenders when a customer
// asks what a wine is like. Managed in /admin, displayed at /wines.

export type WineCategory =
  | "red"
  | "white"
  | "rose"
  | "sparkling"
  | "orange"
  | "dessert";

export interface Wine {
  id: string;
  name: string;
  category: WineCategory;
  producer?: string;
  varietal?: string;   // e.g. "Pinot Noir"
  region?: string;     // e.g. "Willamette Valley, OR"
  vintage?: string;    // year as string so "NV" (non-vintage) is valid
  abv?: number;
  glassPrice?: number;
  bottlePrice?: number;
  notes?: string;
}
