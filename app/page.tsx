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
  const [mode, setMode] = React.useState<Mode>("upc");
  const [query, setQuery] = React.useState("");
  const [scanMode, setScanMode] = React.useState(true);

  const [tier3Enabled, setTier3Enabled] = React.useState(false);
  const [tier3PromptOpen, setTier3PromptOpen] = React.useState(false);
  const [tier3Code, setTier3Code] = React.useState("");
  const [tier3Error, setTier3Error] = React.useState("");

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const focusInput = React.useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const tier3InputRef = React.useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [found, setFound] = React.useState<boolean | null>(null);
  const [searched, setSearched] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<LookupResult | null>(null);

  const APPAREL_CATEGORIES = new Set([
    "MENS APPAREL",
    "BASIC APPAREL",
    "ACCESSORIES",
    "LADIES APPAREL",
    "CHILDRENS APPAREL"
  ]);

  function calcApparelPrice(retail: number) {
    if (retail <= 15.99) return 6;
    if (retail <= 22.99) return 8;
    if (retail <= 27.99) return 10;
    if (retail <= 30.99) return 12;
    if (retail <= 39.99) return 15;
    if (retail <= 44.99) return 20;
    return 25;
  }

  const retail = result?.retail ?? 0;

  const tier1Rounded = Math.round(retail * 0.7);
  const tier2Rounded = Math.ceil(retail * 0.5);
  const tier3Rounded = Math.round(retail * 0.3); // 70% off retail

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

  const openTier3Prompt = () => {
    if (tier3Enabled) {
      setTier3Enabled(false);
      setTier3PromptOpen(false);
      setTier3Code("");
      setTier3Error("");
      focusInput();
      return;
    }

    setTier3PromptOpen(true);
    setTier3Code("");
    setTier3Error("");
    window.setTimeout(() => tier3InputRef.current?.focus(), 0);
  };

  const submitTier3Code = () => {
    if (tier3Code === "1997") {
      setTier3Enabled(true);
      setTier3PromptOpen(false);
      setTier3Code("");
      setTier3Error("");
      focusInput();
      return;
    }

    setTier3Error("Incorrect passcode");
    window.setTimeout(() => tier3InputRef.current?.focus(), 0);
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

                  <button
                    onClick={openTier3Prompt}
                    className="rounded-xl px-3 py-2 text-sm font-semibold transition"
                    style={{
                      background: tier3Enabled ? BRAND.magenta : "rgba(5,11,16,0.55)",
                      color: "white",
                      border: `1px solid ${tier3Enabled ? "rgba(211,69,123,0.55)" : BRAND.border}`
                    }}
                  >
                    Tier 3
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
            <div className="mb-2">
              <div className="text-[15px] font-extrabold tracking-tight line-clamp-1" style={{ color: BRAND.text }}>
                {result?.description ? result.description : "Ready to scan."}
              </div>
              <div className="mt-0.5 text-xs" style={{ color: BRAND.muted }}>
                {result ? "Pricing snapshot" : mode === "upc" ? "Scan UPC or enter UPC" : "Enter ItemNumber"}
              </div>
            </div>

            {tier3PromptOpen && (
              <div
                className="mb-3 rounded-2xl border p-3"
                style={{ borderColor: BRAND.border, background: BRAND.panel2 }}
              >
                <div className="text-sm font-extrabold" style={{ color: BRAND.text }}>
                  Enter Tier 3 Passcode
                </div>

                <div className="mt-2 flex gap-2">
                  <input
                    ref={tier3InputRef}
                    value={tier3Code}
                    onChange={(e) => setTier3Code(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitTier3Code();
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="w-full rounded-xl px-4 py-3 text-base focus:outline-none"
                    style={{
                      border: `1px solid ${BRAND.border}`,
                      background: "rgba(3, 8, 12, 0.65)",
                      color: BRAND.text
                    }}
                  />

                  <button
                    onClick={submitTier3Code}
                    className="rounded-xl px-4 py-3 text-sm font-semibold"
                    style={{
                      background: `linear-gradient(180deg, ${BRAND.magenta}, ${BRAND.magenta2})`,
                      color: "white",
                      border: "1px solid rgba(211,69,123,0.55)"
                    }}
                  >
                    Unlock
                  </button>
                </div>

                {tier3Error && (
                  <div className="mt-2 text-xs font-semibold text-red-300">{tier3Error}</div>
                )}
              </div>
            )}

            <div className="grid gap-2 grid-cols-2">
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

              {isApparel && (
                <div
                  className="col-span-2 rounded-lg border px-3 py-2"
                  style={{
                    borderColor: "rgba(253,224,71,0.55)",
                    background: "rgba(253,224,71,0.10)",
                    color: "rgba(255,255,255,0.95)"
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">⚠️</span>
                    <span className="text-sm font-extrabold">Shoes should be priced at Tier 1.</span>
                  </div>
                </div>
              )}

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

              {tier3Enabled && (
                <div
                  className="col-span-2 rounded-2xl border p-3"
                  style={{ borderColor: "rgba(211,69,123,0.35)", background: BRAND.panel2 }}
                >
                  <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                    Tier 3
                  </div>
                  <div className="mt-1 text-2xl font-extrabold" style={{ color: "#f9a8d4" }}>
                    {result ? money0(tier3Rounded) : "—"}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: BRAND.muted }}>
                    70% off retail
                  </div>
                </div>
              )}
            </div>

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
