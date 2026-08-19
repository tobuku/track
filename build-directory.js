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
var AFFILIATE_TAG = "dwelldoc-20";
var SITE_DOMAIN   = "https://trackclubfinder.com";
var GA4_ID        = "G-LC8M82YBSN";

// Featured clubs with extra links and badge
var FEATURED_CLUBS = {
  "Quick Track Club": {
    badge: "Featured Club",
    description: "Home of the 2025 USATF Cross Country National Champions across multiple youth divisions.",
    social: [
      { label: "Facebook", url: "https://www.facebook.com/QuickTrackClub/" },
      { label: "Yelp", url: "https://www.yelp.com/biz/quick-track-club-placentia" }
    ]
  }
};

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

// Geographically adjacent states (max 6 per state)
var STATE_NEIGHBORS = {
  "AL":["FL","GA","TN","MS"],
  "AK":["WA","OR"],
  "AZ":["CA","NV","UT","NM"],
  "AR":["MO","TN","MS","LA","TX","OK"],
  "CA":["OR","NV","AZ"],
  "CO":["WY","NE","KS","OK","NM","UT"],
  "CT":["NY","MA","RI"],
  "DC":["MD","VA"],
  "DE":["MD","PA","NJ"],
  "FL":["GA","AL"],
  "GA":["FL","AL","TN","NC","SC"],
  "HI":["CA","OR"],
  "ID":["MT","WY","UT","NV","OR","WA"],
  "IL":["WI","IA","MO","KY","IN"],
  "IN":["IL","KY","OH","MI"],
  "IA":["MN","WI","IL","MO","NE","SD"],
  "KS":["NE","CO","OK","MO"],
  "KY":["OH","IN","IL","MO","TN","VA"],
  "LA":["TX","AR","MS"],
  "ME":["NH"],
  "MD":["VA","DC","DE","PA","WV"],
  "MA":["NY","CT","RI","NH","VT"],
  "MI":["WI","IN","OH"],
  "MN":["ND","SD","IA","WI"],
  "MS":["LA","AR","TN","AL"],
  "MO":["IA","IL","KY","TN","AR","OK"],
  "MT":["ND","SD","WY","ID"],
  "NE":["SD","IA","MO","KS","CO","WY"],
  "NV":["CA","OR","ID","UT","AZ"],
  "NH":["ME","VT","MA"],
  "NJ":["NY","PA","DE"],
  "NM":["CO","OK","TX","AZ"],
  "NY":["VT","MA","CT","NJ","PA"],
  "NC":["VA","TN","SC","GA"],
  "ND":["MT","SD","MN"],
  "OH":["MI","IN","KY","WV","PA"],
  "OK":["KS","MO","AR","TX","NM","CO"],
  "OR":["WA","ID","NV","CA"],
  "PA":["NY","NJ","DE","MD","WV","OH"],
  "RI":["CT","MA"],
  "SC":["NC","GA"],
  "SD":["ND","MN","IA","NE","WY","MT"],
  "TN":["KY","VA","NC","GA","AL","MS"],
  "TX":["NM","OK","AR","LA"],
  "UT":["ID","WY","CO","NM","AZ","NV"],
  "VT":["NY","NH","MA"],
  "VA":["MD","DC","WV","KY","TN","NC"],
  "WA":["OR","ID"],
  "WV":["OH","PA","MD","VA","KY"],
  "WI":["MN","IA","IL","MI"],
  "WY":["MT","SD","NE","CO","UT","ID"]
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
    '      <a href="/essentials/" class="nav-highlight">Essentials</a>\n' +
    '      <a href="/guide/">Guide</a>\n' +
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
    '      <a href="/essentials/">Essentials</a>\n' +
    '      <a href="/guide/">Guide</a>\n' +
    '      <a href="/#gear">Gear</a>\n' +
    '      <a href="/submit/">Submit Your Club</a>\n' +
    '      <a href="/choosing-a-club/">Choosing a Club</a>\n' +
    '      <a href="/track-vs-running-club/">Track vs Running Club</a>\n' +
    '      <a href="https://www.athletic.net/" target="_blank" rel="noopener">Athletic.net</a>\n' +
    '      <a href="https://www.usatf.org/" target="_blank" rel="noopener">USATF</a>\n' +
    '    </div>\n' +
    '    <p class="footer-disc">TrackClubFinder is an independent directory and is not affiliated with USA Track &amp; Field, Athletic.net, or any club listed. Club information is sourced from publicly available data and may not be current - verify details directly with each club. Some links on this site are affiliate links; we may earn a commission on qualifying purchases at no extra cost to you. This includes Amazon Associates and other affiliate partners.</p>\n' +
    '  </div>\n' +
    '</footer>\n';
}

function gearSectionHTML() {
  var items = [
    { cat: "Footwear",    name: "Track Spikes",                img: "/images/IMG_0747.JPG", webp: "/images/optimized/IMG_0747.webp", alt: "Track spikes",                    w: 440, h: 290, q: "track+spikes" },
    { cat: "Footwear",    name: "Performance Running Shoes",   img: "/images/IMG_0745.JPG", webp: "/images/optimized/IMG_0745.webp", alt: "Running shoes",                   w: 440, h: 330, q: "running+shoes+track" },
    { cat: "Technology",  name: "GPS Running Watches",         img: "/images/IMG_0740.JPG", webp: "/images/optimized/IMG_0740.webp", alt: "Timing technology at a meet",     w: 440, h: 330, q: "gps+running+watch" },
    { cat: "Apparel",     name: "Track Uniforms &amp; Shorts", img: "/images/IMG_0735.JPG", webp: "/images/optimized/IMG_0735.webp", alt: "Athletes on the track",           w: 440, h: 330, q: "track+and+field+uniform" },
    { cat: "Recovery",    name: "Recovery &amp; Stretching",   img: "/images/IMG_0723.JPG", webp: "/images/optimized/IMG_0723.webp", alt: "Track surface close-up",          w: 440, h: 330, q: "foam+roller+running+recovery" },
    { cat: "Accessories", name: "Sport Sunglasses",            img: "/images/IMG_0836.JPG", webp: "/images/optimized/IMG_0836.webp", alt: "Sunny track in Honolulu",         w: 440, h: 330, q: "running+sunglasses+sport" },
    { cat: "Gear",        name: "Track Bags &amp; Backpacks", img: "/images/IMG_0690.JPG", webp: "/images/optimized/IMG_0690.webp", alt: "Red track with Honolulu skyline",  w: 480, h: 360, q: "running+backpack+bag+track" },
    { cat: "Training",    name: "Resistance Bands",           img: "/images/IMG_0736.JPG", webp: "/images/optimized/IMG_0736.webp", alt: "Lane numbers on a track",          w: 480, h: 360, q: "resistance+bands+running+training" },
    { cat: "Meet Day",    name: "Pop-Up Canopy Tents",        img: "/images/IMG_9748.JPG", webp: "/images/optimized/IMG_9748.webp", alt: "Track meet with canopy tents",     w: 480, h: 360, q: "pop+up+canopy+tent+10x10+UV+UPF+50" }
  ];

  var html = '<section class="gear-section" id="gear">\n' +
    '  <div class="section-inner">\n' +
    '    <div class="section-label">Affiliate Partners</div>\n' +
    '    <h2 class="section-title">Recommended Track Gear</h2>\n' +
    '    <div class="gear-grid">\n';

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    html += '      <a class="gear-card" href="https://www.amazon.com/s?k=' + item.q + '&tag=' + AFFILIATE_TAG + '" target="_blank" rel="noopener sponsored">\n' +
      '        <div class="gear-img"><picture><source srcset="' + item.webp + '" type="image/webp"><img src="' + item.img + '" alt="' + item.alt + '" loading="lazy" width="' + item.w + '" height="' + item.h + '"></picture></div>\n' +
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

function getTopCities(clubs, max) {
  var counts = {};
  for (var i = 0; i < clubs.length; i++) {
    var city = clubs[i].city;
    if (city) counts[city] = (counts[city] || 0) + 1;
  }
  return Object.keys(counts).sort(function(a, b) {
    return counts[b] - counts[a];
  }).slice(0, max || 4);
}

function generateStatePage(stateData, allStates) {
  var clubs = stateData.clubs;
  var stateName = stateData.name;
  var stateAbbr = stateData.abbr;
  var stateSlug = stateData.slug;
  var count = clubs.length;
  var topCities = getTopCities(clubs, 4);

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

    var athleticSearch = 'https://www.athletic.net/search?q=' + encodeURIComponent(c.name + ' ' + stateAbbr);
    var linksHTML = '<div class="club-links">\n';
    if (c.website) {
      linksHTML += '  <a class="club-link" href="' + escapeHTML(c.website) + '" target="_blank" rel="noopener">Website &#8599;</a>\n';
      linksHTML += '  <a class="club-link club-link--secondary" href="' + athleticSearch + '" target="_blank" rel="noopener">Search Athletic.net &#8599;</a>\n';
    } else {
      linksHTML += '  <a class="club-link athletic" href="' + athleticSearch + '" target="_blank" rel="noopener">Search Athletic.net &#8599;</a>\n';
    }
    linksHTML += '</div>\n';

    // Schema.org LocalBusiness for this club
    var schemaName = c.name.replace(/"/g, '\\"');
    var schemaCity = c.city.replace(/"/g, '\\"');

    // Check if this club is featured
    var featured = FEATURED_CLUBS[c.name];
    var cardClass = 'club-card' + (featured ? ' club-card--featured' : '');
    var badgeHTML = featured ? '  <span class="featured-badge">' + escapeHTML(featured.badge) + '</span>\n' : '';
    var descHTML = featured && featured.description ? '  <p class="featured-desc">' + escapeHTML(featured.description) + '</p>\n' : '';
    var socialHTML = '';
    if (featured && featured.social) {
      socialHTML = '  <div class="club-social">\n';
      for (var s = 0; s < featured.social.length; s++) {
        socialHTML += '    <a class="club-social-link" href="' + escapeHTML(featured.social[s].url) + '" target="_blank" rel="noopener">' + escapeHTML(featured.social[s].label) + ' &#8599;</a>\n';
      }
      socialHTML += '  </div>\n';
    }

    listingsHTML += '<div class="' + cardClass + '" itemscope itemtype="https://schema.org/LocalBusiness">\n' +
      '  <meta itemprop="name" content="' + escapeHTML(c.name) + '">\n' +
      (c.street ? '  <meta itemprop="streetAddress" content="' + escapeHTML(c.street) + '">\n' : '') +
      (c.city   ? '  <meta itemprop="addressLocality" content="' + escapeHTML(c.city) + '">\n' : '') +
      '  <meta itemprop="addressRegion" content="' + stateAbbr + '">\n' +
      (c.rating ? '  <meta itemprop="ratingValue" content="' + escapeHTML(c.rating) + '">\n' : '') +
      badgeHTML +
      '  <h2 class="club-name" itemprop="name">' + escapeHTML(c.name) + '</h2>\n' +
      ratingHTML +
      addressHTML +
      phoneHTML +
      descHTML +
      linksHTML +
      socialHTML +
      '</div>\n\n';
  }

  // ItemList schema
  var itemListItems = clubs.map(function(c, idx) {
    return '{"@type":"ListItem","position":' + (idx + 1) + ',"name":"' + c.name.replace(/"/g, '\\"') + '"}';
  }).join(",\n      ");

  var html = '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '  <!-- Google tag (gtag.js) -->\n' +
    '  <script async src="https://www.googletagmanager.com/gtag/js?id=' + GA4_ID + '"></script>\n' +
    '  <script>\n' +
    '    window.dataLayer = window.dataLayer || [];\n' +
    '    function gtag(){dataLayer.push(arguments);}\n' +
    '    gtag(\'js\', new Date());\n' +
    '    gtag(\'config\', \'' + GA4_ID + '\');\n' +
    '  </script>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <title>' + count + ' Track Clubs in ' + escapeHTML(stateName) + ' — Find Clubs Near You | TrackClubFinder</title>\n' +
    '  <meta name="description" content="Find ' + count + ' track clubs and running clubs in ' + escapeHTML(stateName) + (topCities.length ? ' — ' + topCities.join(', ') + ' &amp; more' : '') + '. Phone numbers, websites, ratings, and Athletic.net race results.">\n' +
    '  <meta name="robots" content="index, follow">\n' +
    '  <link rel="canonical" href="' + SITE_DOMAIN + '/' + stateSlug + '/">\n' +
    '  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">\n' +
    '  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n' +
    '  <meta property="og:title" content="' + count + ' Track Clubs in ' + escapeHTML(stateName) + ' | TrackClubFinder">\n' +
    '  <meta property="og:description" content="Find ' + count + ' track and running clubs in ' + escapeHTML(stateName) + (topCities.length ? ' — ' + topCities.join(', ') + ' &amp; more' : '') + '.">\n' +
    '  <meta property="og:url" content="' + SITE_DOMAIN + '/' + stateSlug + '/">\n' +
    '  <meta property="og:type" content="website">\n' +
    '  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;500;600&display=swap">\n' +
    '  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;500;600&display=swap" media="print" onload="this.media=\'all\'">\n' +
    '  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;500;600&display=swap"></noscript>\n' +
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
    (function() {
      var stateIdx = stateAbbr.charCodeAt(0) + stateAbbr.charCodeAt(1);
      var variant = stateIdx % 3;
      var schemaFaqs = [];
      schemaFaqs.push('{"@type":"Question","name":"How many track clubs are in ' + escapeHTML(stateName) + '?","acceptedAnswer":{"@type":"Answer","text":"We list ' + count + ' track and running clubs in ' + escapeHTML(stateName) + ', including youth programs, adult clubs, and competitive teams."}}');
      if (count > 50) {
        schemaFaqs.push('{"@type":"Question","name":"How do I narrow down ' + count + ' clubs to find the right one?","acceptedAnswer":{"@type":"Answer","text":"Use the search filter to type your city name. Then compare Google ratings and visit each club website to check programs, fees, and schedules."}}');
      } else {
        schemaFaqs.push('{"@type":"Question","name":"How do I find a track club near me in ' + escapeHTML(stateName) + '?","acceptedAnswer":{"@type":"Answer","text":"Use the search filter to type your city or club name. All ' + count + ' listings include addresses, phone numbers, and website links."}}');
      }
      if (variant === 0) {
        schemaFaqs.push('{"@type":"Question","name":"What is the difference between a track club and a running club?","acceptedAnswer":{"@type":"Answer","text":"Track clubs train on a track with coaches and compete at organized meets. Running clubs are more casual, focused on group road runs and social running."}}');
        schemaFaqs.push('{"@type":"Question","name":"How do I check race results for ' + escapeHTML(stateName) + ' athletes?","acceptedAnswer":{"@type":"Answer","text":"Athletic.net tracks results for track and cross country meets across the US. Each club listing has a link to search for that club on Athletic.net."}}');
      } else if (variant === 1) {
        schemaFaqs.push('{"@type":"Question","name":"Do track clubs in ' + escapeHTML(stateName) + ' accept beginners?","acceptedAnswer":{"@type":"Answer","text":"Most do. Many clubs have beginner-friendly groups or trial periods where you can attend a few practices before committing."}}');
        schemaFaqs.push('{"@type":"Question","name":"What should I look for when choosing a club?","acceptedAnswer":{"@type":"Answer","text":"Coaching credentials, training schedule, fees, and culture. Check the club website, read reviews, and attend a practice before signing up."}}');
      } else {
        schemaFaqs.push('{"@type":"Question","name":"How much does it cost to join a track club?","acceptedAnswer":{"@type":"Answer","text":"Youth clubs typically charge $50 to $200 per season. Adult clubs range from free to $400 per year. Ask for the full breakdown before signing up."}}');
        schemaFaqs.push('{"@type":"Question","name":"Are these clubs USATF sanctioned?","acceptedAnswer":{"@type":"Answer","text":"Some are, some are not. USATF-sanctioned clubs have background-checked coaches and liability insurance. Check each club website or call to confirm."}}');
      }
      return '  <script type="application/ld+json">\n' +
        '  {\n' +
        '    "@context": "https://schema.org",\n' +
        '    "@type": "FAQPage",\n' +
        '    "mainEntity": [\n      ' + schemaFaqs.join(',\n      ') + '\n    ]\n' +
        '  }\n' +
        '  </script>\n';
    })() +
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
    '    <h1>Find Track Clubs Near You in ' + escapeHTML(stateName) + '</h1>\n' +
    '    <p class="hero-sub">' + count + ' track club' + (count !== 1 ? 's' : '') + ' and running club' + (count !== 1 ? 's' : '') + ' near you in ' + escapeHTML(stateName) + (topCities.length ? ', including ' + topCities.join(', ') : '') + '. Browse phone numbers, websites, Google ratings, and links to race results on Athletic.net.</p>\n' +
    '    <div class="state-stats">\n' +
    '      <div class="state-stat"><strong>' + count + '</strong><span>Clubs Listed</span></div>\n' +
    '      <div class="state-stat"><strong>' + stateAbbr + '</strong><span>' + escapeHTML(stateName) + '</span></div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</section>\n\n' +

    '<!-- Club Listings -->\n' +
    '<section class="listings-section">\n' +
    '  <div class="section-inner">\n' +
    '    <div class="section-label">Directory</div>\n' +
    '    <h2 class="section-title">All Track &amp; Running Clubs in ' + escapeHTML(stateName) + '</h2>\n' +
    '    <div class="filter-bar">\n' +
    '      <input type="text" id="club-filter" class="club-filter" placeholder="Filter by city or club name\u2026" aria-label="Filter clubs">\n' +
    '      <span id="filter-count" class="filter-count">' + count + ' clubs</span>\n' +
    '    </div>\n' +
    '    <div class="clubs-grid">\n' +
    listingsHTML +
    '    </div>\n' +
    '  </div>\n' +
    '</section>\n\n' +

    gearSectionHTML() +

    (function() {
      var neighbors = STATE_NEIGHBORS[stateAbbr] || [];
      if (!neighbors.length) return '';
      var links = neighbors.map(function(abbr) {
        var name = STATE_NAMES[abbr] || abbr;
        var nslug = slugify(name);
        var neighborState = allStates[abbr];
        var ncount = neighborState ? neighborState.clubs.length : '';
        return '    <a class="nearby-link" href="/' + nslug + '/">' + escapeHTML(name) + (ncount ? ' <span class="nearby-count">(' + ncount + ')</span>' : '') + '</a>';
      }).join('\n');
      return '<!-- Nearby States -->\n' +
        '<section class="nearby-section">\n' +
        '  <div class="section-inner">\n' +
        '    <h2 class="nearby-title">Nearby States</h2>\n' +
        '    <div class="nearby-links">\n' +
        links + '\n' +
        '    </div>\n' +
        '  </div>\n' +
        '</section>\n\n';
    })() +

    (function() {
      // Vary FAQ content across states to avoid identical templated feel
      var faqs = [];
      // Q1: always include count (unique per state)
      faqs.push('<details><summary>How many track clubs are in ' + escapeHTML(stateName) + '?</summary><p>We currently list ' + count + ' track and running clubs in ' + escapeHTML(stateName) + (topCities.length ? ', including clubs in ' + topCities.join(', ') : '') + '. The directory covers youth programs, adult recreational clubs, and competitive teams.</p></details>');
      // Q2: varies by state count
      if (count > 50) {
        faqs.push('<details><summary>How do I narrow down ' + count + ' clubs to find the right one?</summary><p>Use the search filter at the top of the listings to type your city name. That will cut the list down fast. From there, check Google ratings and visit each club\'s website to compare programs, fees, and schedules.</p></details>');
      } else {
        faqs.push('<details><summary>How do I find a track club near me in ' + escapeHTML(stateName) + '?</summary><p>Use the search filter above to type your city or club name. You can also scroll through all ' + count + ' listings, each one has an address, phone number, and website link so you can reach out directly.</p></details>');
      }
      // Q3: rotate between 3 different questions based on state index
      var stateIdx = stateAbbr.charCodeAt(0) + stateAbbr.charCodeAt(1);
      var variant = stateIdx % 3;
      if (variant === 0) {
        faqs.push('<details><summary>What is the difference between a track club and a running club?</summary><p>Track clubs train on a track with coaches and compete at organized meets. Running clubs are more casual, focused on group road runs and social running. Some clubs in ' + escapeHTML(stateName) + ' do both. We have a <a href="/track-vs-running-club/">full comparison guide</a> if you want the details.</p></details>');
      } else if (variant === 1) {
        faqs.push('<details><summary>Do track clubs in ' + escapeHTML(stateName) + ' accept beginners?</summary><p>Most do. Many clubs have beginner-friendly groups, intro programs, or trial periods where you can attend a few practices before committing. Call the club directly and ask. The worst they can say is that they are full.</p></details>');
      } else {
        faqs.push('<details><summary>How much does it cost to join a track club?</summary><p>It varies. Youth clubs in ' + escapeHTML(stateName) + ' typically charge $50 to $200 per season. Adult clubs range from free to $400 per year. Some fees include USATF membership and meet entries, others do not. Always ask for the full breakdown before signing up.</p></details>');
      }
      // Q4: rotate a second set
      if (variant === 0) {
        faqs.push('<details><summary>How do I check race results for ' + escapeHTML(stateName) + ' athletes?</summary><p>Athletic.net tracks results for track and cross country meets across the US. Each club listing on this page has a link to search Athletic.net for that club\'s athletes and recent performances.</p></details>');
      } else if (variant === 1) {
        faqs.push('<details><summary>What should I look for when choosing a club?</summary><p>Coaching credentials, training schedule, fees, and culture. We wrote a <a href="/choosing-a-club/">complete guide to choosing a track club</a> that covers what to ask, what to look for, and red flags to avoid.</p></details>');
      } else {
        faqs.push('<details><summary>Are these clubs USATF sanctioned?</summary><p>Some are, some are not. USATF-sanctioned clubs have background-checked coaches and liability insurance. Check each club\'s website or call them to confirm. For youth athletes who want to compete at regional and national meets, USATF sanctioning is important.</p></details>');
      }
      return '<!-- FAQ -->\n' +
        '<section class="faq-section">\n' +
        '  <div class="section-inner">\n' +
        '    <div class="section-label">FAQ</div>\n' +
        '    <h2 class="section-title">Questions About Track Clubs in ' + escapeHTML(stateName) + '</h2>\n' +
        '    <div class="faq-list">\n      ' + faqs.join('\n      ') + '\n' +
        '    </div>\n' +
        '  </div>\n' +
        '</section>\n\n';
    })() +

    '<!-- CTA -->\n' +
    '<section class="cta-section">\n' +
    '  <h2>Browse Other States</h2>\n' +
    '  <p>Find track clubs in all 50 states.</p>\n' +
    '  <a class="btn" href="/#browse">Back to State Directory</a>\n' +
    '</section>\n\n' +

    '</main>\n\n' +
    footerHTML() +
    '\n<script>\n' +
    '(function(){\n' +
    '  var input=document.getElementById("club-filter");\n' +
    '  var countEl=document.getElementById("filter-count");\n' +
    '  var cards=document.querySelectorAll(".club-card");\n' +
    '  var total=cards.length;\n' +
    '  input.addEventListener("input",function(){\n' +
    '    var q=this.value.toLowerCase().trim();\n' +
    '    var visible=0;\n' +
    '    for(var i=0;i<cards.length;i++){\n' +
    '      var name=cards[i].querySelector(".club-name").textContent.toLowerCase();\n' +
    '      var addr=cards[i].querySelector(".club-address");\n' +
    '      var loc=addr?addr.textContent.toLowerCase():"";\n' +
    '      var show=!q||name.indexOf(q)!==-1||loc.indexOf(q)!==-1;\n' +
    '      cards[i].style.display=show?"":"none";\n' +
    '      if(show)visible++;\n' +
    '    }\n' +
    '    countEl.textContent=visible+(visible===1?" club":" clubs")+(q?" found":"");\n' +
    '  });\n' +
    '})();\n' +
    '</script>\n' +
    '</body>\n</html>\n';

  return html;
}

// ── Sitemap ───────────────────────────────────────────────────────────────────

function generateSitemap(states) {
  var today = new Date().toISOString().slice(0, 10);
  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '  <url><loc>' + SITE_DOMAIN + '/</loc><lastmod>' + today + '</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n' +
    '  <url><loc>' + SITE_DOMAIN + '/submit/</loc><lastmod>' + today + '</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>\n' +
    '  <url><loc>' + SITE_DOMAIN + '/essentials/</loc><lastmod>' + today + '</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n' +
    '  <url><loc>' + SITE_DOMAIN + '/guide/</loc><lastmod>' + today + '</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n' +
    '  <url><loc>' + SITE_DOMAIN + '/choosing-a-club/</loc><lastmod>' + today + '</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n' +
    '  <url><loc>' + SITE_DOMAIN + '/track-vs-running-club/</loc><lastmod>' + today + '</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n';

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
    fs.writeFileSync(path.join(dir, "index.html"), generateStatePage(state, states));
    pagesCreated++;
    console.log("  " + state.name + " (" + state.abbr + "): " + state.clubs.length + " clubs");
  }

  var sitemap = generateSitemap(states);
  fs.writeFileSync(SITEMAP_FILE, sitemap);

  console.log("\nDone! Created " + pagesCreated + " state pages + sitemap.xml");
  console.log("Next: git add -A && git commit && git push");
}

build();
