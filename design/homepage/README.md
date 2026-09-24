# Lively Beerworks public site (livelybeerworks.com)

The public website is a plain static site that lives in `site/` at the root
of this repo. It is deployed as its own Vercel project (Root Directory
`site`, framework "Other", no build command), separate from the bartender
dashboard, which is the Next.js app in the rest of the repo.

- `site/index.html` — the homepage exported from the Claude Design handoff,
  fully self-contained (~1.6 MB; fonts, logos, photos and JS inlined).
- `site/map.html` — the taproom map, loaded by the homepage in an iframe.
- `site/assets/logos/*.svg`, `site/assets/fonts/Platform-Bold.otf` — files
  the homepage and map load by relative path, so they must stay beside them.
- `site/vercel.json` — clean URLs (`/map` and `/map.html` both work).
- `design/homepage/Homepage.dc.html` — the editable design source. Edit
  there, re-export `index.html`, and replace `site/index.html`. Do not
  hand-edit the exported bundle.
- `design/homepage/HANDOFF.md` — the original handoff notes (deployment
  checklist, known gaps such as unlaunched Visit / Find Beer pages).

## Adding a page

Export the page from the design tool and drop it into `site/` (for example
`site/events.html`, reachable as `/events`). Put any files it loads by
relative path under `site/assets/`. Push to `main` and Vercel redeploys.

## Logos added outside the handoff

Two logos the exported bundle references were not in the handoff's
`deploy/assets` folder, so they were added from the dashboard's brand files:
`site/assets/logos/lockup_horizontal_long_white.svg` (nav wordmark, copy of
`public/brand/lockup-horizontal-long-white.svg`) and
`site/assets/logos/tree_purple.svg` (beer-card mark, the tree recolored to
brand purple `#2E3080`).
