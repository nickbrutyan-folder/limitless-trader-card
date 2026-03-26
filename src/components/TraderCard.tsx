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
  const accent = card.accentColour;

  return (
    <div
      className="group relative w-full max-w-[500px] sm:max-w-[600px] aspect-[16/10] rounded-2xl overflow-hidden shadow-2xl transition-transform duration-500 hover:scale-[1.02] cursor-default"
      style={{
        background:
          "linear-gradient(135deg, #1f1f1f 0%, #0d0d0d 50%, #050505 100%)",
        boxShadow:
          "0 4px 6px -1px rgba(0,0,0,0.3), 0 25px 50px -12px rgba(0,0,0,0.75), inset 0 1px 1px rgba(255,255,255,0.15), inset 0 -1px 1px rgba(0,0,0,0.5)",
      }}
    >
      {/* Grain Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Metallic Edge Highlight */}
      <div
        className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none"
        style={{
          background:
            "radial-gradient(120% 120% at 50% -20%, rgba(255,255,255,0.08) 0%, transparent 50%)",
        }}
      />

      <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between z-10">
        {/* Top Row */}
        <div className="flex justify-between items-start w-full">
          {/* Top Left — Logo + Header */}
          <div className="flex items-center gap-3 mt-1">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md overflow-hidden bg-black flex items-center justify-center shadow-sm border border-white/5">
              <img
                src="/limitless-logo.svg"
                alt="Limitless Logo"
                className="w-4 h-4 sm:w-5 sm:h-5 object-contain"
              />
            </div>
            <span className="text-[10px] sm:text-xs font-semibold tracking-[0.2em] text-[#C4C4CC] uppercase">
              Limitless Trader Card
            </span>
          </div>

          {/* Top Right — Profile Pic + Handle */}
          {xHandle && xProfilePic && (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-full p-[3px] shadow-lg"
                style={{
                  background: `linear-gradient(to top right, ${accent}88, ${accent}, ${accent}88)`,
                }}
              >
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#0d0d0d]">
                  <img
                    src={xProfilePic}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <span className="text-xs sm:text-sm font-medium tracking-wide text-[#A1A1AA]">
                @{xHandle}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6 sm:gap-8 mt-auto mb-auto">
          {/* Card Title */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#E4E4E7] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
              {card.title}
            </h1>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-3 sm:gap-6">
            <StatBox label="Win Rate" value={stats.winRate === -1 ? "—" : `${stats.winRate}%`} accent={accent} />
            <StatBox label="P&L" value={formatUSD(stats.pnl)} accent={accent} />
            <StatBox label="Trades" value={stats.trades.toLocaleString()} accent={accent} />
          </div>
        </div>

        {/* Bottom Row */}
        <div className="flex justify-between items-end mt-4">
          {/* Best Trade */}
          <div className="flex items-center text-[10px] sm:text-xs font-light bg-white/[0.03] rounded-md px-3 py-1.5 border border-white/[0.02]">
            <span className="text-[#A1A1AA] font-medium">Best Trade: </span>
            <span
              className="ml-1.5 font-semibold text-xs sm:text-sm flex items-center gap-1"
              style={{
                color: accent,
                filter: `drop-shadow(0 0 4px ${accent}33)`,
              }}
            >
              <span className="text-[10px] leading-none">▲</span> +{formatUSD(stats.bestTrade)}
            </span>
          </div>

          {/* Footer */}
          <div className="flex items-center pb-1">
            <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#52525B]">
              limitless.exchange
            </span>
          </div>
        </div>
      </div>

      {/* Diagonal Shine on Hover */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-transparent transform -skew-x-12 translate-x-[-150%] group-hover:translate-x-[200%] transition-transform duration-[1.5s] ease-in-out pointer-events-none" />
    </div>
  );
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col items-start bg-white/[0.03] rounded-lg px-4 py-2 border border-white/[0.02]">
      <span
        className="text-2xl sm:text-3xl font-semibold tracking-tight"
        style={{
          color: accent,
          filter: `drop-shadow(0 0 8px ${accent}33)`,
        }}
      >
        {value}
      </span>
      <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-[#A1A1AA] mt-1">
        {label}
      </span>
    </div>
  );
}
