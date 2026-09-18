# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Site Overview

TrackClubFinder.com — national directory of track and running clubs across all 50 US states. GitHub Pages static site. Domain: `trackclubfinder.com`. Affiliate tag: `dwelldoc-20`. GA4: `G-LC8M82YBSN`.

## Repo Structure

GitHub Pages publishes from the `/docs` folder (not repo root). Source files in the root
are NOT publicly accessible.

| Location | Contents | Publicly served? |
|---|---|---|
| `docs/` | Homepage, state/city pages, content pages, images, CSS, favicons, CNAME, robots.txt, sitemap.xml | Yes |
| repo root | `build-directory.js`, `track-clubs-data.csv`, `gsc_automation.py`, `track-clubs-appscript.gs`, `scripts/` | No |

## Data Pipeline

1. **Google Apps Script** (`track-clubs-appscript.gs`) — runs inside the Google Sheet named `track-club-directory`. Makes 100 Outscraper API queries (2 per state: "track club" + "running club"). Resumes on re-run via `PropertiesService`. Call `resetProgress()` to start over. Call `fillMissingPhones()` after `main()` to backfill missing phone numbers.
2. **CSV export** — download the sheet as `track-clubs-data.csv`, save to repo root.
3. **Build** — `node build-directory.js` — reads the CSV, generates all state/city pages and `sitemap.xml` into `docs/`.

## Build Command

```
node build-directory.js
```

No dependencies — pure Node.js with no `npm install` required.

## CSV Column Order

Columns 0–18 (19 total):
```
business_name, street_address, city, state, zip, phone, website,
google_rating, review_count, hours_monday–sunday (7 cols), latitude, longitude, description
```
Column 18 (`description`) is optional. When populated, it renders as italic text on the club card.

## Output Structure

All output goes to `docs/`:

- `docs/{state-slug}/index.html` — one page per state (e.g., `docs/hawaii/`)
- `docs/{state-slug}/{city-slug}/index.html` — city pages for cities with 2+ clubs
- `docs/sitemap.xml` — all URLs including homepage, state, city, and content pages
- `docs/style.css` — shared CSS loaded by all generated pages
- `docs/index.html` — homepage (hand-maintained, all styles inline, does NOT use style.css)

State pages link back to `/#browse`. The homepage state grid links use absolute paths (`/alabama/` etc.) which require the custom domain or will 404 on `tobuku.github.io/track/`.

## Manually Adding a Club

Edit `track-clubs-data.csv` directly, add a row in the correct column order, then re-run `node build-directory.js` and redeploy. Leave unknown fields empty but maintain the correct number of comma-separated columns (19 total).

To force a city page for a city with only 1 club, add the state+city to the `FORCE_CITY_PAGES` array in `build-directory.js` (e.g., `"PA:McMurray"`).

## Redeploying After Data Changes

After any CSV edit or script change:
```
node build-directory.js
git add -A
git commit -m "message"
git push origin main
```

State and city pages are fully regenerated into `docs/` on every build — do not hand-edit the generated `docs/{state}/index.html` files directly, edits will be overwritten on next build. Hand-edit `build-directory.js` templates instead.

## Recurring Data Issue — Spartan Track Club Hawaii

Outscraper returns a bad row for Spartan Track Club Hawaii (empty city/state, coordinates 23.69°N 166.59°W — middle of the Pacific). The build script filters rows with no state field, so Spartan disappears from the Hawaii page after every fresh CSV export.

**Fix after every CSV export:**
Find line with `Spartan Track Club Hawaii` in `track-clubs-data.csv` and ensure it reads:
```
Spartan Track Club Hawaii,,Honolulu,HI,,,https://www.spartantrackclubhawaii.org,5,1,...,21.3069,-157.8583
```
The permanent fix is to correct the row directly in the Google Sheet so future exports are already correct.

Also watch for a junk row with just `Hawaii,,US,HI` — delete it if present.

## Key Design Decisions

- **Font**: Barlow Condensed (Google Fonts) for all headings — loaded via `<link>` in both homepage and state pages
- **Hero**: Real photo background (`/images/IMG_5760.JPG`) with dark overlay — not a CSS gradient
- **State pages**: Self-contained HTML with gear affiliate section on every page
- **Homepage**: All CSS is inline in `<style>` tag — does not reference `style.css`
- **style.css**: Only used by generated state pages, not the homepage

## Images

Real track meet photos in `/images/` — shot in Hawaii. Usage:
- `IMG_5760.JPG` — hero background (red track, Honolulu skyline)
- `IMG_5761.JPG` — about section photo
- `IMG_9680.JPG` — CTA section background
- `IMG_0724.JPG` — start blocks (photo strip + socks gear card)
- `IMG_0751.JPG` — red track, lane numbers, skyline (photo strip)
- `IMG_0805.JPG` — meet atmosphere (photo strip + hydration gear card)
- `IMG_0747.JPG` — spikes on feet (spikes gear card)
- `IMG_0745.JPG` — Hoka shoes (running shoes gear card)
- `IMG_0740.JPG` — timing equipment (GPS watch gear card)
- `IMG_0735.JPG` — athletes on track (uniforms gear card)
- `IMG_0723.JPG` — abstract lane lines (recovery gear card)
- `IMG_0836.JPG` — wide sunny track, skyline (sunglasses gear card)
- `IMG_0541.JPG`, `IMG_0542.JPG` — telecom tools, not used on site

---

# SEO & Performance Remediation — August 2026

Added after a full site audit. Sections below cover an in-progress remediation program.

## Architectural rule that governs all of this work

**State and city pages are generated. Never hand-edit `docs/{state}/index.html`.** Every fix that
touches a state or city page must be made in the `build-directory.js` template and applied by
re-running the build. Every fix to club *data* (duplicates, malformed URLs, missing cities) must
be made in `track-clubs-data.csv` — and ideally in the Google Sheet, so it survives the next
Outscraper export.

`docs/index.html` is hand-maintained and may be edited directly. Same for content pages in `docs/`.

Applies to each layer:

| Change type | Where it belongs |
|---|---|
| Homepage markup, inline CSS, homepage schema | `docs/index.html` directly |
| Content pages (guide, essentials, etc.) | `docs/{page}/index.html` directly |
| State/city page markup, schema, outbound `rel` attributes | `build-directory.js` templates |
| Shared styling for generated pages | `docs/style.css` |
| Club records — dupes, bad URLs, missing city | `track-clubs-data.csv` → then the Google Sheet |

## Zero-dependency constraint

`node build-directory.js` must keep running with no `npm install`. Image optimization needs a
library, so it lives in `/scripts/` as a **one-off local tool, never part of the build**. Run it
manually when images change; the build itself stays dependency-free.

## GitHub Pages constraints — do not fight these

- **Custom HTTP headers are impossible.** `Cache-Control` is fixed at `max-age=600` by GitHub.
  `_headers`, `.htaccess`, `netlify.toml`, `vercel.json` do nothing here. Do not create them.
- **No server-side redirects**, no rewrites, no request-time computation.

## Audit findings being remediated

**Favicon** — `/favicon.png` is 4,598 KB, loaded via `<link rel="icon">` on every page. A single
favicon costing more than the entire optimized image gallery. Needs a proper 32/180/ICO set.

**Images** — 38 files in `/images/`, 20,243 KB total, average 533 KB, largest 799 KB
(`IMG_0723.JPG`). All unprocessed camera originals, no WebP. Rendered at 116×200 thumbnails.
The LCP element is `.hero-bg`, a CSS `background-image` the preload scanner cannot discover.
Note: every `<img>` sits below a 560px-min-height hero, so `loading="lazy"` on them is **correct
and should be left alone** — the LCP problem is the CSS background, not the img tags.

**Structured data** — `ItemList` entries on all 51 state pages are bare `{"@type":"ListItem",
"name":"..."}` with no `item`/`url`, which is a schema.org validation error and produces no rich
result. The homepage `WebSite` schema declares a `SearchAction` targeting `/search?state={state}`,
which 404s. Homepage `FAQPage` schema lists 5 questions; the page renders 7.

**Link equity** — `/california/` emits 293 external links, 284 dofollow, 189 of them to
athletic.net from that single page (~9,600 site-wide). Only 18 internal links, 3 to other states.
Homepage gear links already carry `rel="noopener sponsored"` correctly — the gap is in the
generated state page template.

**Mobile navigation is hidden entirely** — `@media (max-width: 600px) { nav { display: none; } }`.
Under mobile-first indexing that is the version Google evaluates.

**Architecture** — 57 indexable pages for ~2,350 clubs. All 188 California clubs on one page.
No city-level pages, which is where the actual search demand lives.

**Backlinks** — DR 0.1 from 436 referring domains: 97.9% nofollow, zero above UR 10, all acquired
in a single spike. Treat the referring-domain count as a vanity metric, not progress.

**Count inconsistency** — hero stat says "1,000+ Clubs Listed"; title, meta description,
og:description, and About section all say "2,350+".

## Known data defects (fix in the Sheet, like the Spartan row)

- ~~Duplicate entries within a state~~ — FIXED 2026-09-17: removed CPRunners, Quicksilver, LA Running Club dupes
- ~~Malformed club URLs~~ — FIXED 2026-09-17: cleared emails from URL field, removed eteamz link, added missing TLDs
- Watch for new duplicates or malformed URLs after future Outscraper exports

## Repo hygiene — RESOLVED

~~GitHub Pages published the whole repo root.~~ FIXED 2026-09-17: site now publishes from `/docs`
folder. Source files (`build-directory.js`, `track-clubs-data.csv`, `gsc_automation.py`,
`track-clubs-appscript.gs`) are in the repo root and are NOT publicly accessible.
Stale files (`track-clubs-data-OLD*.csv`, `scraped-clubs.csv`, `scrape-clubs.py`) were deleted
in Phase 2. Outscraper API key was replaced with placeholder in commit 5360dcb.
**TODO:** Rotate the actual Outscraper API key (it was publicly exposed before the /docs switch).

## Measured baselines (pre-remediation Aug 2026) → current

| Metric | Baseline | Current (Sep 2026) |
|---|---|---|
| Homepage image payload | 20,243 KB / 38 images | Optimized WebP |
| Favicon | 4,598 KB | Proper 32/180/ICO set |
| Indexable pages | 57 | 422 |
| Dofollow external links, `/california/` | 284 of 293 | Club links now nofollow |
| State pages with valid ItemList schema | 0 of 51 | 51 of 51 |
| Source files publicly accessible | Yes | No (/docs folder) |
| Domain Rating / referring domains | 0.1 / 436 | TBD |
| Organic keywords / monthly traffic | 1 / ~2 | TBD |

## Working rules for remediation

- One git branch per phase. Never mix phases in one session.
- Before any change to `build-directory.js` templates: show the regenerated output for
  `/california/index.html` and stop for approval.
- Never fabricate club data — ratings, review counts, addresses. Omit missing fields.
- Never invent or alter `alt` text.
- After every template change, re-run `node build-directory.js` and confirm the diff is limited
  to the intended change.
