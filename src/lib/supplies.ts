// Supplies page: a shared "to-buy" list plus timestamped notes for non-beer
// stuff (Coke, Capri Suns, "ice machine is leaking", etc.).
//
// Both live in one document as a discriminated union so a single API can
// serve them and access rules stay simple.

export type SupplyItem =
  | {
      id: string;
      type: "to-buy";
      text: string;
      createdAt: string;
      doneAt?: string; // ISO — set when someone marks it purchased
    }
  | {
      id: string;
      type: "note";
      text: string;
      createdAt: string;
    };
