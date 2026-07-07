# EKOS Inventory Transfer — Agent Playbook

Instructions for an AI agent (e.g. Claude in Cowork) that transfers taproom
inventory movements from the Bartender's Dashboard into EKOS.

## Context

Bartenders log inventory events on a tablet at `/inventory`:
- **keg-tapped** — a keg went ON tap (beer name + size: `1/2` or `1/6` bbl)
- **keg-blew** — a keg came OFF (kicked) (beer name + size)
- **case-added** — packaged product moved to the front-of-house fridge
  (beer name + pack size `4-pack`/`6-pack`/`12-pack` + quantity)

These need to be reflected in EKOS (goekos.com), the brewery's inventory
system of record. EKOS has no public API, so entries are made through its
web UI.

## The loop

### 1. Fetch pending work

```
GET https://bartendersdashboard.vercel.app/api/inventory?scope=unreconciled&limit=500
```

Returns `{ "entries": [...] }`, newest first. Each entry has:

```json
{
  "id": "inv-1783119602529-3rqx",
  "type": "case-added",            // or "keg-tapped" / "keg-blew"
  "timestamp": "2026-07-03T23:00:02.529Z",   // UTC; venue is America/Chicago
  "beerName": "Cowboy Cold",
  "quantity": 1,                   // case-added only
  "packSize": "12-pack",           // case-added only
  "size": "1/2",                   // keg entries only (bbl)
  "note": "Moved from cold room to FOH Fridge"
}
```

**If `entries` is empty, stop — nothing to do.** (A previous run already
handled everything.)

There is also a CSV form of the same data if easier to read:
`GET /api/inventory/export?scope=unreconciled`

### 2. Enter the movements in EKOS

Open EKOS in the browser (user is normally already signed in). For each
entry, make the matching inventory adjustment:

- **keg-tapped / keg-blew**: adjust the finished-goods keg count for that
  beer and size. A tapped keg means one keg of that size left the cold room
  inventory; a blown keg confirms it is fully consumed.
- **case-added**: move the stated quantity of that pack size from warehouse
  /cold-room stock to taproom/FOH stock (or however the venue tracks it).

Match beers by name. Names come from the dashboard catalog and may differ
slightly from EKOS item names (e.g. "Grapefruit IPA" vs "Grapefruit IPA
16oz"). If a match is ambiguous or missing, SKIP that entry, leave it
unreconciled, and report it to the user at the end — never guess.

### 3. Mark what you entered as reconciled

Only after the EKOS entries are saved, mark exactly the entries you
processed (by id):

```
POST https://bartendersdashboard.vercel.app/api/inventory/reconcile
Content-Type: application/json

{ "ids": ["inv-...", "inv-..."] }
```

Response: `{ "success": true, "count": N }`.

- Do NOT reconcile entries you skipped — they should appear again next run.
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
