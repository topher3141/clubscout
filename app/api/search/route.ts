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
 * Convert scanned/typed UPC into your manifest "alt ean13 style":
 * - UPC-A is 12 digits including check digit
 * - Manifest stores: "00" + first 11 digits (drops check digit)
 * Example: 193968502553 -> 0019396850255
 */
function upcToAltEan13(input: string): string | null {
  const d = digitsOnly(input);

  if (d.length === 12) return "00" + d.slice(0, 11);
  if (d.length === 11) return "00" + d;
  if (d.length === 13 && d.startsWith("00")) return d;

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
  let privateKey = requiredEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  privateKey = privateKey.replace(/\\n/g, "\n");

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
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const values = res.data.values || [];
  if (values.length < 2) return [];

  const header = values[0].map((h) => (h || "").toString().trim());
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const getAt = (row: any[], i: number) => (i >= 0 ? (row[i] ?? "").toString().trim() : "");

  const iImportDate = idx("Import Date");
  const iDescription = idx("Description");
  const iItemNumber = idx("ItemNumber");
  const iUpc = idx("UPC Number");
  const iCatDesc = idx("Category description");
  const iRetailPerUnit = idx("Retail per Unit");

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
      upcNumber: digitsOnly(upcNumber),
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

    if (!q) return NextResponse.json({ ok: false, error: "Missing query" }, { status: 400 });

    const rows = await getCachedRows();

    if (type === "item") {
      const match = rows.find((r) => r.itemNumber === q);
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

    const alt = upcToAltEan13(q);
    if (!alt) {
      return NextResponse.json(
        { ok: false, error: "UPC must be 12 digits (UPC-A) or 13 digits starting with 00." },
        { status: 400 }
      );
    }

    const match = rows.find((r) => r.upcNumber === alt);
    if (!match) return NextResponse.json({ ok: true, found: false, searched: alt });

    const retail = parseMoney(match.retailPerUnit);

    return NextResponse.json({
      ok: true,
      found: true,
      searched: alt,
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
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
