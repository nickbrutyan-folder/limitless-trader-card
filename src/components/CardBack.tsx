"use client";

export function CardBack() {
  return (
    <div
      className="w-full h-full rounded-[20px] overflow-hidden relative"
      style={{
        background: "#052F1B",
        border: "1px solid rgba(195,255,0,0.08)",
      }}
    >
      {/* Holographic shimmer sweep */}
      <div
        className="absolute inset-0 card-holo-shimmer"
        style={{
          background:
            "linear-gradient(135deg, transparent 20%, rgba(220,245,140,0.04) 30%, rgba(100,200,255,0.03) 40%, rgba(255,100,200,0.03) 50%, transparent 60%)",
        }}
      />

      {/* Noise grain */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Inner border frame */}
      <div className="absolute inset-5 sm:inset-7 rounded-[12px] border border-[#C3FF00]/[0.06]" />

      {/* Centre logo + label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[16px] overflow-hidden flex items-center justify-center" style={{ background: "#C3FF00" }}>
          <img
            src="/limitless-icon-on-green.svg"
            alt="Limitless"
            className="w-9 h-9 sm:w-10 sm:h-10 object-contain"
          />
        </div>
        <span className="text-[9px] sm:text-[10px] font-medium tracking-[0.3em] text-[#C3FF00]/30 uppercase">
          Reveal Card
        </span>
      </div>

      {/* Corner filigree — top-left */}
      <div className="absolute top-4 left-4">
        <div className="w-4 h-[1px] bg-[#C3FF00]/[0.08]" />
        <div className="w-[1px] h-4 bg-[#C3FF00]/[0.08]" />
      </div>

      {/* Corner filigree — bottom-right */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end">
        <div className="w-[1px] h-4 bg-[#C3FF00]/[0.08] self-end" />
        <div className="w-4 h-[1px] bg-[#C3FF00]/[0.08]" />
      </div>
    </div>
  );
}
