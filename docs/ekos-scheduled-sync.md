# EKOS morning inventory hand-off

Goal: every morning, **before the 5 AM EKOS POS sync**, move the taproom
inventory that bartenders logged on the tablet into EKOS — automatically,
as a step in your existing scheduled sync program.

There are two independent pieces. You can use either or both.

---

## Piece 1 — the heads-up email (already built)

The app emails a digest of yesterday's inventory activity each morning.
It now fires early (~3–4 AM Central, before the 5 AM sync) so it lands in
your inbox before the hand-off runs.

**To turn it on:** set `RESEND_API_KEY` and `EMAIL_RECIPIENTS` in Vercel
(Settings → Environment Variables), then redeploy. Until then, no email
sends — but the hand-off below still works, because it reads the data
live from the app, not from the email.

---

## Piece 2 — the hand-off script (add this to your scheduled program)

`scripts/ekos-inventory-sync.mjs` pulls the inventory that isn't in EKOS
yet, writes a CSV you can import, and (optionally) marks those entries
transferred so nothing is counted twice.

### What it does, each run

1. `GET /api/inventory?scope=unreconciled` — everything logged on the
   tablet that hasn't been entered into EKOS yet.
2. Writes `ekos-inventory-YYYY-MM-DD.csv` (date, time, event, beer,
   keg size, pack, quantity, note).
3. With `--reconcile`, marks those exact entries transferred so tomorrow's
   run skips them.

If there's nothing new, it writes nothing and exits cleanly.

### Add it to your scheduler

Schedule it to run **before 5 AM** (e.g. 4:30 AM), ahead of the EKOS sync
step. Requires Node 18+ on the machine.

```
node /path/to/scripts/ekos-inventory-sync.mjs --out /path/to/ekos-import.csv --reconcile
```

- Point your EKOS import step at the same `--out` file.
- **Leave off `--reconcile` for the first few runs** so you can eyeball the
  CSV and confirm the import works. Once you trust it, add `--reconcile`
  so entries stop repeating.
- Order in your program: **(1) run this script → (2) import the CSV into
  EKOS → (3) the 5 AM POS sync.**

### No Node on that machine? Curl version

Any scheduler that can run `curl` works. This saves the CSV; do the
reconcile step separately once you trust it.

```sh
# 1. Save the pending inventory as CSV
curl -s "https://bartendersdashboard.vercel.app/api/inventory/export?scope=unreconciled" \
  -o /path/to/ekos-import.csv

# 2. (optional, after a successful import) mark it all transferred.
#    Needs jq to pull the ids:
IDS=$(curl -s "https://bartendersdashboard.vercel.app/api/inventory?scope=unreconciled&limit=500" \
  | jq -c '{ids: [.entries[].id]}')
curl -s -X POST "https://bartendersdashboard.vercel.app/api/inventory/reconcile" \
  -H "Content-Type: application/json" -d "$IDS"
```

---

## Safety notes

- **Idempotent.** The script only pulls *unreconciled* entries and only
  reconciles what it pulled, so re-running (or a missed day) never
  double-counts — the next run catches up.
- **CSV before reconcile.** The CSV is always written first; reconcile only
  happens after, and only with `--reconcile`. If the import fails, don't
  reconcile — the entries stay pending for the next run.
- **Undo.** To un-mark entries (e.g. a bad import got reconciled), the
  reconcile endpoint accepts `{ "ids": [...], "undo": true }`, or use the
  in-app EKOS Report to review.
- **Beer name matching.** The CSV has both a `beer` column (the tablet's
  name) and an `ekos_name` column. Set the EKOS item name per beer in
  **admin → Inventory Catalog** (the "EKOS item name" field) and `ekos_name`
  resolves to it; leave it blank and `ekos_name` just mirrors `beer`. Point
  your EKOS import at the `ekos_name` column so it matches without
  hand-fixing.
