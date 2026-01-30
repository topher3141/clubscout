"use client";

import * as React from "react";
import Image from "next/image";

type Mode = "upc" | "item";

type LookupResult = {
  description: string;
  itemNumber: string;
  category: string;
  retail: number;
  tier1: number;
  tier2: number;
  upcNumber: string;
};

const BRAND = {
  bg: "#050B10",
  panel: "rgba(10, 22, 30, 0.55)",
  panel2: "rgba(7, 15, 22, 0.55)",
  border: "rgba(255,255,255,0.10)",
  teal: "#0D6E7F",
  cream: "#EFE6DC",
  magenta: "#D3457B",
  magenta2: "#B63767",
  text: "#EAF2F6",
  muted: "rgba(234,242,246,0.65)"
};

function money2(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function money0(n: number) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

/**
 * Scanner-friendly auto-search:
 * - Most scanners type digits fast then send Enter
 * - We search on Enter
 * - AND we search after a short pause if input looks like UPC
 */
function useScannerAutoSearch(opts: { value: string; mode: Mode; onSearch: () => void }) {
  const { value, mode, onSearch } = opts;
  const lastChangeAt = React.useRef<number>(0);
  const timer = React.useRef<number | null>(null);

  React.useEffect(() => {
    lastChangeAt.current = Date.now();
    if (timer.current) window.clearTimeout(timer.current);

    if (mode !== "upc") return;

    const digits = value.replace(/\D/g, "");
    const looksLikeUpc =
      digits.length === 12 || digits.length === 13 || digits.length === 11 || digits.length === 10;

    if (!looksLikeUpc) return;

    timer.current = window.setTimeout(() => {
      if (Date.now() - lastChangeAt.current >= 160) onSearch();
    }, 200);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [value, mode, onSearch]);
}

function InfoBox({
  label,
  value,
  mono,
  span
}: {
  label: string;
  value: string;
  mono?: boolean;
  span?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${span ? "col-span-2" : ""}`}
      style={{ borderColor: BRAND.border, background: BRAND.panel2 }}
    >
      <div className="text-[11px] font-semibold" style={{ color: BRAND.muted }}>
        {label}
      </div>
      <div className={`mt-1 text-sm font-bold ${mono ? "font-mono" : ""}`} style={{ color: BRAND.text }}>
        {value || "—"}
      </div>
    </div>
  );
}

export default function Page() {
  // Ultra-only UI: no ultra toggle, always-on condensed layout.
  const [mode, setMode] = React.useState<Mode>("upc");
  const [query, setQuery] = React.useState("");
  const [scanMode, setScanMode] = React.useState(true);

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const focusInput = React.useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const [loading, setLoading] = React.useState(false);
  const [found, setFound] = React.useState<boolean | null>(null);
  const [searched, setSearched] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<LookupResult | null>(null);

// Apparel category exact matches (must match sheet Category description exactly)
const APPAREL_CATEGORIES = new Set([
  "MENS APPAREL",
  "BASIC APPAREL",
  "ACCESSORIES",
  "LADIES APPAREL",
  "CHILDRENS APPAREL"
]);

function calcApparelPrice(retail: number) {
  // Brackets based on Retail per Unit
  if (retail <= 15.99) return 6;
  if (retail <= 22.99) return 8;
  if (retail <= 27.99) return 10;
  if (retail <= 30.99) return 12;
  if (retail <= 36.99) return 15;
  if (retail <= 44.99) return 20;
  return 25; // 50+
}

// Pricing math (UI is source of truth for rounding rules)
const retail = result?.retail ?? 0;

// tier rules
const tier1Rounded = Math.round(retail * 0.7); // nearest dollar
const tier2Rounded = Math.ceil(retail * 0.5); // always round up

// apparel rules
const isApparel = !!result?.category && APPAREL_CATEGORIES.has(result.category.trim());
const apparelPrice = isApparel ? calcApparelPrice(retail) : null;


  const doSearch = React.useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setFound(null);
    setResult(null);
    setSearched(null);

    try {
      const url = `/api/search?type=${mode === "item" ? "item" : "upc"}&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Search failed");
        setLoading(false);
        return;
      }

      if (data.searched) setSearched(data.searched);

      if (!data.found) {
        setFound(false);
        setLoading(false);
        return;
      }

      setFound(true);
      setResult(data.result);
      setLoading(false);
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
      setLoading(false);
    } finally {
      // Clear and refocus for next scan/value
      setQuery("");
      focusInput();
    }
  }, [query, mode, focusInput]);

  useScannerAutoSearch({ value: query, mode, onSearch: doSearch });

  const clear = React.useCallback(() => {
    setQuery("");
    setError(null);
    setFound(null);
    setResult(null);
    setSearched(null);
    focusInput();
  }, [focusInput]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") doSearch();
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: `radial-gradient(1200px 600px at 10% 0%, rgba(13,110,127,0.22), transparent 55%),
                     radial-gradient(900px 500px at 95% 10%, rgba(211,69,123,0.18), transparent 52%),
                     ${BRAND.bg}`
      }}
    >
      {/* Header */}
      <header className="border-b backdrop-blur" style={{ borderColor: BRAND.border, background: "rgba(5,11,16,0.65)" }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 place-items-center rounded-2xl overflow-hidden"
              style={{
                background: `linear-gradient(180deg, rgba(239,230,220,0.10), rgba(239,230,220,0.04))`,
                border: `1px solid ${BRAND.border}`
              }}
            >
              <Image src="https://i.imgur.com/T6J8wW7.png" alt="ClubScout" width={36} height={36} priority />
            </div>
            <div>
              <div className="text-lg font-extrabold tracking-tight" style={{ color: BRAND.text }}>
                ClubScout
              </div>
              <div className="text-xs" style={{ color: BRAND.muted }}>
                Liquidation Lookup Tool
              </div>
            </div>
          </div>

          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              border: `1px solid rgba(13,110,127,0.55)`,
              background: "rgba(13,110,127,0.12)",
              color: "rgba(234,242,246,0.95)"
            }}
          >
            Internal
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-3 py-3">
        <div className="rounded-2xl border shadow-soft" style={{ borderColor: BRAND.border, background: BRAND.panel }}>
          {/* Top controls row */}
          <div className="p-3 pb-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-extrabold tracking-tight" style={{ color: BRAND.text }}>
                  Lookup
                </div>
              </div>

              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setMode("upc");
                      clear();
                    }}
                    className="rounded-xl px-3 py-2 text-sm font-semibold transition"
                    style={{
                      background: mode === "upc" ? BRAND.teal : "rgba(5,11,16,0.55)",
                      color: mode === "upc" ? "white" : "rgba(234,242,246,0.85)",
                      border: `1px solid ${mode === "upc" ? "rgba(13,110,127,0.70)" : BRAND.border}`
                    }}
                  >
                    UPC
                  </button>

                  <button
                    onClick={() => {
                      setMode("item");
                      clear();
                    }}
                    className="rounded-xl px-3 py-2 text-sm font-semibold transition"
                    style={{
                      background: mode === "item" ? BRAND.teal : "rgba(5,11,16,0.55)",
                      color: mode === "item" ? "white" : "rgba(234,242,246,0.85)",
                      border: `1px solid ${mode === "item" ? "rgba(13,110,127,0.70)" : BRAND.border}`
                    }}
                  >
                    ItemNumber
                  </button>
                </div>

                {mode === "upc" && (
                  <label className="flex select-none items-center gap-2 text-xs" style={{ color: BRAND.text }}>
                    <input
                      type="checkbox"
                      checked={scanMode}
                      onChange={(e) => {
                        setScanMode(e.target.checked);
                        focusInput();
                      }}
                      className="h-4 w-4"
                      style={{ accentColor: BRAND.magenta }}
                    />
                    Scan Mode (hide keyboard)
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="p-3 pt-2">
            {/* Item name (one line, slightly larger) */}
            <div className="mb-2">
              <div className="text-[15px] font-extrabold tracking-tight line-clamp-1" style={{ color: BRAND.text }}>
                {result?.description ? result.description : "Ready to scan."}
              </div>
              <div className="mt-0.5 text-xs" style={{ color: BRAND.muted }}>
                {result ? "Pricing snapshot" : mode === "upc" ? "Scan UPC or enter UPC" : "Enter ItemNumber"}
              </div>
            </div>

            {/* Pricing tiles (always visible) */}
 <div className="grid gap-2 grid-cols-2">
  {/* Retail always on top */}
  <div className="col-span-2 rounded-2xl border p-3" style={{ borderColor: BRAND.border, background: BRAND.panel2 }}>
    <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
      Retail
    </div>
    <div className="mt-1 text-2xl font-extrabold" style={{ color: BRAND.cream }}>
      {result ? money2(retail) : "—"}
    </div>
    <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
      Retail per Unit
    </div>
  </div>

  {/* Apparel Price ONLY when category matches */}
  {isApparel && (
    <div
      className="rounded-2xl border p-3"
      style={{
        borderColor: "rgba(239,230,220,0.28)",
        background: BRAND.panel2
      }}
    >
      <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
        Apparel Price
      </div>
      <div className="mt-1 text-2xl font-extrabold" style={{ color: BRAND.cream }}>
        {result ? money0(apparelPrice ?? 0) : "—"}
      </div>
      <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
        Category matrix
      </div>
    </div>
  )}

  {/* Tier 1 (kept even for apparel items) */}
  <div
    className="rounded-2xl border p-3"
    style={{ borderColor: "rgba(13,110,127,0.40)", background: BRAND.panel2 }}
  >
    <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
      Tier 1
    </div>
    <div className="mt-1 text-2xl font-extrabold text-green-300">
      {result ? money0(tier1Rounded) : "—"}
    </div>
    <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
      30% off (rounded)
    </div>
  </div>

  {/* Tier 2: if Apparel Price is showing, put Tier 2 full width on the next row */}
  <div
    className={(isApparel ? "col-span-2 " : "") + "rounded-2xl border p-3"}
    style={{ borderColor: "rgba(211,69,123,0.35)", background: BRAND.panel2 }}
  >
    <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
      Tier 2
    </div>
    <div className="mt-1 text-2xl font-extrabold text-yellow-300">
      {result ? money0(tier2Rounded) : "—"}
    </div>
    <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
      50% off (round up)
    </div>
  </div>
</div>


            {/* Error stays tight so it doesn't blow up layout */}
            {error && (
              <div
                className="mt-2 rounded-xl border p-3 text-sm"
                style={{
                  borderColor: "rgba(248,113,113,0.35)",
                  background: "rgba(127,29,29,0.25)",
                  color: "rgba(254,226,226,0.95)"
                }}
              >
                {error}
              </div>
            )}

            {/* Search controls */}
            <div className="mt-3 flex flex-col gap-2">
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={mode === "upc" ? "Scan or enter UPC..." : "Enter ItemNumber..."}
                inputMode={mode === "upc" && scanMode ? "none" : "numeric"}
                pattern="[0-9]*"
                className="w-full rounded-xl px-4 py-3 text-base focus:outline-none"
                style={{
                  border: `1px solid ${BRAND.border}`,
                  background: "rgba(3, 8, 12, 0.65)",
                  color: BRAND.text
                }}
              />

              <div className="flex gap-2">
                <button
                  onClick={doSearch}
                  disabled={loading || !query.trim()}
                  className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: `linear-gradient(180deg, ${BRAND.magenta}, ${BRAND.magenta2})`,
                    color: "white",
                    border: "1px solid rgba(211,69,123,0.55)"
                  }}
                >
                  {loading ? "Searching..." : "Search"}
                </button>

                <button
                  onClick={clear}
                  className="rounded-xl px-4 py-3 text-sm font-semibold transition"
                  style={{
                    background: "rgba(3, 8, 12, 0.65)",
                    color: "rgba(234,242,246,0.92)",
                    border: `1px solid ${BRAND.border}`
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Details below search (scroll if you want more) */}
            {result && (
              <div className="mt-3">
                <div className="text-xs font-semibold mb-2" style={{ color: BRAND.muted }}>
                  Details
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <InfoBox label="ItemNumber" value={result.itemNumber || "—"} />
                  <InfoBox label="UPC (sheet)" value={result.upcNumber || "—"} mono />
                  <InfoBox label="Category" value={result.category || "—"} span />
                  {searched && <InfoBox label="UPC key searched" value={searched} mono span />}
                </div>
              </div>
            )}

            {/* No-match message (kept small) */}
            {found === false && !error && (
              <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: BRAND.border, background: BRAND.panel2 }}>
                <div className="text-sm font-semibold" style={{ color: BRAND.text }}>
                  No match found
                </div>
                <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
                  Try scanning again or confirm the UPC / ItemNumber.
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
