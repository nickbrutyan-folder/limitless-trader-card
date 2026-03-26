/**
 * Derive all classification data points from the raw Limitless API responses.
 */

import type {
  RawPortfolioData,
  MarketInfo,
  ClobPosition,
} from "./limitless-api";
import { rawToUsdc } from "./limitless-api";

export interface DerivedData {
  totalVolumeUsdc: number;
  tradeCount: number;
  averageBetSizeUsdc: number;
  netPnlUsdc: number;
  winRate: number;
  pnlCurve: number[];
  bestTradeUsdc: number;
  worstTradeUsdc: number;
  pnlTrend: "up" | "down" | "flat" | "volatile" | "v-shape" | "exponential";
  openPositionCount: number;
  positionSizes: number[];
  yesBias: number;
  ammPositionCount: number;
  clobPositionCount: number;
  uniqueMarketCount: number;
  portfolioConcentration: number;
  categoryDistribution: Record<string, number>;
  dominantCategory: string;
  dominantCategoryPct: number;
  entryTimingsVsCreation: number[];
  entryTimingsVsExpiry: number[];
  avgEntryHoursAfterCreation: number;
  avgEntryHoursBeforeExpiry: number;
  points: number;
  accumulativePoints: number;
  rewardEarnings: number;
  entryProbabilities: number[];
  avgEntryProbability: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(
    arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length
  );
}

function detectPnlTrend(
  curve: number[]
): "up" | "down" | "flat" | "volatile" | "v-shape" | "exponential" {
  if (curve.length < 4) return "flat";
  const first = curve[0];
  const last = curve[curve.length - 1];
  const min = Math.min(...curve);
  const max = Math.max(...curve);
  const range = max - min;
  if (range < 1) return "flat";

  const minIdx = curve.indexOf(min);
  if (
    minIdx > 0 &&
    minIdx < curve.length - 1 &&
    min < first - range * 0.4 &&
    last > first
  )
    return "v-shape";

  const q3 = curve[Math.floor(curve.length * 0.75)];
  if (last > 0 && q3 < last * 0.3 && last > first) return "exponential";

  const sd = stdDev(curve);
  const mean = curve.reduce((a, b) => a + b, 0) / curve.length;
  if (sd > Math.abs(mean) * 0.5 && range > 5) return "volatile";

  if (last > first + range * 0.1) return "up";
  if (last < first - range * 0.1) return "down";
  return "flat";
}

/** Extract USDC cost from a CLOB position (sum of yes + no costs) */
function getClobPositionCostUsdc(pos: ClobPosition): number {
  let total = 0;
  if (pos.positions?.yes?.cost) total += rawToUsdc(pos.positions.yes.cost);
  if (pos.positions?.no?.cost) total += rawToUsdc(pos.positions.no.cost);
  return total;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function deriveData(
  raw: RawPortfolioData,
  marketDetails: Map<string, MarketInfo>
): DerivedData {
  const { tradedVolume, positions, pnlChart } = raw;

  // ── Volume ────────────────────────────────────────────────────────────────
  // API returns: {"data":"1023868"} — already in whole USDC (not 6-decimal)
  const totalVolumeUsdc = Number(tradedVolume.data ?? "0");

  // Trade count isn't provided directly — estimate from PnL curve deltas + positions
  const clobPositions = Array.isArray(positions.clob) ? positions.clob : [];
  const ammPositions = Array.isArray(positions.amm) ? positions.amm : [];

  // Count positions that have non-zero cost as a proxy for trade count
  let estimatedTradeCount = 0;
  for (const pos of clobPositions) {
    if (pos.positions?.yes?.cost && pos.positions.yes.cost !== "0")
      estimatedTradeCount++;
    if (pos.positions?.no?.cost && pos.positions.no.cost !== "0")
      estimatedTradeCount++;
  }
  estimatedTradeCount += ammPositions.length;
  // Fall back to PnL curve deltas if we have them
  const pnlData = Array.isArray(pnlChart.data) ? pnlChart.data : [];
  const tradeCount = Math.max(estimatedTradeCount, pnlData.length);

  const averageBetSizeUsdc =
    tradeCount > 0 ? totalVolumeUsdc / tradeCount : 0;

  // ── P&L ───────────────────────────────────────────────────────────────────
  // API returns: {"data":[{timestamp, value}, ...]} where value = cumulative PnL in USDC
  const pnlCurve = pnlData.map((p) => p.value ?? 0);

  const deltas: number[] = [];
  for (let i = 1; i < pnlCurve.length; i++) {
    deltas.push(pnlCurve[i] - pnlCurve[i - 1]);
  }

  const bestTradeUsdc = deltas.length > 0 ? Math.max(...deltas, 0) : 0;
  const worstTradeUsdc = deltas.length > 0 ? Math.min(...deltas, 0) : 0;
  const netPnlUsdc =
    pnlCurve.length > 0 ? pnlCurve[pnlCurve.length - 1] : 0;

  // ── Win rate — priority: realisedPnl > resolved tokens > delta fallback ──
  // -1 = genuinely unknown (not enough data to calculate reliably)
  let winRate = -1;

  // 1. Best source: positions with actual realised P&L recorded
  const pnlPositions = clobPositions.filter((pos) => {
    const yp = Number(pos.positions?.yes?.realisedPnl ?? 0);
    const np = Number(pos.positions?.no?.realisedPnl ?? 0);
    return yp !== 0 || np !== 0;
  });
  if (pnlPositions.length > 0) {
    let wins = 0;
    for (const pos of pnlPositions) {
      const yp = rawToUsdc(pos.positions?.yes?.realisedPnl ?? "0");
      const np = rawToUsdc(pos.positions?.no?.realisedPnl ?? "0");
      if (yp > 0 || np > 0) wins++;
    }
    winRate = wins / pnlPositions.length;
  }

  // 2. Resolved positions: check who held the winning side
  const resolvedPositions = clobPositions.filter(
    (p) => p.market?.status === "RESOLVED"
  );
  if (winRate === -1 && resolvedPositions.length > 0) {
    let resolvedWins = 0;
    for (const pos of resolvedPositions) {
      const winIdx = pos.market.winningOutcomeIndex;
      const yesHeld =
        pos.tokensBalance?.yes && Number(pos.tokensBalance.yes) > 0;
      const noHeld =
        pos.tokensBalance?.no && Number(pos.tokensBalance.no) > 0;
      if (winIdx === 0 && yesHeld) resolvedWins++;
      else if (winIdx === 1 && noHeld) resolvedWins++;
    }
    winRate = resolvedWins / resolvedPositions.length;
  }

  // 3. Last resort: PnL curve deltas — only use with ≥20 points and cap at 85%
  //    (fewer points = too noisy; uncapped deltas on profitable wallets = fake 100%)
  if (winRate === -1 && deltas.length >= 20) {
    const wins = deltas.filter((d) => d > 0).length;
    winRate = Math.min(wins / deltas.length, 0.85);
  }

  const pnlTrend = detectPnlTrend(pnlCurve);

  // ── Positions ─────────────────────────────────────────────────────────────
  const ammPositionCount = ammPositions.length;
  const clobPositionCount = clobPositions.length;
  const openPositionCount = ammPositionCount + clobPositionCount;

  // Position sizes (USDC) from CLOB positions
  const positionSizes = clobPositions.map(getClobPositionCostUsdc);
  // Add AMM positions if any
  for (const pos of ammPositions) {
    positionSizes.push(rawToUsdc(pos.collateralAmount ?? "0"));
  }

  const totalExposure = positionSizes.reduce((a, b) => a + b, 0);
  const sorted = [...positionSizes].sort((a, b) => b - a);
  const top3 = sorted.slice(0, 3).reduce((a, b) => a + b, 0);
  const portfolioConcentration = totalExposure > 0 ? top3 / totalExposure : 0;

  // YES/NO bias from CLOB positions
  let yesCount = 0;
  let totalSided = 0;
  for (const pos of clobPositions) {
    if (pos.tokensBalance?.yes && Number(pos.tokensBalance.yes) > 0) {
      yesCount++;
      totalSided++;
    }
    if (pos.tokensBalance?.no && Number(pos.tokensBalance.no) > 0) {
      totalSided++;
    }
  }
  for (const pos of ammPositions) {
    if ((pos.outcomeIndex ?? 0) === 0) yesCount++;
    totalSided++;
  }
  const yesBias = totalSided > 0 ? yesCount / totalSided : 0.5;

  // Unique markets
  const slugSet = new Set<string>();
  for (const p of clobPositions)
    if (p.market?.slug) slugSet.add(p.market.slug);
  for (const p of ammPositions)
    if (p.market?.slug) slugSet.add(p.market.slug);
  const uniqueMarketCount = slugSet.size;

  // ── Categories ────────────────────────────────────────────────────────────
  const categoryCounts: Record<string, number> = {};
  let totalCategorised = 0;

  for (const pos of [...clobPositions, ...ammPositions]) {
    const slug = pos.market?.slug;
    const market = slug ? marketDetails.get(slug) : null;
    const cats = market?.categories ?? market?.tags ?? [];
    if (cats.length > 0) {
      const primary = cats[0].toLowerCase();
      categoryCounts[primary] = (categoryCounts[primary] ?? 0) + 1;
      totalCategorised++;
    }
  }

  const categoryDistribution: Record<string, number> = {};
  for (const [cat, count] of Object.entries(categoryCounts)) {
    categoryDistribution[cat] =
      totalCategorised > 0 ? count / totalCategorised : 0;
  }

  const dominantEntry = Object.entries(categoryDistribution).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const dominantCategory = dominantEntry?.[0] ?? "unknown";
  const dominantCategoryPct = dominantEntry?.[1] ?? 0;

  // ── Timing ────────────────────────────────────────────────────────────────
  const entryTimingsVsCreation: number[] = [];
  const entryTimingsVsExpiry: number[] = [];

  for (const pos of clobPositions) {
    const slug = pos.market?.slug;
    const market = slug ? marketDetails.get(slug) : null;
    const expiry = pos.market?.expirationDate ?? pos.market?.deadline;

    if (market?.createdAt) {
      const created = new Date(market.createdAt).getTime();
      // Use a rough "now" since we don't have exact entry time from CLOB
      const entryEstimate = Date.now() - 86_400_000; // rough proxy
      entryTimingsVsCreation.push((entryEstimate - created) / 3_600_000);
    }
    if (expiry) {
      entryTimingsVsExpiry.push(
        (new Date(expiry).getTime() - Date.now()) / 3_600_000
      );
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  // ── Ecosystem ─────────────────────────────────────────────────────────────
  const points = parseFloat(positions.points ?? "0") || 0;
  const accumulativePoints =
    parseFloat(positions.accumulativePoints ?? "0") || 0;
  const rewardEarnings = rawToUsdc(
    positions.rewards?.totalUnpaidRewards ?? "0"
  );

  // ── Entry probabilities ───────────────────────────────────────────────────
  const entryProbabilities: number[] = [];
  for (const pos of clobPositions) {
    // Use fillPrice as proxy for entry probability (6 decimal raw)
    const yesFill = pos.positions?.yes?.fillPrice;
    const noFill = pos.positions?.no?.fillPrice;
    if (yesFill && Number(yesFill) > 0)
      entryProbabilities.push(rawToUsdc(yesFill));
    else if (noFill && Number(noFill) > 0)
      entryProbabilities.push(1 - rawToUsdc(noFill));
    else if (pos.latestTrade?.latestYesPrice != null)
      entryProbabilities.push(pos.latestTrade.latestYesPrice);
  }

  const avgEntryProbability =
    entryProbabilities.length > 0 ? avg(entryProbabilities) : 0.5;

  return {
    totalVolumeUsdc,
    tradeCount,
    averageBetSizeUsdc,
    netPnlUsdc,
    winRate,
    pnlCurve,
    bestTradeUsdc,
    worstTradeUsdc,
    pnlTrend,
    openPositionCount,
    positionSizes,
    yesBias,
    ammPositionCount,
    clobPositionCount,
    uniqueMarketCount,
    portfolioConcentration,
    categoryDistribution,
    dominantCategory,
    dominantCategoryPct,
    entryTimingsVsCreation,
    entryTimingsVsExpiry,
    avgEntryHoursAfterCreation: avg(entryTimingsVsCreation),
    avgEntryHoursBeforeExpiry: avg(entryTimingsVsExpiry),
    points,
    accumulativePoints,
    rewardEarnings,
    entryProbabilities,
    avgEntryProbability,
  };
}
