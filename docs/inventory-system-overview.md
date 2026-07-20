# Inventory System Overview — Dashboard ↔ EKOS

A hand-off guide for the scheduler/agent that moves taproom inventory from
the **Bartender's Dashboard** into **EKOS**. It explains what the system
captures, how the two systems communicate, and the exact contract to build
against.

Base URL for everything below: `https://bartendersdashboard.vercel.app`

---

## 1. The big picture

```
  ┌─────────────────┐        ┌──────────────────────┐        ┌────────────┐
  │  Tablet at the   │  log   │  Bartender's         │  pull  │  Scheduler │
  │  taproom          ├───────▶│  Dashboard           ├───────▶│  / agent   │
  │  (/inventory)     │ events │  (source of truth     │  CSV   │  (Cowork)  │
  └─────────────────┘        │  for what moved)      │◀───────┤            │
                              └──────────────────────┘reconcile└─────┬──────┘
                                                                     │ enter
                                                                     ▼
                                                              ┌────────────┐
                                                              │    EKOS     │
                                                              │ (system of  │
                                                              │  record)    │
                                                              └────────────┘
```

- **Bartenders** log physical inventory moves on a tablet as they happen.
- The **Dashboard** stores each move as an immutable log entry and exposes
  it over a small HTTP API.
- The **scheduler** (here, Claude Cowork) pulls the moves that aren't in
  EKOS yet, enters them into EKOS, then tells the Dashboard "these are
  done" so they never get entered twice.
- **EKOS** has no public write API, so entries are made through its web UI.
  The Dashboard's job is to hand the scheduler a precise, EKOS-ready list.

The Dashboard is **not** a stock-count system. It records *events*
("this keg went on", "4 cases came in"), not on-hand totals. EKOS remains
the system of record for quantities.

---

## 2. What gets logged (the data model)

Three event types. Every entry has an `id`, a UTC `timestamp` (venue
timezone is America/Chicago), a `beerName`, and an optional `note`.

| Event type    | Meaning                       | Extra fields                         |
| ------------- | ----------------------------- | ------------------------------------ |
| `keg-tapped`  | A keg went **ON** tap         | `size`: `"1/2"` or `"1/6"` (bbl)      |
| `keg-blew`    | A keg came **OFF** (kicked)   | `size`: `"1/2"` or `"1/6"` (bbl)      |
| `case-added`  | Packaged product moved to FOH | `packSize`: `"case"` or `"12-pack"`; `quantity` (int) |

A keg entry is always **one keg** of the stated size. A case entry is
`quantity` units of the stated pack.

---

## 3. How the two systems communicate (the API contract)

The scheduler only needs **three** endpoints: pull, reconcile, and
(optionally) the name map. All are open — no auth token required.

### 3a. Pull the work — CSV (recommended)

```
GET /api/inventory/export?scope=unreconciled
```

Returns a CSV of every entry not yet in EKOS. **This one file has
everything the scheduler needs.** Columns:

| Column            | Use                                                        |
| ----------------- | ---------------------------------------------------------- |
| `date`, `time`    | When it happened (venue local)                             |
| `event`           | `keg tapped (ON)` / `keg blew (OFF)` / `cases added`       |
| `beer`            | The tablet's beer name (human reference only)              |
| **`ekos_name`**   | **The exact EKOS item to adjust — match on this**          |
| `keg_size`        | `1/2` / `1/6` for kegs, blank for cases                    |
| `pack_size`       | `case` / `12-pack` for cases, blank for kegs               |
| **`quantity`**    | **How many to adjust** (kegs = 1)                          |
| `note`            | Optional free-text from the bartender                      |
| `entered_in_ekos` | `no` (it's the unreconciled feed) — informational          |
| **`id`**          | **Pass this back to reconcile** (step 3b)                  |

Optional filters: `&from=YYYY-MM-DD&to=YYYY-MM-DD` (inclusive, venue
calendar days). Drop `scope=unreconciled` to get the full history.

> **Match on `ekos_name`, never `beer`.** `ekos_name` is pre-resolved to
> the exact EKOS item — kegs already carry the size suffix
> (`… (Keg - 1/6 bbl)`), and cases/12-packs point at the correct SKU. The
> `beer` column is just for human sanity-checking.

**Empty feed = header row only. If there's no data, there's nothing to do.**

There's also a JSON form of the same feed if a program prefers structured
data — but note it does **not** include `ekos_name`, so the CSV is
preferred for the hand-off:

```
GET /api/inventory?scope=unreconciled&limit=500
→ { "entries": [ { "id", "type", "timestamp", "beerName",
                   "size" | ("packSize","quantity"), "note", "reconciledAt" }, ... ] }
```

### 3b. Reconcile — "these are now in EKOS"

**Only after** the EKOS entries are saved, stamp exactly the rows you
entered, by their `id`:

```
POST /api/inventory/reconcile
Content-Type: application/json

{ "ids": ["inv-...", "inv-..."] }
→ { "success": true, "count": 2 }
```

Reconciled entries drop out of the `unreconciled` feed, so the next pull
won't show them again. To undo (e.g. a bad import): send the same body with
`"undo": true`.

### 3c. (Reference) The name map

The `ekos_name` values come from a per-beer mapping managed in
**admin → Inventory Catalog**. You normally don't need to read it directly
— it's already applied in the CSV — but it's available:

```
GET /api/inventory/catalog
→ [ { "name", "format", "ekosName"?, "ekosNameTwelvePack"? }, ... ]
```

If a beer's `ekos_name` doesn't match an EKOS item (new beer, spelling
drift), the fix is a one-field edit on that beer in the catalog — no code
change.

---

## 4. The reconcile lifecycle (why nothing double-counts)

```
  logged on tablet ──▶ UNRECONCILED ──▶ scheduler enters in EKOS ──▶ reconcile stamp ──▶ done
                         ▲   (in the feed)                              (drops from feed)
                         └── stays here until entered & stamped
```

This is the single most important idea for the integration:

- The scheduler always pulls `scope=unreconciled` — **only work that isn't
  in EKOS yet.**
- It reconciles **only the ids it actually entered.**
- Therefore the loop is **idempotent and self-healing**: a re-run, a missed
  morning, or a crash mid-batch never double-counts — whatever wasn't
  stamped simply shows up on the next pull.

**Rule:** never reconcile something you didn't enter, and never enter
something already reconciled. Skip anything ambiguous (report it) and leave
it unreconciled for a human to resolve.

---

## 5. Timing

EKOS runs its own POS sync at **5 AM**. The hand-off should run **before**
that (e.g. ~4:30 AM) so the day's moves are in EKOS when it syncs. The
Dashboard also emails a digest of the prior day's activity in the early
morning as a heads-up; the hand-off itself reads live data and doesn't
depend on the email.

Recommended order in the scheduler:
**(1) pull the CSV → (2) enter into EKOS → (3) reconcile → then the 5 AM sync.**

---

## 6. Quick reference

| Action                        | Call                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| Pull pending moves (CSV)      | `GET /api/inventory/export?scope=unreconciled`                  |
| Pull pending moves (JSON)     | `GET /api/inventory?scope=unreconciled&limit=500`               |
| Mark entered                  | `POST /api/inventory/reconcile` `{ "ids": [...] }`              |
| Undo a reconcile              | `POST /api/inventory/reconcile` `{ "ids": [...], "undo": true }`|
| Read the EKOS name map        | `GET /api/inventory/catalog`                                    |
| Human report page             | `GET /inventory/report`                                         |

Do **not** call `POST /api/inventory` (that's the tablet logging moves) or
`DELETE /api/inventory` (bartender undo) from the scheduler.

The step-by-step agent loop lives in
[`ekos-agent-playbook.md`](./ekos-agent-playbook.md).
