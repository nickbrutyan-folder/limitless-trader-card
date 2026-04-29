"use client";

import type { TraderCardData } from "@/lib/types";

const ACCENT = "#C3FF00";

function formatUSD(value: number, opts: { showSign?: boolean } = {}): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : opts.showSign && value > 0 ? "+" : "";
  let body: string;
  if (abs >= 1_000_000) body = `${(abs / 1_000_000).toFixed(1)}M`.replace(".0M", "M");
  else if (abs >= 1_000) body = `${(abs / 1_000).toFixed(1)}K`.replace(".0K", "K");
  else body = `${Math.round(abs)}`;
  return `${sign}$${body}`;
}

export function TraderCard({ data }: { data: TraderCardData }) {
  const { card, stats } = data;
  const winRateText = stats.winRate === -1 ? "—" : `${stats.winRate}%`;

  // Scale title font to fit. "The OG" (6 chars) caps at 15.6cqw (300px / 1920px,
  // matching the Figma). Longer titles shrink so they fit on 1–2 lines without
  // colliding with the stats row below.
  const titleLen = Math.max(card.title.length, 1);
  const titleSize = `${Math.max(7, Math.min(15.6, 95 / titleLen))}cqw`;

  return (
    <div
      className="relative w-full h-full overflow-hidden rounded-[20px] select-none"
      style={{
        aspectRatio: "16 / 9",
        background: ACCENT,
        containerType: "inline-size",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
        color: "#000",
      }}
    >
      {/* Top-left big decorative brand mark — extends above the card */}
      <img
        src="/limitless-icon-on-green.svg"
        alt=""
        aria-hidden="true"
        className="absolute pointer-events-none select-none"
        style={{
          width: "21%",
          top: "-12%",
          left: "1.5%",
        }}
      />

      {/* Bottom-right huge decorative brand mark — clipped at edges */}
      <img
        src="/limitless-icon-on-green.svg"
        alt=""
        aria-hidden="true"
        className="absolute pointer-events-none select-none"
        style={{
          width: "55%",
          right: "-9%",
          bottom: "-22%",
        }}
      />

      {/* Top-right: "Trader Card" label + small icon */}
      <div
        className="absolute flex items-center"
        style={{
          right: "2.6%",
          top: "4.6%",
          gap: "1.5cqw",
        }}
      >
        <span
          className="font-medium whitespace-nowrap"
          style={{
            fontSize: "2.45cqw",
            letterSpacing: "-0.05em",
            lineHeight: 1,
          }}
        >
          Trader Card
        </span>
        <span
          className="flex items-center justify-center bg-black"
          style={{
            width: "5.2cqw",
            height: "5.2cqw",
            borderRadius: "0.8cqw",
          }}
        >
          <img
            src="/limitless-icon-green.svg"
            alt="Limitless"
            style={{ width: "70%", height: "70%" }}
          />
        </span>
      </div>

      {/* Archetype title — font shrinks for longer titles to avoid stat-row collision */}
      <h1
        className="absolute font-bold"
        style={{
          left: "2.6%",
          top: "23%",
          width: "72%",
          fontSize: titleSize,
          letterSpacing: "-0.05em",
          lineHeight: 0.95,
          margin: 0,
        }}
      >
        {card.title}
      </h1>

      {/* Stats row */}
      <div
        className="absolute flex items-end"
        style={{
          left: "2.6%",
          top: "59%",
          gap: "4cqw",
        }}
      >
        <Stat label="Win Rate" value={winRateText} />
        <Stat label="P&L" value={formatUSD(stats.pnl)} />
        <Stat label="Volume" value={formatUSD(stats.volume)} />
      </div>

      {/* Best Day — black pill + label */}
      <div
        className="absolute flex items-center"
        style={{
          left: "2.6%",
          bottom: "5.5%",
          gap: "1.6cqw",
        }}
      >
        <span
          className="flex items-center bg-black"
          style={{
            paddingLeft: "1.3cqw",
            paddingRight: "1.3cqw",
            paddingTop: "0.6cqw",
            paddingBottom: "0.6cqw",
            color: ACCENT,
          }}
        >
          <span
            className="font-bold tabular-nums"
            style={{
              fontSize: "2.6cqw",
              letterSpacing: "-0.05em",
              lineHeight: 1,
            }}
          >
            {formatUSD(stats.bestDay, { showSign: true })}
          </span>
        </span>
        <span
          className="font-medium"
          style={{
            fontSize: "1.875cqw",
            letterSpacing: "-0.05em",
            lineHeight: 1,
          }}
        >
          Best Day
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col" style={{ gap: "0.5cqw" }}>
      <span
        className="font-bold tabular-nums whitespace-nowrap"
        style={{
          fontSize: "5.2cqw",
          letterSpacing: "-0.05em",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        className="font-medium"
        style={{
          fontSize: "1.82cqw",
          letterSpacing: "-0.05em",
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}
