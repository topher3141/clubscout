import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function digitsOnly(input: string): string {
  return (input || "").replace(/\D/g, "");
}

/**
 * Convert scanned/typed UPC into the 11-digit "core" that matches your sheet.
 * - UPC-A scan is 12 digits including check digit -> drop last digit -> 11 digits
 * - If user enters 11 digits, accept directly
 * - If user enters 13 digits, strip leading zeros then drop check digit if needed
 */
function upcToCore11(input: string): string | null {
  let d = digitsOnly(input);

  // If someone pastes 13-digit EAN-ish, remove leading zeros first
  if (d.length === 13) d = d.replace(/^0+/, "");

  // UPC-A (12) -> core 11 (drop check digit)
  if (d.length === 12) return d.slice(0, 11);

  // Already core
  if (d.length === 11) return d;

  return null;
}


function parseMoney(val: any): number {
  const cleaned = (val ?? "").toString().replace(/[$,]/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getAuthClient() {
  const clientEmail = requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
let privateKey = requiredEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").trim();

// If you pasted with surrounding quotes in Vercel, remove them
if (
  (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
  (privateKey.startsWith("'") && privateKey.endsWith("'"))
) {
  privateKey = privateKey.slice(1, -1);
}

// Turn literal \n into real newlines + remove CR characters
privateKey = privateKey.replace(/\\n/g, "\n").replace(/\r/g, "");


  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });
}

type Row = {
  importDate: string;
  description: string;
  itemNumber: string;
  upcNumber: string;
  categoryDescription: string;
  retailPerUnit: string;
};

async function fetchRows(): Promise<Row[]> {
  const spreadsheetId = requiredEnv("GOOGLE_SHEETS_SPREADSHEET_ID");
  const tabName = process.env.GOOGLE_SHEETS_TAB_NAME || "data";

  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  // We read A:K because your sheet includes columns through "Retail per Unit"
  const range = `${tabName}!A1:K`;
const res = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range,
  valueRenderOption: "UNFORMATTED_VALUE"
});
  const values = res.data.values || [];
  if (values.length < 2) return [];

  const header = values[0].map((h) => (h || "").toString().trim());
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const idxAny = (names: string[]) =>
  names
    .map((n) => idx(n))
    .find((i) => typeof i === "number" && i >= 0) ?? -1;

  const getAt = (row: any[], i: number) => (i >= 0 ? (row[i] ?? "").toString().trim() : "");

  const iImportDate = idx("Import Date");
  const iDescription = idx("Description");
  const iItemNumber = idx("ItemNumber");
  const iUpc = idx("UPC Number");
  const iCatDesc = idx("Category description");
let iRetailPerUnit = idxAny([
  "Retail per Unit",
  "Retail per unit",
  "Retail per Unit (USD$)",
  "Retail per unit (USD$)",
  "Retail per Unit (USD)",
  "Retail per unit (USD)"
]);

// Fallback to column K (A=0 ... K=10) if header matching fails
if (iRetailPerUnit < 0) iRetailPerUnit = 10;

  const rows: Row[] = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r] || [];
    const itemNumber = getAt(row, iItemNumber);
    const upcNumber = getAt(row, iUpc);

    if (!itemNumber && !upcNumber) continue;

    rows.push({
      importDate: getAt(row, iImportDate),
      description: getAt(row, iDescription),
      itemNumber,
      upcNumber: digitsOnly(upcNumber).replace(/^0+/, ""),
      categoryDescription: getAt(row, iCatDesc),
      retailPerUnit: getAt(row, iRetailPerUnit)
    });
  }

  return rows;
}

// Tiny in-memory cache (helps speed + avoids hammering Sheets)
let cache: { at: number; rows: Row[] } | null = null;

async function getCachedRows() {
  const ttlSeconds = Number(process.env.SHEETS_CACHE_SECONDS || "30");
  const now = Date.now();
  if (cache && now - cache.at < ttlSeconds * 1000) return cache.rows;

  const rows = await fetchRows();
  cache = { at: now, rows };
  return rows;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") || "upc").toLowerCase();
    const q = (searchParams.get("q") || "").trim();
    const refresh = searchParams.get("refresh") === "1";
    const debug = searchParams.get("debug") === "1";


    if (!q) return NextResponse.json({ ok: false, error: "Missing query" }, { status: 400 });

    const rows = refresh ? await fetchRows() : await getCachedRows();

    if (type === "item") {
      const qItem = digitsOnly(q);
      const match = rows.find((r) => digitsOnly(r.itemNumber) === qItem);
      if (!match) return NextResponse.json({ ok: true, found: false });

      const retail = parseMoney(match.retailPerUnit);
      return NextResponse.json({
        ok: true,
        found: true,
        result: {
          description: match.description,
          itemNumber: match.itemNumber,
          category: match.categoryDescription,
          retail: roundMoney(retail),
          tier1: roundMoney(retail * 0.7),
          tier2: roundMoney(retail * 0.5),
          upcNumber: match.upcNumber
        }
      });
    }

const core = upcToCore11(q);
if (!core) {
  return NextResponse.json(
    { ok: false, error: "UPC must be 12 digits (UPC-A) or 11 digits (core without check digit)." },
    { status: 400 }
  );
}

const match = rows.find((r) => r.upcNumber === core);
if (!match) {
  return NextResponse.json({
    ok: true,
    found: false,
    searched: core,
    ...(debug
      ? {
          debug: {
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
            tabName: process.env.GOOGLE_SHEETS_TAB_NAME || "data",
            rowsLoaded: rows.length,
            sampleUpcFromFirstRow: rows[0]?.upcNumber || null,
            sampleRetailPerUnitFromFirstRow: rows[0]?.retailPerUnit || null
          }
        }
      : {})
  });
}


    const retail = parseMoney(match.retailPerUnit);

    return NextResponse.json({
      ok: true,
      found: true,
      searched: core,
      result: {
        description: match.description,
        itemNumber: match.itemNumber,
        category: match.categoryDescription,
          retailRaw: match.retailPerUnit,
        retail: roundMoney(retail),
        tier1: roundMoney(retail * 0.7),
        tier2: roundMoney(retail * 0.5),
        upcNumber: match.upcNumber
      }
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
