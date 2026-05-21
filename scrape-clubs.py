"""
scrape-clubs.py — RunSignup club scraper for TrackClubFinder.com

Fetches track/running club listings from RunSignup for all 50 US states.
Outputs scraped-clubs.csv in the same 18-column format as track-clubs-data.csv.

Usage:
    python scrape-clubs.py            # scrape all states
    python scrape-clubs.py --resume   # resume from checkpoint
    python scrape-clubs.py --merge    # merge scraped-clubs.csv into track-clubs-data.csv

All stdlib — no pip installs required.
"""

import csv
import json
import os
import re
import sys
import time

# Force UTF-8 output on Windows to avoid cp1252 encoding errors with special chars
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import urllib.error
import urllib.request

# ── Config ────────────────────────────────────────────────────────────────────

BASE_URL      = "https://runsignup.com"
LISTING_URL   = BASE_URL + "/clubs?state={state}&country=US&num=250"
SCRAPE_OUTPUT = os.path.join(os.path.dirname(__file__), "scraped-clubs.csv")
MAIN_CSV      = os.path.join(os.path.dirname(__file__), "track-clubs-data.csv")
CHECKPOINT    = os.path.join(os.path.dirname(__file__), ".scrape-checkpoint.json")
REQUEST_DELAY = 1.5   # seconds between requests

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# Domains to exclude when detecting a club's own website on RunSignup pages
SKIP_DOMAINS = [
    "runsignup.com", "cdnjs.cloudfront.net", "cloudfront.net",
    "fonts.googleapis.com", "gstatic.com", "google.com", "maps.google",
    "facebook.com", "twitter.com", "instagram.com", "youtube.com",
    "ticketsignup.io", "whatismybrowser.com", "help.runsignup",
    "info.runsignup", "cdn.runsignup", "safelinks.protection.outlook",
    "sendgrid.net",
]

# All 50 states + DC (DC rarely has clubs but included for completeness)
ALL_STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
    "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
]

# CSV column order (18 columns, matches track-clubs-data.csv)
CSV_COLUMNS = [
    "business_name", "street_address", "city", "state", "zip", "phone", "website",
    "google_rating", "review_count",
    "hours_monday", "hours_tuesday", "hours_wednesday", "hours_thursday",
    "hours_friday", "hours_saturday", "hours_sunday",
    "latitude", "longitude",
]

# ── HTTP helper ───────────────────────────────────────────────────────────────

def fetch(url, retries=2):
    """Fetch URL, return text or None on failure."""
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as r:
                return r.read(500000).decode("utf-8", errors="ignore")
        except urllib.error.HTTPError as e:
            if e.code in (404, 403, 410):
                return None  # permanent failure
            if attempt < retries:
                time.sleep(2)
        except Exception:
            if attempt < retries:
                time.sleep(2)
    return None


# ── Parsers ───────────────────────────────────────────────────────────────────

def parse_listing(html, state):
    """Parse club entries from a RunSignup state listing page."""
    clubs = []
    pattern = re.compile(
        r'<a href="(/Club/[A-Z]{2}/[^/]+/[^"]+)">'
        r'.*?<span class="race-name">\s*([^<]+?)\s*</span>'
        r'.*?<span>([^<]+)</span>'      # city
        r',\s*<span>[A-Z]{2}</span>'    # state (already known)
        r'.*?<span class="postalCode">(\d{5})</span>',
        re.DOTALL
    )
    for m in pattern.finditer(html):
        slug, name, city, zip_code = m.groups()
        clubs.append({
            "slug": slug,
            "business_name": name.strip(),
            "city": city.strip(),
            "state": state,
            "zip": zip_code,
        })
    return clubs


def extract_website(html):
    """
    Extract club's own website URL from RunSignup club detail page.
    RunSignup embeds external club site links as target="_blank" rel="noopener noreferrer".
    The primary link is usually labeled 'Home' in the site nav.
    """
    if not html:
        return ""

    # Look for links with target=_blank and rel=noopener (club's own site navigation)
    pattern = re.compile(
        r'href=["\']('
        r'https?://[^"\']{5,150}'
        r')["\'][^>]*target=["\']_blank["\'][^>]*rel=["\']noopener(?:\s+noreferrer)?["\'][^>]*>'
        r'\s*([^<]{0,80})</a>',
        re.DOTALL
    )
    # Also match reversed attribute order
    pattern_rev = re.compile(
        r'href=["\']('
        r'https?://[^"\']{5,150}'
        r')["\'][^>]*rel=["\']noopener(?:\s+noreferrer)?["\'][^>]*target=["\']_blank["\'][^>]*>'
        r'\s*([^<]{0,80})</a>',
        re.DOTALL
    )

    candidates = []
    for p in (pattern, pattern_rev):
        for m in p.finditer(html):
            url, label = m.group(1), m.group(2).strip()
            if any(skip in url for skip in SKIP_DOMAINS):
                continue
            # Prefer links labeled "Home" — these are club nav links to their own domain
            priority = 0 if label.lower() in ("home", "home page", "homepage") else 1
            candidates.append((priority, url))

    if not candidates:
        return ""

    candidates.sort(key=lambda x: x[0])
    return candidates[0][1]


# ── Checkpoint helpers ────────────────────────────────────────────────────────

def load_checkpoint():
    if os.path.exists(CHECKPOINT):
        with open(CHECKPOINT, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"done_states": [], "clubs": []}


def save_checkpoint(data):
    with open(CHECKPOINT, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ── Scraper ───────────────────────────────────────────────────────────────────

def scrape_state(state, checkpoint):
    """Scrape all clubs for one state. Returns list of club dicts."""
    print(f"  Fetching listing for {state}...")
    url = LISTING_URL.format(state=state)
    html = fetch(url)
    if not html:
        print(f"  [WARN] Could not fetch listing for {state}")
        return []

    clubs = parse_listing(html, state)
    print(f"  Found {len(clubs)} clubs in {state}")

    already_scraped = {c["slug"] for c in checkpoint.get("clubs", [])}
    results = []

    for i, club in enumerate(clubs, 1):
        if club["slug"] in already_scraped:
            print(f"    [{i}/{len(clubs)}] Skip (cached): {club['business_name']}")
            continue

        print(f"    [{i}/{len(clubs)}] {club['business_name']} — fetching detail...")
        time.sleep(REQUEST_DELAY)

        detail_html = fetch(BASE_URL + club["slug"])
        website = extract_website(detail_html)

        row = {col: "" for col in CSV_COLUMNS}
        row["business_name"] = club["business_name"]
        row["city"]          = club["city"]
        row["state"]         = club["state"]
        row["zip"]           = club["zip"]
        row["website"]       = website

        results.append(row)

        checkpoint_club = dict(club)
        checkpoint_club["website"] = website
        checkpoint["clubs"].append(checkpoint_club)

        if website:
            print(f"      Website: {website}")

    return results


def run_scraper(resume=False):
    checkpoint = load_checkpoint() if resume else {"done_states": [], "clubs": []}

    # Rebuild results from checkpoint for states already completed
    completed = set(checkpoint.get("done_states", []))
    scraped_clubs = [
        {**{col: "" for col in CSV_COLUMNS}, **c}
        for c in checkpoint.get("clubs", [])
        if c.get("state") in completed
    ]

    states_to_scrape = [s for s in ALL_STATES if s not in completed]
    print(f"States to scrape: {len(states_to_scrape)}  (already done: {len(completed)})\n")

    for state in states_to_scrape:
        print(f"\n=== {state} ===")
        results = scrape_state(state, checkpoint)
        scraped_clubs.extend(results)
        checkpoint["done_states"].append(state)
        save_checkpoint(checkpoint)
        time.sleep(REQUEST_DELAY)

    # Write output CSV
    with open(SCRAPE_OUTPUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(scraped_clubs)

    total = len(scraped_clubs)
    with_sites = sum(1 for c in scraped_clubs if c.get("website"))
    print(f"\nDone. {total} clubs scraped, {with_sites} have websites.")
    print(f"Output: {SCRAPE_OUTPUT}")

    # Clean up checkpoint
    if os.path.exists(CHECKPOINT):
        os.remove(CHECKPOINT)


# ── Merge ─────────────────────────────────────────────────────────────────────

def normalize_name(name):
    return re.sub(r"[^a-z0-9]", "", name.lower())


def run_merge():
    """
    Merge scraped-clubs.csv into track-clubs-data.csv.
    - Remove known junk rows (non-club businesses)
    - Deduplicate by normalized(business_name) + state
    - Append new clubs from scraped-clubs.csv
    """
    JUNK_NAMES = [
        "flying j travel center",
        "shriners temple",
        "cowboy country outfitters",
    ]

    if not os.path.exists(SCRAPE_OUTPUT):
        print(f"ERROR: {SCRAPE_OUTPUT} not found. Run scraper first.")
        sys.exit(1)

    # Read main CSV
    with open(MAIN_CSV, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        main_rows = list(reader)

    # Filter junk rows
    before = len(main_rows)
    main_rows = [
        r for r in main_rows
        if not any(junk in r[0].lower() for junk in JUNK_NAMES)
    ]
    removed = before - len(main_rows)
    if removed:
        print(f"Removed {removed} junk rows from main CSV")

    # Build dedup set from existing rows
    existing = set()
    for r in main_rows:
        if r[0] and len(r) > 3:
            key = normalize_name(r[0]) + "|" + (r[3] or "")
            existing.add(key)

    # Read scraped CSV
    with open(SCRAPE_OUTPUT, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        scraped_rows = list(reader)

    # Find new clubs to add
    new_clubs = []
    for club in scraped_rows:
        name = club.get("business_name", "")
        state = club.get("state", "")
        if not name or not state:
            continue
        key = normalize_name(name) + "|" + state
        if key not in existing:
            # Build row in correct column order
            row = [club.get(col, "") for col in CSV_COLUMNS]
            new_clubs.append(row)
            existing.add(key)

    print(f"New clubs to add: {len(new_clubs)}")
    print(f"Existing clubs kept: {len(main_rows)}")

    # Write merged CSV
    all_rows = main_rows + new_clubs
    with open(MAIN_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(all_rows)

    with_sites = sum(1 for r in new_clubs if len(r) > 6 and r[6])
    print(f"  ({with_sites} new clubs have real websites)")
    print(f"Total rows after merge: {len(all_rows)}")
    print(f"Updated: {MAIN_CSV}")
    print("\nNext step: node build-directory.js")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    args = sys.argv[1:]

    if "--merge" in args:
        run_merge()
    elif "--resume" in args:
        run_scraper(resume=True)
    else:
        run_scraper(resume=False)
