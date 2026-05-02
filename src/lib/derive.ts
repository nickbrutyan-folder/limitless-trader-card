/**
 * Derive all classification data points from the raw Limitless API responses.
 *
 * Key API limitations:
 * - /positions only returns CURRENT positions (not historical closed ones)
 * - /pnl-chart returns daily cumulative PnL snapshots (not per-trade data)
 * - /traded-volume returns total USDC volume (no trade count)
 *
 * We work around these by:
 * - Estimating trade count from volume + position sizes
 * - Requiring minimum sample sizes for win rate
 * - Using daily PnL deltas for trend analysis (not per-trade stats)
 */

import type {
  RawPortfolioData,
  MarketInfo,
  ClobPosition,
} from "./limitless-api";
import { rawToUsdc, safeNum } from "./limitless-api";

export interface DerivedData {
  totalVolumeUsdc: number;
  tradeCount: number;          // estimated — NOT exact
  averageBetSizeUsdc: number;
  netPnlUsdc: number;
  winRate: number;             // 0–1, or -1 if unknown
  winRateSource: "realisedPnl" | "resolved" | "dailyPnl" | "none";
  pnlCurve: number[];
  bestDayUsdc: number;         // largest realized gain (daily delta or single trade)
  worstDayUsdc: number;        // largest single-day loss
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
  activeDays: number;
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
  // API returns: {"data":"1043579"} — whole USDC (not 6-decimal)
  const totalVolumeUsdc = Math.max(0, safeNum(tradedVolume.data));

  // ── Positions ──────────────────────────────────────────────────────────────
  const clobPositions = Array.isArray(positions.clob) ? positions.clob : [];
  const ammPositions = Array.isArray(positions.amm) ? positions.amm : [];
  const ammPositionCount = ammPositions.length;
  const clobPositionCount = clobPositions.length;
  const openPositionCount = ammPositionCount + clobPositionCount;

  // Position sizes (USDC) from current positions
  const positionSizes = clobPositions.map(getClobPositionCostUsdc).filter(c => c > 0);
  for (const pos of ammPositions) {
    const c = rawToUsdc(pos.collateralAmount ?? "0");
    if (c > 0) positionSizes.push(c);
  }

  // ── P&L ───────────────────────────────────────────────────────────────────
  // The Limitless /pnl-chart endpoint returns trustworthy values for wallets
  // with rich trading history (e.g. 100+ datapoints), but ships garbage for
  // wallets with sparse history (typically 1–2 chart points): values exceeding
  // the wallet's total traded volume by 3–6×, which is physically impossible.
  // Gate the chart at the source: if any value exceeds total volume, the
  // entire series is treated as missing and downstream metrics fall back to
  // position-derived signals (single-trade realized PnL, etc.).
  const rawPnlData = Array.isArray(pnlChart.data) ? pnlChart.data : [];
  const rawCurve = rawPnlData.map((p) => p.value ?? 0);
  // Trust the chart only when (1) it has enough datapoints to represent real
  // history (>= 3 points; sparse 1-2 point responses have been observed to
  // ship garbage values, e.g. a $2.2M-volume wallet with a chart claiming
  // -$14M P&L), and (2) every point is within physical bounds.
  const chartIsSane =
    rawCurve.length >= 3 &&
    rawCurve.every((v) => Math.abs(v) <= totalVolumeUsdc);
  const pnlCurve = chartIsSane ? rawCurve : [];

  // Daily deltas (day-over-day PnL changes; empty when the chart is unusable)
  const dailyDeltas: number[] = [];
  for (let i = 1; i < pnlCurve.length; i++) {
    dailyDeltas.push(pnlCurve[i] - pnlCurve[i - 1]);
  }

  // Best Day = largest realized gain we can find, drawing from three sources:
  // (1) daily P&L chart deltas (preferred when the chart has enough datapoints)
  // (2) max single CLOB position realisedPnl
  // (3) max single AMM position realizedPnl
  // For AMM-heavy wallets (Hourly Crypto, Commodities) the daily chart often
  // has only 1-2 points, so single-trade max becomes the meaningful signal.
  let bestDayUsdc = dailyDeltas.length > 0 ? Math.max(...dailyDeltas, 0) : 0;
  for (const pos of clobPositions) {
    const yp = rawToUsdc(pos.positions?.yes?.realisedPnl ?? "0");
    const np = rawToUsdc(pos.positions?.no?.realisedPnl ?? "0");
    if (yp + np > bestDayUsdc) bestDayUsdc = yp + np;
  }
  for (const pos of ammPositions) {
    const pnl = safeNum(pos.realizedPnl);
    if (pnl > bestDayUsdc) bestDayUsdc = pnl;
  }
  const worstDayUsdc = dailyDeltas.length > 0 ? Math.min(...dailyDeltas, 0) : 0;

  // Net P&L: use chart's last value when sane, else sum realized + unrealized
  // across active positions (CLOB + AMM).
  let netPnlUsdc = 0;
  if (pnlCurve.length > 0) {
    netPnlUsdc = pnlCurve[pnlCurve.length - 1];
  } else {
    for (const pos of clobPositions) {
      netPnlUsdc += rawToUsdc(pos.positions?.yes?.realisedPnl ?? "0");
      netPnlUsdc += rawToUsdc(pos.positions?.yes?.unrealizedPnl ?? "0");
      netPnlUsdc += rawToUsdc(pos.positions?.no?.realisedPnl ?? "0");
      netPnlUsdc += rawToUsdc(pos.positions?.no?.unrealizedPnl ?? "0");
    }
    for (const pos of ammPositions) {
      netPnlUsdc +=
        safeNum(pos.realizedPnl) + safeNum(pos.unrealizedPnl);
    }
  }

  // Active trading days (days with > $10 PnL movement)
  const activeDays = dailyDeltas.filter((d) => Math.abs(d) > 10).length;

  // ── Trade count estimation ────────────────────────────────────────────────
  // API doesn't provide actual trade count. We estimate from available data:
  let estimatedTradeCount: number;

  if (positionSizes.length >= 3) {
    // Use median position size as average bet size
    const sorted = [...positionSizes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    estimatedTradeCount = median > 0 ? Math.round(totalVolumeUsdc / median) : activeDays;
  } else if (positionSizes.length > 0) {
    // Few positions — use their average but cap the estimate
    const avgSize = positionSizes.reduce((a, b) => a + b, 0) / positionSizes.length;
    estimatedTradeCount = avgSize > 0 ? Math.round(totalVolumeUsdc / avgSize) : activeDays;
  } else {
    // No position data — use active days as minimum, scale by volume
    estimatedTradeCount = Math.max(activeDays, Math.round(totalVolumeUsdc / 100));
  }

  // Sanity bounds: at least 1, at most volume/$1 (can't have more trades than dollars)
  estimatedTradeCount = Math.max(1, Math.min(estimatedTradeCount, totalVolumeUsdc));
  const tradeCount = estimatedTradeCount;

  const averageBetSizeUsdc =
    tradeCount > 0 ? totalVolumeUsdc / tradeCount : 0;

  // ── Win rate ──────────────────────────────────────────────────────────────
  // Compute all available methods, then pick the one with the most data points.
  // This prevents a tiny sample (e.g. 2 resolved positions) from overriding
  // a much larger sample (e.g. 100+ daily PnL deltas).

  let winRate = -1;
  let winRateSource: "realisedPnl" | "resolved" | "dailyPnl" | "none" = "none";

  // Candidate: realized PnL across CLOB + AMM closed positions.
  // CLOB realisedPnl is raw 6-decimal USDC, split by yes/no side.
  // AMM realizedPnl is a single decimal-USDC string per position.
  // A "win" = closed position whose total realized PnL is positive.
  let rpnlClosed = 0;
  let rpnlWins = 0;
  for (const pos of clobPositions) {
    const yp = rawToUsdc(pos.positions?.yes?.realisedPnl ?? "0");
    const np = rawToUsdc(pos.positions?.no?.realisedPnl ?? "0");
    const total = yp + np;
    if (total !== 0) {
      rpnlClosed++;
      if (total > 0) rpnlWins++;
    }
  }
  for (const pos of ammPositions) {
    const pnl = safeNum(pos.realizedPnl);
    if (pnl !== 0) {
      rpnlClosed++;
      if (pnl > 0) rpnlWins++;
    }
  }
  const rpnlRate = rpnlClosed >= 2 ? rpnlWins / rpnlClosed : -1;

  // Candidate: resolved positions with winning outcome
  const resolvedPositions = clobPositions.filter(
    (p) => p.market?.status === "RESOLVED"
  );
  let resolvedRate = -1;
  if (resolvedPositions.length >= 2) {
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
    resolvedRate = resolvedWins / resolvedPositions.length;
  }

  // Candidate: daily P&L deltas (profitable days ratio, capped at 80%).
  // Threshold lowered from 7 → 3 so wallets with sparse chart history but
  // some real activity (e.g. 1 open position + 4-6 chart datapoints) still
  // get a usable estimate instead of an unhelpful "—".
  let dailyRate = -1;
  if (dailyDeltas.length >= 3) {
    const profitableDays = dailyDeltas.filter((d) => d > 0).length;
    dailyRate = Math.min(profitableDays / dailyDeltas.length, 0.80);
  }

  // Pick the method with the MOST data points (most statistically reliable)
  const candidates: { rate: number; count: number; source: DerivedData["winRateSource"] }[] = [];
  if (rpnlRate >= 0) candidates.push({ rate: rpnlRate, count: rpnlClosed, source: "realisedPnl" });
  if (resolvedRate >= 0) candidates.push({ rate: resolvedRate, count: resolvedPositions.length, source: "resolved" });
  if (dailyRate >= 0) candidates.push({ rate: dailyRate, count: dailyDeltas.length, source: "dailyPnl" });

  if (candidates.length > 0) {
    const best = candidates.sort((a, b) => b.count - a.count)[0];
    winRate = best.rate;
    winRateSource = best.source;
  }

  const pnlTrend = detectPnlTrend(pnlCurve);

  // ── Portfolio metrics ──────────────────────────────────────────────────────
  const totalExposure = positionSizes.reduce((a, b) => a + b, 0);
  const sorted = [...positionSizes].sort((a, b) => b - a);
  const top3 = sorted.slice(0, 3).reduce((a, b) => a + b, 0);
  const portfolioConcentration = totalExposure > 0 ? top3 / totalExposure : 0;

  // YES/NO bias
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
      const entryEstimate = Date.now() - 86_400_000;
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
    winRateSource,
    pnlCurve,
    bestDayUsdc,
    worstDayUsdc,
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
    activeDays,
  };
}
