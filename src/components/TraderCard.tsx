"use client";

import type { TraderCardData } from "@/lib/types";

function formatUSD(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(value % 1000 === 0 ? 0 : 1)}K`.replace(".0K", "K");
  return `$${value.toLocaleString()}`;
}

export function TraderCard({ data }: { data: TraderCardData }) {
  const { card, stats, xHandle, xProfilePic } = data;
  const accent = "#c3ff00";

  return (
    <div
      className="relative w-full max-w-[540px] sm:max-w-[620px] mx-auto rounded-[20px] overflow-hidden"
      style={{
        aspectRatio: "1.65 / 1",
        background: "linear-gradient(145deg, #111111 0%, #0a0a0a 40%, #060606 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-[10%] right-[10%] h-[1px]"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }}
      />

      {/* Noise grain */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Corner accent — subtle diagonal */}
      <div
        className="absolute top-0 right-0 w-[120px] h-[120px] pointer-events-none"
        style={{
          background: `linear-gradient(225deg, ${accent}08 0%, transparent 60%)`,
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 p-7 sm:p-9 flex flex-col justify-between z-10">

        {/* Top Row */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-[5px] overflow-hidden bg-black/60 flex items-center justify-center border border-white/[0.06]">
              <img
                src="/limitless-logo.svg"
                alt="Limitless"
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain"
              />
            </div>
            <span className="text-[8px] sm:text-[9px] font-medium tracking-[0.25em] text-[#3F3F46] uppercase">
              Trader Card
            </span>
          </div>

          {xHandle && xProfilePic && (
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-medium text-[#52525B]">
                @{xHandle}
              </span>
              <div
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full p-[1.5px]"
                style={{ background: `linear-gradient(135deg, ${accent}90, ${accent}30)` }}
              >
                <div className="w-full h-full rounded-full overflow-hidden">
                  <img src={xProfilePic} alt="" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Center — Title */}
        <div className="flex flex-col gap-6 sm:gap-7">
          <div>
            <h1
              className="text-[32px] sm:text-[40px] font-extrabold tracking-[-0.03em] leading-none text-[#E4E4E7]"
            >
              {card.title}
            </h1>
          </div>

          {/* Stats */}
          <div className="flex items-end gap-7 sm:gap-9">
            <Stat label="Win Rate" value={stats.winRate === -1 ? "—" : `${stats.winRate}%`} accent={accent} />
            <Stat label="P&L" value={formatUSD(stats.pnl)} accent={accent} />
            <Stat label="Volume" value={formatUSD(stats.volume)} accent={accent} />
          </div>
        </div>

        {/* Bottom Row */}
        <div className="flex justify-between items-end">
          <div className="flex items-baseline gap-2">
            <span className="text-[9px] sm:text-[10px] font-medium text-[#3F3F46] uppercase tracking-wider">
              Best Day
            </span>
            <span
              className="text-sm sm:text-[15px] font-bold tabular-nums"
              style={{ color: accent }}
            >
              +{formatUSD(stats.bestDay)}
            </span>
          </div>

          <span className="text-[8px] font-medium tracking-[0.25em] uppercase text-[#27272A]">
            limitless.exchange
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col">
      <span
        className="text-[22px] sm:text-[28px] font-bold tracking-[-0.02em] leading-none tabular-nums"
        style={{ color: accent ?? "#E4E4E7" }}
      >
        {value}
      </span>
      <span className="text-[8px] sm:text-[9px] font-medium uppercase tracking-[0.2em] text-[#3F3F46] mt-1.5">
        {label}
      </span>
    </div>
  );
}
