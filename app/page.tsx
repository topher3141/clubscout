"use client";

import * as React from "react";
import Image from "next/image";

type Mode = "upc" | "item";

type LookupResult = {
  description: string;
  itemNumber: string;
  category: string;
  retail: number;
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
 * Scanner-friendly auto-search
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
    if (digits.length < 10) return;

    timer.current = window.setTimeout(() => {
      if (Date.now() - lastChangeAt.current >= 160) onSearch();
    }, 200);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [value, mode, onSearch]);
}

export default function Page() {
  const [mode, setMode] = React.useState<Mode>("upc");
  const [query, setQuery] = React.useState("");
  const [scanMode, setScanMode] = React.useState(true);

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const focusInput = () => window.setTimeout(() => inputRef.current?.focus(), 0);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searched, setSearched] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<LookupResult | null>(null);

  // Pricing math (UI source of truth)
  const retail = result?.retail ?? 0;
  const tier1 = Math.round(retail * 0.7); // nearest dollar
  const tier2 = Math.ceil(retail * 0.5);  // always up

  const doSearch = React.useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSearched(null);

    try {
      const res = await fetch(
        `/api/search?type=${mode === "item" ? "item" : "upc"}&q=${encodeURIComponent(q)}`,
        { cache: "no-store" }
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Search failed");

      if (data.searched) setSearched(data.searched);
      if (data.found) setResult(data.result);
    } catch (e: any) {
      setError(e.message || "Unexpected error");
    } finally {
      setLoading(false);
      setQuery("");
      focusInput();
    }
  }, [query, mode]);

  useScannerAutoSearch({ value: query, mode, onSearch: doSearch });

  return (
    <div
      className="min-h-screen"
      style={{
        background: `radial-gradient(1000px 500px at 10% 0%, rgba(13,110,127,0.22), transparent 55%),
                     radial-gradient(800px 400px at 95% 10%, rgba(211,69,123,0.18), transparent 52%),
                     ${BRAND.bg}`
      }}
    >
      {/* Header */}
      <header className="border-b backdrop-blur" style={{ borderColor: BRAND.border }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 place-items-center rounded-2xl overflow-hidden"
              style={{ border: `1px solid ${BRAND.border}` }}
            >
              <Image
                src="https://i.imgur.com/T6J8wW7.png"
                alt="ClubScout"
                width={36}
                height={36}
                priority
              />
            </div>
            <div>
              <div className="text-lg font-extrabold" style={{ color: BRAND.text }}>
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
              color: BRAND.text
            }}
          >
            Internal
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-3 py-3">
        <div
          className="rounded-2xl border p-3"
          style={{ borderColor: BRAND.border, background: BRAND.panel }}
        >
          {/* Item name */}
          <div className="mb-2">
            <div
              className="text-[15px] font-extrabold tracking-tight line-clamp-1"
              style={{ color: BRAND.text }}
            >
              {result?.description || "Ready to scan"}
            </div>
            <div className="text-xs" style={{ color: BRAND.muted }}>
              Pricing snapshot
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div
              className="col-span-2 rounded-2xl border p-3"
              style={{ borderColor: BRAND.border, background: BRAND.panel2 }}
            >
              <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                Retail
              </div>
              <div className="mt-1 text-2xl font-extrabold" style={{ color: BRAND.cream }}>
                {result ? money2(retail) : "—"}
              </div>
            </div>

            <div
              className="rounded-2xl border p-3"
              style={{ borderColor: "rgba(13,110,127,0.4)", background: BRAND.panel2 }}
            >
              <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                Tier 1
              </div>
              <div className="mt-1 text-2xl font-extrabold text-green-300">
                {result ? money0(tier1) : "—"}
              </div>
            </div>

            <div
              className="rounded-2xl border p-3"
              style={{ borderColor: "rgba(211,69,123,0.35)", background: BRAND.panel2 }}
            >
              <div className="text-xs font-semibold" style={{ color: BRAND.muted }}>
                Tier 2
              </div>
              <div className="mt-1 text-2xl font-extrabold text-yellow-300">
                {result ? money0(tier2) : "—"}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="flex flex-col gap-2 mb-3">
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder={mode === "upc" ? "Scan UPC…" : "Enter ItemNumber…"}
              inputMode={mode === "upc" && scanMode ? "none" : "numeric"}
              pattern="[0-9]*"
              className="w-full rounded-xl px-4 py-3 text-base focus:outline-none"
              style={{
                border: `1px solid ${BRAND.border}`,
                background: "rgba(3,8,12,0.65)",
                color: BRAND.text
              }}
            />

            <div className="flex gap-2">
              <button
                onClick={doSearch}
                disabled={loading || !query.trim()}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold"
                style={{
                  background: `linear-gradient(180deg, ${BRAND.magenta}, ${BRAND.magenta2})`,
                  color: "white"
                }}
              >
                {loading ? "Searching…" : "Search"}
              </button>

              <button
                onClick={() => {
                  setQuery("");
                  setResult(null);
                  focusInput();
                }}
                className="rounded-xl px-4 py-3 text-sm font-semibold"
                style={{
                  border: `1px solid ${BRAND.border}`,
                  background: "rgba(3,8,12,0.65)",
                  color: BRAND.text
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Details (scroll if needed) */}
          {result && (
            <div className="grid grid-cols-2 gap-2">
              <InfoBox label="ItemNumber" value={result.itemNumber} />
              <InfoBox label="UPC (sheet)" value={result.upcNumber} mono />
              <InfoBox label="Category" value={result.category} span />
              {searched && <InfoBox label="UPC key searched" value={searched} mono span />}
            </div>
          )}

          {error && (
            <div
              className="mt-3 rounded-xl border p-3 text-sm"
              style={{ borderColor: "rgba(248,113,113,0.35)", background: "rgba(127,29,29,0.25)", color: "#fee2e2" }}
            >
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
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
      style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(7,15,22,0.55)" }}
    >
      <div className="text-[11px] font-semibold text-slate-400">{label}</div>
      <div className={`mt-1 text-sm font-bold ${mono ? "font-mono" : ""}`} style={{ color: "#EAF2F6" }}>
        {value || "—"}
      </div>
    </div>
  );
}
