"use client";

import * as React from "react";

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
      if (Date.now() - lastChangeAt.current >= 180) onSearch();
    }, 220);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [value, mode, onSearch]);
}

export default function Page() {
  const [mode, setMode] = React.useState<Mode>("upc");
  const [query, setQuery] = React.useState("");
  const [scanMode, setScanMode] = React.useState(true);
  const [ultra, setUltra] = React.useState(true);

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const focusInput = React.useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const [loading, setLoading] = React.useState(false);
  const [found, setFound] = React.useState<boolean | null>(null);
  const [searched, setSearched] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<LookupResult | null>(null);

  // Source of truth for pricing math (rounding rules)
  const retail = result?.retail ?? 0;
  const tier1Rounded = Math.round(retail * 0.7); // nearest dollar
  const tier2Rounded = Math.ceil(retail * 0.5); // always round up

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

  const clear = () => {
    setQuery("");
    setError(null);
    setFound(null);
    setResult(null);
    setSearched(null);
    focusInput();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") doSearch();
  };

  // Ultra mode: keep everything on screen, reduce vertical space
  const mainClass = ultra ? "mx-auto max-w-4xl px-3 py-3" : "mx-auto max-w-4xl px-4 py-4";
  const shellPadTop = ultra ? "p-3 pb-2" : "p-4 pb-2";
  const shellPadBody = ultra ? "p-3 pt-2" : "p-4 pt-2";

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-sams-700 shadow-soft">
              <span className="text-lg font-extrabold text-white">CS</span>
            </div>
            <div>
              <div className="text-lg font-extrabold tracking-tight text-slate-100">ClubScout</div>
              <div className="text-xs text-slate-400">Liquidation Lookup Tool</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex select-none items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={ultra}
                onChange={(e) => setUltra(e.target.checked)}
                className="h-4 w-4 accent-[#1a89ff]"
              />
              Ultra
            </label>

            <span className="rounded-full border border-sams-700/60 bg-sams-900/20 px-3 py-1 text-xs font-semibold text-sams-100">
              Internal
            </span>
          </div>
        </div>
      </header>

      <main className={mainClass}>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 shadow-soft">
          <div className={shellPadTop}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div
                  className={
                    ultra
                      ? "text-lg font-extrabold tracking-tight text-slate-100"
                      : "text-xl font-extrabold tracking-tight text-slate-100"
                  }
                >
                  Lookup
                </div>
                {!ultra && (
                  <div className="text-sm text-slate-400">
                    Scan UPC (auto-search) or search by ItemNumber.
                  </div>
                )}
              </div>

              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setMode("upc");
                      clear();
                      focusInput();
                    }}
                    className={
                      "rounded-xl px-3 py-2 text-sm font-semibold transition " +
                      (mode === "upc"
                        ? "bg-sams-700 text-white"
                        : "bg-slate-950 text-slate-300 hover:bg-slate-800")
                    }
                  >
                    UPC
                  </button>
                  <button
                    onClick={() => {
                      setMode("item");
                      clear();
                      focusInput();
                    }}
                    className={
                      "rounded-xl px-3 py-2 text-sm font-semibold transition " +
                      (mode === "item"
                        ? "bg-sams-700 text-white"
                        : "bg-slate-950 text-slate-300 hover:bg-slate-800")
                    }
                  >
                    ItemNumber
                  </button>
                </div>

                {mode === "upc" && (
                  <label className="flex select-none items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={scanMode}
                      onChange={(e) => {
                        setScanMode(e.target.checked);
                        focusInput();
                      }}
                      className="h-4 w-4 accent-[#1a89ff]"
                    />
                    Scan Mode (hide keyboard)
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className={shellPadBody}>
            {/* Ultra mode: show pricing area first so it’s always visible without scrolling */}
            {ultra && (
              <div className="mb-3">
                {/* Item name (one line, slightly larger) */}
                <div className="mb-2">
                  <div className="text-[15px] font-extrabold tracking-tight text-slate-100 line-clamp-1">
                    {result?.description ? result.description : "Ready to scan."}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {result ? "Pricing snapshot" : "Scan UPC or enter ItemNumber"}
                  </div>
                </div>

                {/* Pricing tiles */}
                <div className="grid gap-2 grid-cols-2">
                  <div className="col-span-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                    <div className="text-xs font-semibold text-slate-400">Retail</div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-100">
                      {result ? money2(retail) : "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Retail per Unit</div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                    <div className="text-xs font-semibold text-slate-400">Tier 1</div>
                    <div className="mt-1 text-2xl font-extrabold text-green-300">
                      {result ? money0(tier1Rounded) : "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">30% off (rounded)</div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                    <div className="text-xs font-semibold text-slate-400">Tier 2</div>
                    <div className="mt-1 text-2xl font-extrabold text-yellow-300">
                      {result ? money0(tier2Rounded) : "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">50% off (round up)</div>
                  </div>
                </div>

                {/* Errors show here but do not push the pricing tiles off-screen too much */}
                {error && (
                  <div className="mt-2 rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-200">
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Search controls */}
            <div className={"flex flex-col gap-2 " + (ultra ? "" : "sm:flex-row sm:items-start sm:gap-3")}>
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={mode === "upc" ? "Scan or enter UPC..." : "Enter ItemNumber..."}
                inputMode={mode === "upc" && scanMode ? "none" : "numeric"}
                pattern="[0-9]*"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sams-400"
              />

              <div className="flex gap-2">
                <button
                  onClick={doSearch}
                  disabled={loading || !query.trim()}
                  className="inline-flex items-center justify-center rounded-xl bg-sams-600 px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-sams-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Searching..." : "Search"}
                </button>
                <button
                  onClick={clear}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Ultra mode: detailed info lives BELOW the search bar (scroll if you want more) */}
            {ultra && result && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-slate-400 mb-2">Details</div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                    <div className="text-[11px] font-semibold text-slate-400">ItemNumber</div>
                    <div className="mt-1 text-sm font-bold text-slate-100">{result.itemNumber || "—"}</div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                    <div className="text-[11px] font-semibold text-slate-400">UPC (sheet)</div>
                    <div className="mt-1 text-sm font-bold text-slate-100 font-mono">{result.upcNumber || "—"}</div>
                  </div>

                  <div className="col-span-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                    <div className="text-[11px] font-semibold text-slate-400">Category</div>
                    <div className="mt-1 text-sm font-bold text-slate-100">{result.category || "—"}</div>
                  </div>

                  <div className="col-span-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                    <div className="text-[11px] font-semibold text-slate-400">UPC key searched</div>
                    <div className="mt-1 text-sm font-bold text-slate-100 font-mono">
                      {searched || "—"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Non-ultra mode keeps your original detail view */}
            {!ultra && (
              <>
                <div className="mt-3 text-xs text-slate-500">
                  {mode === "upc" ? (
                    <>
                      UPC scans match the sheet using the{" "}
                      <span className="text-slate-300">first 11 digits</span> (check digit dropped). Leading zeros are
                      handled automatically.
                    </>
                  ) : (
                    <>ItemNumber must match exactly what’s in your Google Sheet.</>
                  )}
                </div>

                <div className="my-3 h-px w-full bg-slate-800" />

                {error && (
                  <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">
                    {error}
                  </div>
                )}

                {searched && (
                  <div className="mb-3 text-xs text-slate-500">
                    Searching UPC key: <span className="font-mono text-slate-300">{searched}</span>
                  </div>
                )}

                {found === false && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
                    <div className="text-base font-bold text-slate-100">No match found</div>
                    <div className="mt-1 text-sm text-slate-400">Try scanning again or confirm the UPC / ItemNumber.</div>
                  </div>
                )}

                {result && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
                    <div className="text-lg font-extrabold leading-snug text-slate-100">{result.description || "—"}</div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-200">
                        Item {result.itemNumber}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-200">
                        Category: {result.category || "—"}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-200">
                        UPC: <span className="font-mono">{result.upcNumber || "—"}</span>
                      </span>
                    </div>

                    <div className="my-3 h-px w-full bg-slate-800" />

                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                      <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
                        <div className="text-xs font-semibold text-slate-400">Retail</div>
                        <div className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-100">{money2(retail)}</div>
                        <div className="mt-1 text-xs text-slate-500">Retail per Unit</div>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
                        <div className="text-xs font-semibold text-slate-400">Tier 1</div>
                        <div className="mt-1 text-xl sm:text-2xl font-extrabold text-green-300">{money0(tier1Rounded)}</div>
                        <div className="mt-1 text-xs text-slate-500">30% off (rounded)</div>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
                        <div className="text-xs font-semibold text-slate-400">Tier 2</div>
                        <div className="mt-1 text-xl sm:text-2xl font-extrabold text-yellow-300">{money0(tier2Rounded)}</div>
                        <div className="mt-1 text-xs text-slate-500">50% off (round up)</div>
                      </div>
                    </div>
                  </div>
                )}

                {found === null && !error && !result && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                    Ready. {mode === "upc" ? "Scan a UPC to auto-search." : "Enter an ItemNumber and press Search."}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {!ultra && (
          <div className="mt-6 text-center text-xs text-slate-600">
            ClubScout • Vercel + Google Sheets • Sam’s Blue UI
          </div>
        )}
      </main>
    </div>
  );
}
