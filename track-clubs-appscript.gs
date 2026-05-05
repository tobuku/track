/**
 * TrackClubFinder.com — Outscraper Automation for Track Club Directory
 *
 * Paste this entire file into your Google Apps Script editor
 * (Extensions > Apps Script in your Google Sheet).
 *
 * Setup:
 *   1. Paste this script into Apps Script.
 *   2. Click Save.
 *   3. Run main() manually the first time.
 *   4. If it times out (6-min limit), just run main() again — it resumes.
 *   5. Call resetProgress() to start over from the beginning.
 *
 * Rate limits:
 *   - 2-second delay between API calls
 *   - Outscraper free tier: 500 places/month, then $3/1,000
 *
 * Queries:
 *   - 2 queries per state (track club + running club) = 100 total queries
 *   - 20 results per query = up to 2,000 listings before dedup
 */

// ── Configuration ─────────────────────────────────────────────────────────────

var CONFIG = {
  OUTSCRAPER_API_KEY: "MjVjMTU4YmYxNzdlNGZlNGEzZjI4N2U0NzA4Y2Y4OTd8MjNlYzYwOTdmZg",
  SHEET_NAME: "track-club-directory",
  RESULTS_PER_QUERY: 20,
  DELAY_MS: 2000
};

/**
 * Two queries per US state: "track club" and "running club"
 * for broad national coverage across both naming conventions.
 */
var SEARCH_QUERIES = [
  "track club, Alabama", "running club, Alabama",
  "track club, Alaska", "running club, Alaska",
  "track club, Arizona", "running club, Arizona",
  "track club, Arkansas", "running club, Arkansas",
  "track club, California", "running club, California",
  "track club, Colorado", "running club, Colorado",
  "track club, Connecticut", "running club, Connecticut",
  "track club, Delaware", "running club, Delaware",
  "track club, Florida", "running club, Florida",
  "track club, Georgia", "running club, Georgia",
  "track club, Hawaii", "running club, Hawaii",
  "track club, Idaho", "running club, Idaho",
  "track club, Illinois", "running club, Illinois",
  "track club, Indiana", "running club, Indiana",
  "track club, Iowa", "running club, Iowa",
  "track club, Kansas", "running club, Kansas",
  "track club, Kentucky", "running club, Kentucky",
  "track club, Louisiana", "running club, Louisiana",
  "track club, Maine", "running club, Maine",
  "track club, Maryland", "running club, Maryland",
  "track club, Massachusetts", "running club, Massachusetts",
  "track club, Michigan", "running club, Michigan",
  "track club, Minnesota", "running club, Minnesota",
  "track club, Mississippi", "running club, Mississippi",
  "track club, Missouri", "running club, Missouri",
  "track club, Montana", "running club, Montana",
  "track club, Nebraska", "running club, Nebraska",
  "track club, Nevada", "running club, Nevada",
  "track club, New Hampshire", "running club, New Hampshire",
  "track club, New Jersey", "running club, New Jersey",
  "track club, New Mexico", "running club, New Mexico",
  "track club, New York", "running club, New York",
  "track club, North Carolina", "running club, North Carolina",
  "track club, North Dakota", "running club, North Dakota",
  "track club, Ohio", "running club, Ohio",
  "track club, Oklahoma", "running club, Oklahoma",
  "track club, Oregon", "running club, Oregon",
  "track club, Pennsylvania", "running club, Pennsylvania",
  "track club, Rhode Island", "running club, Rhode Island",
  "track club, South Carolina", "running club, South Carolina",
  "track club, South Dakota", "running club, South Dakota",
  "track club, Tennessee", "running club, Tennessee",
  "track club, Texas", "running club, Texas",
  "track club, Utah", "running club, Utah",
  "track club, Vermont", "running club, Vermont",
  "track club, Virginia", "running club, Virginia",
  "track club, Washington", "running club, Washington",
  "track club, West Virginia", "running club, West Virginia",
  "track club, Wisconsin", "running club, Wisconsin",
  "track club, Wyoming", "running club, Wyoming"
];

// ── State name → 2-letter code lookup ────────────────────────────────────────

var STATE_ABBREVS = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
  "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
  "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
  "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
  "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE",
  "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR",
  "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
  "vermont": "VT", "virginia": "VA", "washington": "WA",
  "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
  "district of columbia": "DC"
};

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Resumes from where it left off using PropertiesService.
 * Run multiple times until all queries are done.
 * Call resetProgress() to start over from the beginning.
 */
function main() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    throw new Error("Sheet '" + CONFIG.SHEET_NAME + "' not found. Create a sheet with that exact name first.");
  }

  // Write header row if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "business_name", "street_address", "city", "state", "zip",
      "phone", "website", "google_rating", "review_count",
      "hours_monday", "hours_tuesday", "hours_wednesday",
      "hours_thursday", "hours_friday", "hours_saturday", "hours_sunday",
      "latitude", "longitude"
    ]);
  }

  var props = PropertiesService.getScriptProperties();
  var startIndex = parseInt(props.getProperty("lastCompletedQuery") || "-1", 10) + 1;

  if (startIndex >= SEARCH_QUERIES.length) {
    Logger.log("All " + SEARCH_QUERIES.length + " queries already completed. Call resetProgress() to start over.");
    return;
  }

  Logger.log("Resuming from query " + (startIndex + 1) + "/" + SEARCH_QUERIES.length);

  var existingRows = getExistingRows(sheet);
  var added = 0;

  for (var i = startIndex; i < SEARCH_QUERIES.length; i++) {
    var query = SEARCH_QUERIES[i];
    Logger.log("Query " + (i + 1) + "/" + SEARCH_QUERIES.length + ": " + query);

    var places = fetchOutscraper(query);
    if (!places || places.length === 0) {
      Logger.log("  No results.");
      props.setProperty("lastCompletedQuery", String(i));
      continue;
    }

    for (var j = 0; j < places.length; j++) {
      var row = mapToRow(places[j]);
      if (!row) continue;

      var businessName = row[0];
      var phone = row[5];
      var address = row[1];

      if (isDuplicate(existingRows, businessName, phone, address)) continue;

      sheet.appendRow(row);
      existingRows.push({ businessName: businessName, phone: phone, address: address });
      added++;
    }

    props.setProperty("lastCompletedQuery", String(i));

    if (i < SEARCH_QUERIES.length - 1) {
      Utilities.sleep(CONFIG.DELAY_MS);
    }
  }

  Logger.log("Done. Added " + added + " new rows. Completed all " + SEARCH_QUERIES.length + " queries.");
}

/**
 * Resets progress so main() starts from the first query again.
 */
function resetProgress() {
  PropertiesService.getScriptProperties().deleteProperty("lastCompletedQuery");
  Logger.log("Progress reset. Next main() run will start from query 1.");
}

// ── Fill Missing Phones ───────────────────────────────────────────────────────

/**
 * Re-queries Outscraper for rows missing phone numbers.
 * Resumes from where it left off. Run multiple times if it times out.
 */
function fillMissingPhones() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    throw new Error("Sheet '" + CONFIG.SHEET_NAME + "' not found.");
  }

  var props = PropertiesService.getScriptProperties();
  var lastProcessed = parseInt(props.getProperty("lastPhoneRow") || "1", 10);
  var lastRow = sheet.getLastRow();
  var phoneCol = 6;
  var updated = 0;
  var skipped = 0;

  Logger.log("Filling missing phones starting from row " + (lastProcessed + 1));

  for (var row = lastProcessed + 1; row <= lastRow; row++) {
    var phone = sheet.getRange(row, phoneCol).getValue();

    if (phone && String(phone).trim() !== "") {
      skipped++;
      props.setProperty("lastPhoneRow", String(row));
      continue;
    }

    var name  = sheet.getRange(row, 1).getValue();
    var city  = sheet.getRange(row, 3).getValue();
    var state = sheet.getRange(row, 4).getValue();

    if (!name) {
      props.setProperty("lastPhoneRow", String(row));
      continue;
    }

    var query = name + ", " + city + ", " + state;
    Logger.log("Row " + row + ": Looking up " + query);

    var places = fetchOutscraper(query);

    if (places && places.length > 0) {
      var foundPhone = (places[0].phone || "").trim().replace(/^\+/, "");
      if (foundPhone) {
        sheet.getRange(row, phoneCol).setValue(foundPhone);
        updated++;
        Logger.log("  Found: " + foundPhone);
      } else {
        Logger.log("  No phone in result.");
      }
    } else {
      Logger.log("  No results.");
    }

    props.setProperty("lastPhoneRow", String(row));
    Utilities.sleep(CONFIG.DELAY_MS);
  }

  Logger.log("Done. Updated " + updated + " phones. Skipped " + skipped + " (already had phone).");
}

function resetPhoneProgress() {
  PropertiesService.getScriptProperties().deleteProperty("lastPhoneRow");
  Logger.log("Phone progress reset. Next fillMissingPhones() run will start from row 2.");
}

// ── Outscraper API ────────────────────────────────────────────────────────────

function fetchOutscraper(query) {
  var url = "https://api.app.outscraper.com/maps/search-v3"
    + "?query=" + encodeURIComponent(query)
    + "&limit=" + CONFIG.RESULTS_PER_QUERY
    + "&async=false";

  var options = {
    method: "get",
    headers: { "X-API-KEY": CONFIG.OUTSCRAPER_API_KEY },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code !== 200) {
    Logger.log("  API error " + code + ": " + response.getContentText().substring(0, 200));
    return [];
  }

  var json = JSON.parse(response.getContentText());

  if (json.data && json.data.length > 0 && Array.isArray(json.data[0])) {
    return json.data[0];
  }
  return [];
}

// ── Row mapping ───────────────────────────────────────────────────────────────

/**
 * Maps an Outscraper place object to a sheet row.
 * Column order:
 *   business_name, street_address, city, state, zip,
 *   phone, website, google_rating, review_count,
 *   hours_monday–sunday, latitude, longitude
 */
function mapToRow(place) {
  if (!place || !place.name) return null;

  var state = normalizeState(place.us_state || place.state || "");
  var hours = parseHours(place.working_hours);

  return [
    safeString(place.name).trim(),
    safeString(place.street || place.full_address).trim(),
    safeString(place.city).trim(),
    state,
    safeString(place.postal_code).toString().trim(),
    safeString(place.phone).trim().replace(/^\+/, ""),
    safeString(place.site).trim(),
    safeString(place.rating),
    safeString(place.reviews),
    hours[0], hours[1], hours[2], hours[3],
    hours[4], hours[5], hours[6],
    safeString(place.latitude),
    safeString(place.longitude)
  ];
}

function safeString(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return val;
  try { return JSON.stringify(val); } catch (e) { return ""; }
}

function parseHours(workingHours) {
  var result = ["", "", "", "", "", "", ""];
  if (!workingHours) return result;

  var hoursStr = "";
  try { hoursStr = JSON.stringify(workingHours); } catch (e) { return result; }

  var hoursObj = JSON.parse(hoursStr);
  var days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  if (hoursObj && typeof hoursObj === "object" && !Array.isArray(hoursObj)) {
    for (var i = 0; i < days.length; i++) {
      var val = hoursObj[days[i]];
      if (val) result[i] = (typeof val === "string") ? val : JSON.stringify(val);
    }
    return result;
  }

  if (Array.isArray(hoursObj)) {
    result[0] = hoursStr;
    return result;
  }

  return result;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function getExistingRows(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 18).getValues();
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    rows.push({
      businessName: String(data[i][0]).trim().toLowerCase(),
      phone: String(data[i][5]).trim(),
      address: String(data[i][1]).trim().toLowerCase()
    });
  }
  return rows;
}

function isDuplicate(existingRows, businessName, phone, address) {
  var n = (businessName || "").trim().toLowerCase();
  var p = (phone || "").trim();
  var a = (address || "").trim().toLowerCase();

  if (!n && !p && !a) return false;

  for (var i = 0; i < existingRows.length; i++) {
    var row = existingRows[i];
    if (n && row.businessName && n === row.businessName) return true;
    if (p && row.phone && p === row.phone) return true;
    if (a && row.address && a === row.address) return true;
  }
  return false;
}

// ── State normalization ───────────────────────────────────────────────────────

function normalizeState(raw) {
  if (!raw) return "";
  var trimmed = raw.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  var key = trimmed.toLowerCase();
  if (STATE_ABBREVS[key]) return STATE_ABBREVS[key];
  return trimmed.toUpperCase().substring(0, 2);
}
