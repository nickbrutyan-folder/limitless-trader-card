import { NextRequest, NextResponse } from "next/server";
import {
  fetchPortfolioData,
  fetchMarketDetails,
} from "@/lib/limitless-api";
import { deriveData } from "@/lib/derive";
import { classifyTrader, getAllScores } from "@/lib/score";
import type { TraderCardData, TraderStats } from "@/lib/types";

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function interpolateMotivation(
  template: string,
  stats: TraderStats,
  totalVolume: number,
  tradeCount: number
): string {
  // {trades} renders as a count (e.g. "200 trades"); {total_volume} renders as
  // dollars (e.g. "$50,000 traded"). Earlier the two were conflated and the
  // shrimp/swarm/mid-curve/grinder copy read "$X trades" — visible nonsense.
  // When win rate is unknown, replace `{win_rate}%` (with the `%`) so templates
  // like "with a {win_rate}% hit rate" don't render as "with a strong% hit rate".
  const unknownWinRate = stats.winRate === -1;
  let out = template;
  if (unknownWinRate) {
    out = out.replace(/\{win_rate\}%/g, "strong").replace(/\{win_rate\}/g, "strong");
  } else {
    out = out.replace(/\{win_rate\}/g, String(Math.round(stats.winRate)));
  }
  return out
    .replace("{pnl}", `$${Math.abs(stats.pnl).toLocaleString()}`)
    .replace("{trades}", Math.round(tradeCount).toLocaleString())
    .replace("{best_trade}", `$${stats.bestDay.toLocaleString()}`)
    .replace("{total_volume}", `$${Math.round(totalVolume).toLocaleString()}`);
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim();

  if (!wallet) {
    return NextResponse.json({ error: "wallet address required" }, { status: 400 });
  }

  if (!isValidAddress(wallet)) {
    return NextResponse.json(
      { error: "invalid wallet address format" },
      { status: 400 }
    );
  }

  try {
    // Step 1: Fetch all 3 portfolio endpoints in parallel
    const rawData = await fetchPortfolioData(wallet);

    // Step 2: Fetch market details for category cross-referencing
    const marketDetails = await fetchMarketDetails(rawData.positions);

    // Step 3: Derive all data points
    const derived = deriveData(rawData, marketDetails);

    // Step 4: Classify — pick highest-scoring card
    const { card, score } = classifyTrader(derived);

    // Step 5: Build stats for the card display
    const stats: TraderStats = {
      winRate: derived.winRate === -1 ? -1 : Math.round(derived.winRate * 100),
      pnl: Math.round(derived.netPnlUsdc),
      volume: Math.round(derived.totalVolumeUsdc),
      bestDay: Math.round(derived.bestDayUsdc),
    };

    // Step 6: Build motivation text
    const motivation = interpolateMotivation(
      card.motivationTemplate,
      stats,
      derived.totalVolumeUsdc,
      derived.tradeCount
    );

    const cardData: TraderCardData = {
      card,
      stats,
      walletAddress: wallet,
    };

    const response = NextResponse.json({
      cardData,
      motivation,
      derived: {
        totalVolumeUsdc: derived.totalVolumeUsdc,
        winRate: derived.winRate,
        winRateSource: derived.winRateSource,
        netPnlUsdc: derived.netPnlUsdc,
        tradeCount: derived.tradeCount,
        activeDays: derived.activeDays,
        dominantCategory: derived.dominantCategory,
        pnlTrend: derived.pnlTrend,
        avgEntryProbability: derived.avgEntryProbability,
      },
      topScore: score,
      scores: getAllScores(derived)
        .slice(0, 5)
        .map((s) => ({ id: s.card.id, title: s.card.title, score: s.score })),
    });

    // Cache for 5 min — handles bursts of 1000+ users
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return response;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "failed to generate card";

    if (message.includes("404")) {
      return NextResponse.json(
        { error: "wallet not found on Limitless Exchange" },
        { status: 404 }
      );
    }

    console.error("[generate]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
