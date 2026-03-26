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
  totalVolume: number
): string {
  return template
    .replace("{win_rate}", stats.winRate === -1 ? "strong" : String(Math.round(stats.winRate)))
    .replace("{pnl}", `$${Math.abs(stats.pnl).toLocaleString()}`)
    .replace("{trades}", String(stats.trades))
    .replace("{best_trade}", `$${stats.bestTrade.toLocaleString()}`)
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
      // -1 sentinel means "not enough data" — card will show "—"
      winRate: derived.winRate === -1 ? -1 : Math.round(derived.winRate * 100),
      pnl: Math.round(derived.netPnlUsdc),
      trades: derived.tradeCount,
      bestTrade: Math.round(derived.bestTradeUsdc),
    };

    // Step 6: Build motivation text
    const motivation = interpolateMotivation(
      card.motivationTemplate,
      stats,
      derived.totalVolumeUsdc
    );

    const cardData: TraderCardData = {
      card,
      stats,
      walletAddress: wallet,
    };

    return NextResponse.json({
      cardData,
      motivation,
      derived: {
        totalVolumeUsdc: derived.totalVolumeUsdc,
        winRate: derived.winRate,
        netPnlUsdc: derived.netPnlUsdc,
        tradeCount: derived.tradeCount,
        dominantCategory: derived.dominantCategory,
        pnlTrend: derived.pnlTrend,
        avgEntryProbability: derived.avgEntryProbability,
      },
      topScore: score,
      // Include top 5 scores for debugging
      scores: getAllScores(derived)
        .slice(0, 5)
        .map((s) => ({ id: s.card.id, title: s.card.title, score: s.score })),
    });
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
