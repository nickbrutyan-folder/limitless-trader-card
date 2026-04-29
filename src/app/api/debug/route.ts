import { NextRequest, NextResponse } from "next/server";

const BASE = "https://api.limitless.exchange";

// /api/debug exposes raw upstream API responses for development inspection.
// Disabled in production to avoid (a) unauthenticated SSRF amplification —
// every hit triples upstream load — and (b) leaking whatever Limitless might
// add to portfolio responses in the future.
const ENABLED =
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_DEBUG_ROUTE === "1";

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export async function GET(req: NextRequest) {
  if (!ENABLED) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const wallet = req.nextUrl.searchParams.get("wallet")?.trim();
  if (!wallet || !isValidAddress(wallet)) {
    return NextResponse.json(
      { error: "valid 0x wallet address required" },
      { status: 400 }
    );
  }

  const [vol, pos, pnl] = await Promise.allSettled([
    fetch(`${BASE}/portfolio/${wallet}/traded-volume`).then((r) => r.json()),
    fetch(`${BASE}/portfolio/${wallet}/positions`).then((r) => r.json()),
    fetch(`${BASE}/portfolio/${wallet}/pnl-chart`).then((r) => r.json()),
  ]);

  return NextResponse.json({
    tradedVolume:
      vol.status === "fulfilled"
        ? vol.value
        : { error: (vol as PromiseRejectedResult).reason?.message },
    positions:
      pos.status === "fulfilled"
        ? pos.value
        : { error: (pos as PromiseRejectedResult).reason?.message },
    pnlChart:
      pnl.status === "fulfilled"
        ? pnl.value
        : { error: (pnl as PromiseRejectedResult).reason?.message },
  });
}
