# Handoff: Publish the Lively Beerworks homepage to livelybeerworks.com

## Task for Claude Code
Put the finished homepage live at **livelybeerworks.com**. The domain is registered at **GoDaddy**; the owner has the GoDaddy login. The site is static: no build step, no server code, no environment variables.

This is a **deploy task, not a rebuild**. `deploy/` is production-ready: upload it as-is. `source/` is for reference only (see "Editing later").

## What's in this folder
```
deploy/                  ← upload the CONTENTS of this folder to the web root
  index.html             Homepage, fully self-contained (fonts, logos, photos, JS inlined; ~1.6 MB)
  map.html               Taproom map, loaded by index.html in an <iframe>
  assets/logos/tree_white.svg   Map pin icon (used by map.html)
  assets/fonts/Platform-Bold.otf Map label font (used by map.html)
source/
  Homepage.dc.html       Editable design source (reference only, do not upload)
```
Keep the relative paths. `index.html` loads `map.html` from the same directory, and `map.html` loads `assets/...` relative to itself.

## Step 1: Find out where the site is hosted
Log in to GoDaddy → **My Products**.
- **Web Hosting / cPanel plan listed** → use Option A.
- **Only the domain is listed (no hosting)**, or hosting is on another provider → use Option B. Check the domain's DNS records to see where it currently points (A record / CNAME for `@` and `www`), and tell the owner what the current site runs on before replacing it.

Before changing anything, **back up the current live site**: download the existing web root (Option A) or save screenshots and the current DNS records (Option B).

## Option A: GoDaddy cPanel hosting
1. cPanel → **File Manager** → `public_html/`.
2. Rename the existing `index.html` (or `index.php`) to `index.old.html`. If an existing CMS (WordPress, etc.) lives there, move its files into a `_old_site/` folder instead of deleting them.
3. Upload everything inside `deploy/` into `public_html/`, keeping the `assets/` subfolders.
4. Make sure HTTPS is on (cPanel → SSL/TLS Status → AutoSSL).

## Option B: Static host + GoDaddy DNS (recommended if there's no GoDaddy hosting)
Use any static host (Vercel, Netlify, Cloudflare Pages). Example with the Vercel CLI:
```
cd deploy
npx vercel --prod          # project name: lively-beerworks
npx vercel domains add livelybeerworks.com
npx vercel domains add www.livelybeerworks.com
```
Then in GoDaddy → Domain → **DNS**, set exactly the records the host asks for. For Vercel this is typically:
- `A` record, name `@` → `76.76.21.21`
- `CNAME`, name `www` → `cname.vercel-dns.com`

Remove any conflicting old `A`/`CNAME` records for `@` and `www`, and any GoDaddy "Forwarding" on the domain. **Leave MX / email records untouched**: the brewery's email (@livelybeer.com / @livelybeerworks.com) must keep working.

Note: an earlier attempt to deploy through a connected Vercel team failed because that account lacked permission to create projects. Use an account that has Owner/Member rights.

## Step 2: Verify after launch
Open https://livelybeerworks.com and https://www.livelybeerworks.com on desktop and phone:
- The **age gate** appears on first visit. Confirming stores `lb-age-verified=yes` in localStorage, so it won't show again in that browser. "No" shows a decline message.
- **Hero**, **core lineup** (4 beer cards + Cowboy Cold) and **story** section with the taproom photo all render in the Platform font.
- The **Instagram carousel** loads 3-across from Behold (`https://feeds.behold.so/mnVHvHgGdILD3s3vGCqG`, fetched client-side). If it's blank, check the browser console for a CORS/network error on that URL.
- The **taproom map** (map.html iframe) shows the purple-tinted OpenStreetMap with the Lively pin at 815 SW 2nd St. It loads Leaflet 1.9.4 from unpkg.com and tiles from tile.openstreetmap.org.
- **Taproom hours** table is correct (owner has confirmed the hours).
- HTTPS padlock present; `www` and the bare domain both resolve.

## Known limitation: other pages not launched yet
Only the homepage is going live in this pass. These links in index.html point to pages that are **not** in this bundle and will 404:
- Nav: **Visit** (→ Events page), **Find Beer**, **Private events**
- "Find it near you" under The core lineup (→ Find Beer)
- "See the full calendar" button (→ Events page)

Ask the owner whether to (a) launch with these links as-is, or (b) have the design side hide them and re-export. Don't hand-edit `deploy/index.html`: it's a compiled bundle. Changes should be made in the design source and re-exported.

Also, the footer's @LivelyBeerworks social links currently point to `#`.

## Editing later
`source/Homepage.dc.html` is the editable design file (a Design Component authored in Claude's design tool). The intended workflow is to edit there, re-export `index.html`, and redeploy. If the team later moves to a real codebase (e.g. Next.js/Astro), treat the source file as a high-fidelity reference and rebuild it with these brand tokens:
- Colors: Purple `#2E3080`, Green `#2B6D57`, Pink `#FC8773`, Yellow `#FFD10D`, Blue `#BAEDF5`, Grapefruit orange `#FFAA2D` / coral `#FF5462`
- Type: Platform (Medium 500, Bold 700) only; spaced all-caps eyebrows
- Hard-offset block shadow `6px 6px 0`, small radii (4–14px), flat color blocks, no gradients
