# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Site Overview

TrackClubFinder.com — national directory of track and running clubs across all 50 US states. GitHub Pages static site. Domain: `trackclubfinder.com`. Affiliate tag: `dwelldoc-20`. GA4: `G-LC8M82YBSN`.

## Data Pipeline

1. **Google Apps Script** (`track-clubs-appscript.gs`) — runs inside the Google Sheet named `track-club-directory`. Makes 100 Outscraper API queries (2 per state: "track club" + "running club"). Resumes on re-run via `PropertiesService`. Call `resetProgress()` to start over. Call `fillMissingPhones()` after `main()` to backfill missing phone numbers.
2. **CSV export** — download the sheet as `track-clubs-data.csv`, save to repo root.
3. **Build** — `node build-directory.js` — reads the CSV, generates all state pages and `sitemap.xml`.

## Build Command

```
node build-directory.js
```

No dependencies — pure Node.js with no `npm install` required.

## CSV Column Order

Columns 0–17 (matches GAS script output and build script parser):
```
business_name, street_address, city, state, zip, phone, website,
google_rating, review_count, hours_monday–sunday (7 cols), latitude, longitude
```

## Output Structure

- `/{state-slug}/index.html` — one page per state (e.g., `/hawaii/`, `/new-york/`)
- `sitemap.xml` — all URLs including homepage and all state pages
- `style.css` — shared CSS loaded by all state pages
- `index.html` — homepage (all styles inline, does NOT use style.css)

State pages link back to `/#browse`. The homepage state grid links use absolute paths (`/alabama/` etc.) which require the custom domain or will 404 on `tobuku.github.io/track/`.

## Manually Adding a Club

Edit `track-clubs-data.csv` directly, add a row in the correct column order, then re-run `node build-directory.js` and redeploy. Leave unknown fields empty but maintain the correct number of comma-separated columns (18 total).

## Redeploying After Data Changes

After any CSV edit or script change:
```
node build-directory.js
git add -A
git commit -m "message"
git push origin main
```

State pages are fully regenerated on every build — do not hand-edit the generated `/{state}/index.html` files directly, edits will be overwritten on next build. Hand-edit `build-directory.js` templates instead.

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

**State pages are generated. Never hand-edit `/{state}/index.html`.** Every fix that touches a
state page must be made in the `build-directory.js` template and applied by re-running the build.
Every fix to club *data* (duplicates, malformed URLs, missing cities) must be made in
`track-clubs-data.csv` — and ideally in the Google Sheet, so it survives the next Outscraper export.

`index.html` is hand-maintained and may be edited directly.

Applies to each layer:

| Change type | Where it belongs |
|---|---|
| Homepage markup, inline CSS, homepage schema | `index.html` directly |
| State page markup, schema, outbound `rel` attributes | `build-directory.js` templates |
| Shared styling for generated pages | `style.css` |
| Club records — dupes, bad URLs, missing city | `track-clubs-data.csv` → then the Google Sheet |
| New page types (city pages) | new generator in `build-directory.js` |

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

- Duplicate entries within a state — `/california/` lists CPRunners, Quicksilver Running Club,
  and LA Running Club twice each
- Malformed club URLs — `fleetfeetsantarosa` with no TLD; email addresses in the website column
  (gmail.com); legacy eteamz.com links worth spot-checking

## Repo hygiene — source files are publicly served

GitHub Pages publishes the whole repo root. Confirmed live and downloadable:
`track-clubs-data.csv` (268 KB, the full dataset), `build-directory.js`, `gsc_automation.py`.
Audit the Python and Apps Script files for hardcoded credentials; rotate anything found, since
it has been public. The structural fix is publishing from a `/docs` folder so only built output
is served. Do not use robots.txt `Disallow` for this — it does not prevent access and advertises
the paths.

Stale files also being served: `track-clubs-data-OLD.csv`, `track-clubs-data-OLD2.csv`,
`scraped-clubs.csv`, `scrape-clubs.py`.

## Measured baselines

| Metric | Baseline |
|---|---|
| Homepage image payload | 20,243 KB / 38 images |
| Favicon | 4,598 KB |
| Indexable pages | 57 |
| Dofollow external links, `/california/` | 284 of 293 |
| Internal links, `/california/` | 18 |
| State pages with valid ItemList schema | 0 of 51 |
| Domain Rating / referring domains | 0.1 / 436 |
| Organic keywords / monthly traffic | 1 / ~2 |
| AI citations (AI Overviews, ChatGPT, Gemini, Perplexity, Copilot) | 0 |

## Working rules for remediation

- One git branch per phase. Never mix phases in one session.
- Before any change to `build-directory.js` templates: show the regenerated output for
  `/california/index.html` and stop for approval.
- Never fabricate club data — ratings, review counts, addresses. Omit missing fields.
- Never invent or alter `alt` text.
- After every template change, re-run `node build-directory.js` and confirm the diff is limited
  to the intended change.
