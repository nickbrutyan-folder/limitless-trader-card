import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import {
  fetchPortfolioData,
  fetchMarketDetails,
} from "@/lib/limitless-api";
import { deriveData } from "@/lib/derive";
import { classifyTrader } from "@/lib/score";

// Card image is rendered server-side via satori (Next.js ImageResponse), giving
// pixel-perfect Figma-faithful PNGs that don't depend on browser rendering of
// container queries / aspect-ratio / etc. that html2canvas can't handle.

export const runtime = "nodejs";

const W = 1920;
const H = 1080;
const ACCENT = "#C3FF00";

// Limitless cross/plus brand mark (from /public/limitless-icon-on-green.svg)
const BRAND_PATH =
  "M413.468 218.013H352.889L434.511 134.701L435 134.207L405.25 104.415H324.308V86.2778C324.308 74.5475 314.779 65 303.063 65H216.211C204.495 65 194.971 74.5425 194.971 86.2778V239.432H86.5317C74.821 239.432 65.2923 248.979 65.2923 260.709C65.2923 272.44 74.821 281.987 86.5317 281.987H147.111L65.4888 365.269L65 365.763L94.7453 395.555H175.692V413.722C175.692 425.452 185.221 435 196.932 435H283.784C295.495 435 305.029 425.458 305.029 413.722V260.568H413.468C425.184 260.568 434.713 251.026 434.713 239.291C434.713 227.555 425.184 218.013 413.468 218.013ZM296.19 413.722C296.19 420.568 290.627 426.143 283.789 426.143C276.951 426.143 271.388 420.573 271.388 413.722V291.873L181.84 383.265L164.304 365.702L255.042 273.125H173.384C166.546 273.125 160.983 267.555 160.983 260.704C160.983 253.854 166.546 248.284 173.384 248.284H277.873C287.977 248.284 296.19 256.515 296.19 266.633V413.722ZM413.468 251.711H308.974C298.876 251.711 290.657 243.48 290.657 233.367V86.2778C290.657 79.4322 296.22 73.8569 303.058 73.8569C309.896 73.8569 315.459 79.4272 315.459 86.2778V208.127L405.008 116.7L422.544 134.263L331.806 226.875H413.463C420.301 226.875 425.864 232.445 425.864 239.296C425.864 246.146 420.301 251.716 413.463 251.716L413.468 251.711Z";

// Inter weights are loaded from the official Inter GitHub release. Cached at
// the fetch layer (Next.js dedupes per-request), and the response is cached at
// the route layer for 1h.
async function loadFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { next: { revalidate: 3600 * 24 * 7 } });
  if (!res.ok) throw new Error(`Font load failed: ${url}`);
  return res.arrayBuffer();
}

const INTER_BOLD =
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff";
const INTER_MEDIUM =
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.woff";

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function formatUSD(value: number, opts: { showSign?: boolean } = {}): string {
  const abs = Math.abs(value);
  const sign =
    value < 0 ? "-" : opts.showSign && value > 0 ? "+" : "";
  let body: string;
  if (abs >= 1_000_000)
    body = `${(abs / 1_000_000).toFixed(1)}M`.replace(".0M", "M");
  else if (abs >= 1_000)
    body = `${(abs / 1_000).toFixed(1)}K`.replace(".0K", "K");
  else body = `${Math.round(abs)}`;
  return `${sign}$${body}`;
}

// Title font size scales with character count — same logic as TraderCard.tsx
function titleFontSize(title: string): number {
  // At 1920 design width, "The OG" (6 chars) caps at 300px (Figma).
  // Formula: min(300, 1820 / chars) — keeps long titles legible without clipping.
  const px = Math.min(300, 1820 / Math.max(title.length, 1));
  return Math.max(140, px); // floor at 140px so even longest titles stay prominent
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim();

  if (!wallet || !isValidAddress(wallet)) {
    return new Response("invalid wallet", { status: 400 });
  }

  try {
    const rawData = await fetchPortfolioData(wallet);
    const marketDetails = await fetchMarketDetails(rawData.positions);
    const derived = deriveData(rawData, marketDetails);
    const { card } = classifyTrader(derived);

    const winRate = derived.winRate === -1 ? -1 : Math.round(derived.winRate * 100);
    const pnl = Math.round(derived.netPnlUsdc);
    const volume = Math.round(derived.totalVolumeUsdc);
    const bestDay = Math.round(derived.bestDayUsdc);

    const winRateText = winRate === -1 ? "—" : `${winRate}%`;

    const [interBold, interMedium] = await Promise.all([
      loadFont(INTER_BOLD),
      loadFont(INTER_MEDIUM),
    ]);

    return new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            background: ACCENT,
            display: "flex",
            position: "relative",
            fontFamily: "Inter",
            color: "#000",
          }}
        >
          {/* Top-left small decorative brand mark, partially clipped above */}
          <svg
            width={420}
            height={420}
            viewBox="0 0 500 500"
            style={{ position: "absolute", left: 30, top: -130 }}
          >
            <path d={BRAND_PATH} fill="black" />
          </svg>

          {/* Bottom-right huge decorative brand mark, clipped at edges */}
          <svg
            width={1100}
            height={1100}
            viewBox="0 0 500 500"
            style={{ position: "absolute", right: -180, bottom: -240 }}
          >
            <path d={BRAND_PATH} fill="black" />
          </svg>

          {/* Top-right: "Trader Card" + small icon */}
          <div
            style={{
              position: "absolute",
              right: 50,
              top: 60,
              display: "flex",
              alignItems: "center",
              gap: 24,
            }}
          >
            <span
              style={{
                fontSize: 47,
                fontWeight: 500,
                letterSpacing: "-2.35px",
                lineHeight: 1,
              }}
            >
              Trader Card
            </span>
            <div
              style={{
                width: 100,
                height: 100,
                background: "#000",
                borderRadius: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width={70} height={70} viewBox="0 0 500 500">
                <path d={BRAND_PATH} fill={ACCENT} />
              </svg>
            </div>
          </div>

          {/* Archetype title */}
          <div
            style={{
              position: "absolute",
              left: 50,
              top: 250,
              width: 1380,
              fontSize: titleFontSize(card.title),
              fontWeight: 700,
              letterSpacing: "-15px",
              lineHeight: 0.95,
              display: "flex",
            }}
          >
            {card.title}
          </div>

          {/* Stats row */}
          <div
            style={{
              position: "absolute",
              left: 50,
              top: 636,
              display: "flex",
              gap: 90,
            }}
          >
            <Stat label="Win Rate" value={winRateText} />
            <Stat label="P&L" value={formatUSD(pnl)} />
            <Stat label="Volume" value={formatUSD(volume)} />
          </div>

          {/* Best Day pill */}
          <div
            style={{
              position: "absolute",
              left: 50,
              bottom: 50,
              display: "flex",
              alignItems: "center",
              gap: 28,
            }}
          >
            <div
              style={{
                background: "#000",
                paddingLeft: 25,
                paddingRight: 25,
                paddingTop: 10,
                paddingBottom: 10,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 50,
                  fontWeight: 700,
                  letterSpacing: "-2.5px",
                  lineHeight: 1,
                  color: ACCENT,
                }}
              >
                {formatUSD(bestDay, { showSign: true })}
              </span>
            </div>
            <span
              style={{
                fontSize: 36,
                fontWeight: 500,
                letterSpacing: "-1.8px",
                lineHeight: 1,
              }}
            >
              Best Day
            </span>
          </div>
        </div>
      ),
      {
        width: W,
        height: H,
        fonts: [
          {
            name: "Inter",
            data: interBold,
            weight: 700,
            style: "normal",
          },
          {
            name: "Inter",
            data: interMedium,
            weight: 500,
            style: "normal",
          },
        ],
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300",
          "Content-Disposition": `inline; filename="trader-card-${wallet.slice(0, 10)}.png"`,
        },
      }
    );
  } catch (err) {
    console.error("[card-image]", err);
    const msg = err instanceof Error ? err.message : "render failed";
    return new Response(msg, { status: 500 });
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <span
        style={{
          fontSize: 100,
          fontWeight: 700,
          letterSpacing: "-5px",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 35,
          fontWeight: 500,
          letterSpacing: "-1.75px",
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}
