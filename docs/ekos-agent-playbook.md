# EKOS Inventory Transfer — Agent Playbook

Instructions for an AI agent (e.g. Claude in Cowork) that transfers taproom
inventory movements from the Bartender's Dashboard into EKOS.

## Context

Bartenders log inventory events on a tablet at `/inventory`:
- **keg-tapped** — a keg went ON tap (beer name + size: `1/2` or `1/6` bbl)
- **keg-blew** — a keg came OFF (kicked) (beer name + size)
- **case-added** — packaged product moved to the front-of-house fridge
  (beer name + `case` or `12-pack` + quantity)

These need to be reflected in EKOS (goekos.com), the brewery's inventory
system of record. EKOS has no public API, so entries are made through its
web UI.

## The loop

### 1. Fetch pending work (one CSV — everything you need)

```
GET https://bartendersdashboard.vercel.app/api/inventory/export?scope=unreconciled
```

Returns a CSV of every tablet entry not yet in EKOS. Columns:

```
date, time, event, beer, ekos_name, keg_size, pack_size, quantity, note, entered_in_ekos, id
```

This one file has everything: **`ekos_name`** is the exact EKOS item to
adjust, **`quantity`** is how many, and **`id`** is what you reconcile with
in step 3. You do not need any other endpoint.

**If the CSV has only the header row (no data), stop — nothing to do.**
(A previous run already handled everything.)

Example rows:

```
2026-07-14,5:34 PM,cases added,Cowboy Cold,Cowboy Cold Case (Case - 2x12 - 12oz - Can),,12-pack,4,,no,inv-1783...-3rqx
2026-07-17,4:16 PM,keg tapped (ON),Kolsch,Kolsch (Keg - 1/6 bbl),1/6,,1,,no,inv-1784...-a1b2
```

### 2. Enter the movements in EKOS

Open EKOS in the browser (user is normally already signed in). For each
CSV row, find the item named in the **`ekos_name`** column and make the
adjustment:

- **keg tapped (ON) / keg blew (OFF)**: adjust the finished-goods count for
  that keg item by `quantity` (normally 1). A tapped keg means one keg of
  that size left cold-room inventory; a blown keg confirms it is consumed.
- **cases added**: move `quantity` of that packaged item from warehouse/
  cold-room stock to taproom/FOH stock (or however the venue tracks it).

**Match by the `ekos_name` column, not the `beer` column.** `ekos_name` is
pre-resolved to the exact EKOS item — kegs already carry the size suffix
(`… (Keg - 1/6 bbl)`), and cases/12-packs point at the right SKU. Do NOT
re-derive names from the `beer` column or guess suffixes.

If an `ekos_name` has no exact match in EKOS (e.g. a brand-new beer not yet
mapped, or a spelling mismatch), SKIP that row, leave it unreconciled, and
report it to the user at the end — never guess. Fixing the mapping is a
one-field edit in **admin → Inventory Catalog**.

### 3. Mark what you entered as reconciled

Only after the EKOS entries are saved, reconcile exactly the rows you
processed, using their **`id`** values from the CSV:

```
POST https://bartendersdashboard.vercel.app/api/inventory/reconcile
Content-Type: application/json

{ "ids": ["inv-...", "inv-..."] }
```

Response: `{ "success": true, "count": N }`.

- Do NOT reconcile rows you skipped — they should appear again next run.
- Made a mistake? `{ "ids": [...], "undo": true }` un-reconciles.

### 4. Report

Tell the user: how many entries were transferred, per-beer totals, and any
entries skipped (with reasons). The human-readable report lives at
`https://bartendersdashboard.vercel.app/inventory/report`.

## Idempotency & safety

- The unreconciled scope + reconcile stamp make this loop safe to re-run:
  a second run sees only what the first run didn't finish.
- Never delete log entries (`DELETE /api/inventory`) — that is for
  bartender undo only.
- If EKOS is unreachable or login has expired, stop and tell the user;
  don't reconcile anything.
