#!/usr/bin/env node
/**
 * Checks the Google Sheets connection and says exactly what to do next.
 *
 * Run it after each step of the service-account setup — it's written to be
 * useful when things are only half-configured, since that's most of the way
 * through.
 *
 *   npm run check:sheet
 */

import { readFileSync, existsSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

const KEY_FILE = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "./service-account.json";
const SHEET_ID = process.env.SHEET_ID ?? "";
// Defaults mirror lib/*.ts, so this checks the same ranges the board reads.
const RANGES = {
  Vervangingen: process.env.SHEET_RANGE ?? "Vervangingen!A1:J400",
  Sleutels: process.env.KEYS_SHEET_RANGE ?? "Sleutels!A1:H200",
};

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const info = (m) => console.log(`    ${m}`);
const step = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);

if (!SHEET_ID) {
  bad("SHEET_ID is not set.");
  info("Set SHEET_ID in .env.local (the long id from the sheet's URL),");
  info("then run this again: npm run check:sheet");
  process.exit(1);
}

step("1. Service-account key");
if (!existsSync(KEY_FILE)) {
  bad(`No key file at ${KEY_FILE}`);
  info("Create a service account in Google Cloud Console, add a JSON key,");
  info("and save it here as service-account.json. See README.");
  process.exit(1);
}

let key;
try {
  key = JSON.parse(readFileSync(KEY_FILE, "utf8"));
} catch (e) {
  bad(`${KEY_FILE} isn't valid JSON: ${e.message}`);
  process.exit(1);
}
if (key.type !== "service_account" || !key.client_email) {
  bad("That file isn't a service-account key (no client_email).");
  info("Download the JSON key from the service account's Keys tab.");
  process.exit(1);
}
ok(`Key found — project ${key.project_id}`);

step("2. Share the sheet with this address (Viewer is enough)");
console.log(`\n    \x1b[36m${key.client_email}\x1b[0m\n`);

step("3. Reading the sheet");
let token;
try {
  const auth = new GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  token = (await (await auth.getClient()).getAccessToken()).token;
  ok("Authenticated");
} catch (e) {
  bad(`Could not authenticate: ${e.message}`);
  process.exit(1);
}

async function readTab(name, range) {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SHEET_ID)}` +
    `/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.text();

  if (res.ok) return JSON.parse(body).values ?? [];

  if (res.status === 403 && /has not been used in project|is disabled/i.test(body)) {
    bad(`${name}: the Google Sheets API isn't enabled on this project.`);
    info("Enable it: https://console.cloud.google.com/apis/library/sheets.googleapis.com");
    info(`(project ${key.project_id})`);
  } else if (res.status === 403) {
    bad(`${name}: no permission to read the sheet.`);
    info(`Share it with ${key.client_email} as Viewer.`);
    info("If your Workspace blocks sharing outside the domain, see README.");
  } else if (res.status === 404) {
    bad(`${name}: no sheet with id ${SHEET_ID}.`);
  } else if (res.status === 400 && /Unable to parse range/i.test(body)) {
    return null; // tab absent
  } else {
    bad(`${name}: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  return undefined;
}

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: process.env.TIMEZONE ?? "Europe/Brussels",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const subs = await readTab("Vervangingen", RANGES.Vervangingen);
if (Array.isArray(subs)) {
  ok(`Vervangingen: ${subs.length} rows`);
  const header = subs.find((r) =>
    r?.some((c) => (c ?? "").toLowerCase().includes("lesuur")),
  );
  if (header) {
    ok(`Header found: ${header.filter(Boolean).join(" | ")}`);
    const dateCol = header.findIndex((c) =>
      (c ?? "").toLowerCase().includes("datum"),
    );
    const todays = subs.filter((r) => (r?.[dateCol] ?? "").trim() === today);
    if (todays.length) ok(`${todays.length} row(s) dated today (${today})`);
    else
      info(
        `No rows dated today (${today}) — the board will correctly show none.`,
      );
  } else {
    bad("No 'Lesuur' header found in the first rows.");
  }
}

const keys = await readTab("Sleutels", RANGES.Sleutels);
if (keys === null) {
  bad("Sleutels: tab doesn't exist yet (the key feature stays dormant).");
  info("Add a tab named 'Sleutels' with this header row:");
  info("Klas | Leerling | Ophalen | Opgehaald | Terugbrengen | Teruggebracht");
} else if (Array.isArray(keys)) {
  ok(`Sleutels: ${keys.length} rows`);
}

if (Array.isArray(subs)) {
  step("Next");
  info("All set — (re)start the dev server and the board reads this sheet.");
}
