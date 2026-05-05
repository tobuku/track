/**
 * TrackClubFinder.com — Static Directory Page Generator
 *
 * Reads track-clubs-data.csv and generates all state HTML pages.
 * Run: node build-directory.js
 *
 * CSV export: File > Download > CSV from the Google Sheet.
 * Save as track-clubs-data.csv in this directory, then run the script.
 *
 * Output:
 *   /{state-slug}/index.html  — one page per state
 *   sitemap.xml
 */

var fs = require("fs");
var path = require("path");

// ── Config ────────────────────────────────────────────────────────────────────

var CSV_FILE      = path.join(__dirname, "track-clubs-data.csv");
var SITEMAP_FILE  = path.join(__dirname, "sitemap.xml");
var AFFILIATE_TAG = "trackclubfinder-20";
var SITE_DOMAIN   = "https://trackclubfinder.com";

var STATE_NAMES = {
  "AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California",
  "CO":"Colorado","CT":"Connecticut","DE":"Delaware","FL":"Florida","GA":"Georgia",
  "HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa",
  "KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland",
  "MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi",
  "MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire",
  "NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina",
  "ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania",
  "RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee",
  "TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington",
  "WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming","DC":"District of Columbia"
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPhone(raw) {
  if (!raw) return "";
  var digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") digits = digits.substring(1);
  if (digits.length === 10) {
    return "(" + digits.substring(0, 3) + ") " + digits.substring(3, 6) + "-" + digits.substring(6);
  }
  return raw;
}

function phoneTel(raw) {
  if (!raw) return "";
  var digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) digits = "1" + digits;
  return digits;
}

function starHTML(rating) {
  if (!rating) return "";
  var r = parseFloat(rating);
  if (isNaN(r)) return "";
  var full = Math.min(Math.round(r), 5);
  var html = "";
  for (var i = 0; i < full; i++) html += "&#9733;";
  for (var j = full; j < 5; j++) html += "&#9734;";
  return html;
}

function mkdirp(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseHoursField(val) {
  if (!val) return "";
  return val.replace(/^\["|"\]$/g, "").replace(/""/g, '"').trim();
}

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSV(text) {
  var rows = [];
  var lines = text.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    rows.push(parseCSVLine(line));
  }
  return rows;
}

function parseCSVLine(line) {
  var fields = [];
  var field = "";
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { fields.push(field); field = ""; }
      else { field += c; }
    }
  }
  fields.push(field);
  return fields;
}

// ── Load Data ─────────────────────────────────────────────────────────────────
// CSV columns (from GAS script):
//   0: business_name, 1: street_address, 2: city, 3: state, 4: zip,
//   5: phone, 6: website, 7: google_rating, 8: review_count,
//   9-15: hours_monday–sunday, 16: latitude, 17: longitude

function loadClubs() {
  if (!fs.existsSync(CSV_FILE)) {
    console.error("ERROR: " + CSV_FILE + " not found.");
    console.error("Export the Google Sheet as CSV and save it as track-clubs-data.csv in this directory.");
    process.exit(1);
  }

  var text = fs.readFileSync(CSV_FILE, "utf8");
  var rows = parseCSV(text);
  rows.shift(); // remove header row

  var clubs = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0] || !r[3]) continue; // need name and state

    var name      = r[0].trim();
    var street    = (r[1] || "").trim();
    var city      = (r[2] || "").trim();
    var stateAbbr = (r[3] || "").trim().toUpperCase();
    var zip       = (r[4] || "").trim();
    var phone     = (r[5] || "").trim();
    var website   = (r[6] || "").trim();
    var rating    = (r[7] || "").trim();
    var reviews   = (r[8] || "").trim();
    var lat       = (r[16] || "").trim();
    var lng       = (r[17] || "").trim();

    if (!STATE_NAMES[stateAbbr]) continue;
    if (!city) city = "";

    // Clean website URL
    if (website) {
      website = website.replace(/%3F/gi, "?").replace(/%3D/gi, "=").replace(/%26/gi, "&");
      website = website.replace(/[?&]utm_[^&]*/gi, "").replace(/\?$/, "");
    }

    var stateName = STATE_NAMES[stateAbbr];
    clubs.push({
      name:      name,
      street:    street,
      city:      city,
      state:     stateAbbr,
      stateName: stateName,
      stateSlug: slugify(stateName),
      zip:       zip,
      phone:     phone,
      phoneFmt:  formatPhone(phone),
      phoneTel:  phoneTel(phone),
      website:   website,
      rating:    rating,
      reviews:   reviews,
      lat:       lat,
      lng:       lng
    });
  }

  return clubs;
}

// ── Group by State ────────────────────────────────────────────────────────────

function groupByState(clubs) {
  var states = {};
  for (var i = 0; i < clubs.length; i++) {
    var c = clubs[i];
    if (!states[c.state]) {
      states[c.state] = {
        abbr:  c.state,
        name:  c.stateName,
        slug:  c.stateSlug,
        clubs: []
      };
    }
    states[c.state].clubs.push(c);
  }

  // Sort clubs: highest rating first, then alphabetically by name
  for (var s in states) {
    states[s].clubs.sort(function(a, b) {
      var ra = parseFloat(a.rating) || 0;
      var rb = parseFloat(b.rating) || 0;
      if (rb !== ra) return rb - ra;
      return a.name.localeCompare(b.name);
    });
  }

  return states;
}

// ── Shared HTML Partials ──────────────────────────────────────────────────────

function headerHTML() {
  return '<header>\n' +
    '  <div class="header-inner">\n' +
    '    <a class="logo" href="/">Track<span>Club</span>Finder</a>\n' +
    '    <nav>\n' +
    '      <a href="/#browse">Browse by State</a>\n' +
    '      <a href="/#resources">Resources</a>\n' +
    '      <a href="/#gear">Gear</a>\n' +
    '    </nav>\n' +
    '  </div>\n' +
    '</header>\n';
}

function footerHTML() {
  return '<footer>\n' +
    '  <div class="footer-inner">\n' +
    '    <div class="footer-logo">Track<span>Club</span>Finder</div>\n' +
    '    <div class="footer-links">\n' +
    '      <a href="/#browse">Browse by State</a>\n' +
    '      <a href="/#resources">Resources</a>\n' +
    '      <a href="/#gear">Gear</a>\n' +
    '      <a href="https://www.athletic.net/" target="_blank" rel="noopener">Athletic.net</a>\n' +
    '      <a href="https://www.usatf.org/" target="_blank" rel="noopener">USATF</a>\n' +
    '    </div>\n' +
    '    <p class="footer-disc">TrackClubFinder is an independent directory and is not affiliated with USA Track &amp; Field, Athletic.net, or any club listed. Club information is sourced from publicly available data and may not be current — verify details directly with each club. Some links on this site are affiliate links; we may earn a commission on qualifying purchases at no extra cost to you.</p>\n' +
    '  </div>\n' +
    '</footer>\n';
}

function gearSectionHTML() {
  var items = [
    { cat: "Footwear",    name: "Track Spikes",                 icon: "&#128099;", q: "track+spikes" },
    { cat: "Footwear",    name: "Performance Running Shoes",    icon: "&#128099;", q: "running+shoes+track" },
    { cat: "Technology",  name: "GPS Running Watches",          icon: "&#8987;",   q: "gps+running+watch" },
    { cat: "Apparel",     name: "Track Uniforms &amp; Shorts",  icon: "&#128084;", q: "track+and+field+uniform" },
    { cat: "Recovery",    name: "Recovery &amp; Stretching",    icon: "&#129298;", q: "foam+roller+running+recovery" },
    { cat: "Accessories", name: "Sport Sunglasses",             icon: "&#128526;", q: "running+sunglasses+sport" }
  ];

  var html = '<section class="gear-section" id="gear">\n' +
    '  <div class="section-inner">\n' +
    '    <div class="section-label">Affiliate Partners</div>\n' +
    '    <h2 class="section-title">Recommended Track Gear</h2>\n' +
    '    <div class="gear-grid">\n';

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    html += '      <a class="gear-card" href="https://www.amazon.com/s?k=' + item.q + '&tag=' + AFFILIATE_TAG + '" target="_blank" rel="noopener sponsored">\n' +
      '        <div class="gear-img">' + item.icon + '</div>\n' +
      '        <div class="gear-body">\n' +
      '          <div class="gear-cat">' + item.cat + '</div>\n' +
      '          <h3>' + item.name + '</h3>\n' +
      '          <span class="gear-cta">Shop on Amazon &#8599;</span>\n' +
      '        </div>\n' +
      '      </a>\n';
  }

  html += '    </div>\n' +
    '    <p style="margin-top:1.25rem;font-size:.8rem;color:#95a5a6;">As an Amazon Associate, TrackClubFinder earns from qualifying purchases.</p>\n' +
    '  </div>\n' +
    '</section>\n';

  return html;
}

// ── State Page Generator ──────────────────────────────────────────────────────

function generateStatePage(stateData) {
  var clubs = stateData.clubs;
  var stateName = stateData.name;
  var stateAbbr = stateData.abbr;
  var stateSlug = stateData.slug;
  var count = clubs.length;

  // Build listing cards
  var listingsHTML = "";
  for (var i = 0; i < clubs.length; i++) {
    var c = clubs[i];

    var ratingHTML = "";
    if (c.rating) {
      ratingHTML = '<div class="club-rating"><span class="stars">' + starHTML(c.rating) + '</span> ' +
        escapeHTML(c.rating) + (c.reviews ? ' <span class="review-count">(' + escapeHTML(c.reviews) + ' reviews)</span>' : '') +
        '</div>\n';
    }

    var addressHTML = "";
    var addressParts = [];
    if (c.street) addressParts.push(escapeHTML(c.street));
    if (c.city)   addressParts.push(escapeHTML(c.city));
    if (stateAbbr) addressParts.push(stateAbbr);
    if (c.zip)    addressParts.push(escapeHTML(c.zip));
    if (addressParts.length) {
      addressHTML = '<div class="club-address">&#128205; ' + addressParts.join(", ") + '</div>\n';
    }

    var phoneHTML = "";
    if (c.phoneFmt) {
      phoneHTML = '<a class="club-phone" href="tel:' + c.phoneTel + '">&#128222; ' + escapeHTML(c.phoneFmt) + '</a>\n';
    }

    var linksHTML = '<div class="club-links">\n';
    if (c.website) {
      var displayUrl = c.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
      linksHTML += '  <a class="club-link" href="' + escapeHTML(c.website) + '" target="_blank" rel="noopener">Website &#8599;</a>\n';
    }
    var athleticSearch = 'https://www.athletic.net/search?q=' + encodeURIComponent(c.name + ' ' + stateAbbr);
    linksHTML += '  <a class="club-link athletic" href="' + athleticSearch + '" target="_blank" rel="noopener">Athletic.net &#8599;</a>\n';
    linksHTML += '</div>\n';

    // Schema.org LocalBusiness for this club
    var schemaName = c.name.replace(/"/g, '\\"');
    var schemaCity = c.city.replace(/"/g, '\\"');

    listingsHTML += '<div class="club-card" itemscope itemtype="https://schema.org/LocalBusiness">\n' +
      '  <meta itemprop="name" content="' + escapeHTML(c.name) + '">\n' +
      (c.street ? '  <meta itemprop="streetAddress" content="' + escapeHTML(c.street) + '">\n' : '') +
      (c.city   ? '  <meta itemprop="addressLocality" content="' + escapeHTML(c.city) + '">\n' : '') +
      '  <meta itemprop="addressRegion" content="' + stateAbbr + '">\n' +
      (c.rating ? '  <meta itemprop="ratingValue" content="' + escapeHTML(c.rating) + '">\n' : '') +
      '  <h2 class="club-name" itemprop="name">' + escapeHTML(c.name) + '</h2>\n' +
      ratingHTML +
      addressHTML +
      phoneHTML +
      linksHTML +
      '</div>\n\n';
  }

  // ItemList schema
  var itemListItems = clubs.map(function(c, idx) {
    return '{"@type":"ListItem","position":' + (idx + 1) + ',"name":"' + c.name.replace(/"/g, '\\"') + '"}';
  }).join(",\n      ");

  var html = '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <title>Track Clubs in ' + escapeHTML(stateName) + ' | TrackClubFinder</title>\n' +
    '  <meta name="description" content="Find ' + count + ' track clubs and running clubs in ' + escapeHTML(stateName) + '. Browse contact info, websites, Google ratings, and links to race results on Athletic.net.">\n' +
    '  <meta name="robots" content="index, follow">\n' +
    '  <link rel="canonical" href="' + SITE_DOMAIN + '/' + stateSlug + '/">\n' +
    '  <meta property="og:title" content="Track Clubs in ' + escapeHTML(stateName) + ' | TrackClubFinder">\n' +
    '  <meta property="og:description" content="Find ' + count + ' track and running clubs in ' + escapeHTML(stateName) + '.">\n' +
    '  <meta property="og:url" content="' + SITE_DOMAIN + '/' + stateSlug + '/">\n' +
    '  <meta property="og:type" content="website">\n' +
    '  <link rel="stylesheet" href="/style.css">\n' +
    '  <script type="application/ld+json">\n' +
    '  {\n' +
    '    "@context": "https://schema.org",\n' +
    '    "@type": "BreadcrumbList",\n' +
    '    "itemListElement": [\n' +
    '      {"@type":"ListItem","position":1,"name":"Home","item":"' + SITE_DOMAIN + '/"},\n' +
    '      {"@type":"ListItem","position":2,"name":"' + escapeHTML(stateName) + '","item":"' + SITE_DOMAIN + '/' + stateSlug + '/"}\n' +
    '    ]\n' +
    '  }\n' +
    '  </script>\n' +
    '  <script type="application/ld+json">\n' +
    '  {\n' +
    '    "@context": "https://schema.org",\n' +
    '    "@type": "ItemList",\n' +
    '    "name": "Track Clubs in ' + escapeHTML(stateName) + '",\n' +
    '    "numberOfItems": ' + count + ',\n' +
    '    "itemListElement": [\n      ' + itemListItems + '\n    ]\n' +
    '  }\n' +
    '  </script>\n' +
    '</head>\n' +
    '<body>\n\n' +
    headerHTML() +
    '\n<main>\n\n' +

    '<!-- Breadcrumb -->\n' +
    '<div class="breadcrumb-bar">\n' +
    '  <div class="section-inner">\n' +
    '    <nav class="breadcrumbs" aria-label="Breadcrumb">\n' +
    '      <a href="/">Home</a> <span>/</span> <strong>' + escapeHTML(stateName) + '</strong>\n' +
    '    </nav>\n' +
    '  </div>\n' +
    '</div>\n\n' +

    '<!-- State Hero -->\n' +
    '<section class="state-hero">\n' +
    '  <div class="section-inner">\n' +
    '    <h1>Track Clubs in ' + escapeHTML(stateName) + '</h1>\n' +
    '    <p class="hero-sub">' + count + ' track club' + (count !== 1 ? 's' : '') + ' and running club' + (count !== 1 ? 's' : '') + ' listed in ' + escapeHTML(stateName) + '. Includes contact info, website links, and Google ratings. Check race results and athlete profiles on Athletic.net.</p>\n' +
    '    <div class="state-stats">\n' +
    '      <div class="state-stat"><strong>' + count + '</strong><span>Clubs Listed</span></div>\n' +
    '      <div class="state-stat"><strong>' + stateAbbr + '</strong><span>' + escapeHTML(stateName) + '</span></div>\n' +
    '      <div class="state-stat"><strong>Free</strong><span>To Search</span></div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</section>\n\n' +

    '<!-- Club Listings -->\n' +
    '<section class="listings-section">\n' +
    '  <div class="section-inner">\n' +
    '    <div class="section-label">Directory</div>\n' +
    '    <h2 class="section-title">All Track &amp; Running Clubs in ' + escapeHTML(stateName) + '</h2>\n' +
    '    <div class="clubs-grid">\n' +
    listingsHTML +
    '    </div>\n' +
    '  </div>\n' +
    '</section>\n\n' +

    gearSectionHTML() +

    '<!-- CTA -->\n' +
    '<section class="cta-section">\n' +
    '  <h2>Browse Other States</h2>\n' +
    '  <p>Find track clubs in all 50 states — free to search.</p>\n' +
    '  <a class="btn" href="/#browse">Back to State Directory</a>\n' +
    '</section>\n\n' +

    '</main>\n\n' +
    footerHTML() +
    '\n</body>\n</html>\n';

  return html;
}

// ── Sitemap ───────────────────────────────────────────────────────────────────

function generateSitemap(states) {
  var today = new Date().toISOString().slice(0, 10);
  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '  <url><loc>' + SITE_DOMAIN + '/</loc><lastmod>' + today + '</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n';

  var stateKeys = Object.keys(states).sort();
  for (var i = 0; i < stateKeys.length; i++) {
    var s = states[stateKeys[i]];
    xml += '  <url><loc>' + SITE_DOMAIN + '/' + s.slug + '/</loc><lastmod>' + today + '</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n';
  }

  xml += '</urlset>\n';
  return xml;
}

// ── Build ─────────────────────────────────────────────────────────────────────

function build() {
  console.log("Loading clubs from CSV...");
  var clubs = loadClubs();
  console.log("Loaded " + clubs.length + " clubs.");

  var states = groupByState(clubs);
  var stateKeys = Object.keys(states).sort();
  console.log("Found " + stateKeys.length + " states.");

  var pagesCreated = 0;

  for (var i = 0; i < stateKeys.length; i++) {
    var state = states[stateKeys[i]];
    var dir = path.join(__dirname, state.slug);
    mkdirp(dir);
    fs.writeFileSync(path.join(dir, "index.html"), generateStatePage(state));
    pagesCreated++;
    console.log("  " + state.name + " (" + state.abbr + "): " + state.clubs.length + " clubs");
  }

  var sitemap = generateSitemap(states);
  fs.writeFileSync(SITEMAP_FILE, sitemap);

  console.log("\nDone! Created " + pagesCreated + " state pages + sitemap.xml");
  console.log("Next: git add -A && git commit && git push");
}

build();
