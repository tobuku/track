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
