# Lively Beerworks homepage (public site)

The public homepage served at `/` is a static bundle exported from the
Claude Design handoff, not a React page:

- `public/index.html` — the homepage, fully self-contained (~1.6 MB; fonts,
  logos, photos and JS are inlined). Served at `/` via the `beforeFiles`
  rewrite in `next.config.ts`.
- `public/map.html` — the taproom map, loaded by the homepage in an iframe.
- `public/assets/logos/tree_white.svg`, `public/assets/fonts/Platform-Bold.otf`
  — used by `map.html` (paths are relative, so they must stay next to it).
- `design/homepage/Homepage.dc.html` — the editable design source. Edit
  there, re-export `index.html`, and replace `public/index.html`. Do not
  hand-edit the exported bundle.
- `design/homepage/HANDOFF.md` — the original handoff notes (deployment
  checklist, known gaps such as unlaunched Visit / Find Beer pages).

The bartender tools moved from `/` to `/dashboard`; every other app route
(`/inventory`, `/schedule`, `/admin`, `/print`, …) is unchanged.

Two logos the exported bundle references were not in the handoff's
`deploy/assets` folder, so they were added from the repo's brand files:
`public/assets/logos/lockup_horizontal_long_white.svg` (nav wordmark, copy
of `public/brand/lockup-horizontal-long-white.svg`) and
`public/assets/logos/tree_purple.svg` (beer-card mark, the tree recolored to
brand purple `#2E3080`).
