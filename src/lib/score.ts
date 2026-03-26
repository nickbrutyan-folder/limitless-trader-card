/**
 * Scoring engine — scores all 48 card types against derived data.
 * Each scorer returns 0-100. Highest score wins.
 */

import type { DerivedData } from "./derive";
import type { CardConfig } from "./types";
import { CARD_CONFIGS } from "./cards";

type Scorer = (d: DerivedData) => number;

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Clamp a value to [0, max] — default 150 to allow magnitude bonuses */
const clamp = (v: number, max = 150) => Math.max(0, Math.min(max, v));

/** Treat -1 (unknown win rate) as 0 for scoring purposes */
const wr = (d: DerivedData) => Math.max(d.winRate, 0);

/** Returns score proportional to how far a value exceeds a threshold */
function exceeds(value: number, threshold: number, scale = 1): number {
  if (value <= threshold) return 0;
  return clamp(((value - threshold) / (threshold * scale)) * 100);
}

/** Standard deviation of an array */
function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(
    arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length
  );
}

// ─── Scorers by card ID ───────────────────────────────────────────────────────

const SCORERS: Record<string, Scorer> = {
  // ── Cluster 1: Volume & Size ─────────────────────────────────────────────

  whale: (d) => {
    let s = 0;
    if (d.totalVolumeUsdc > 50_000) s += 50;
    if (d.totalVolumeUsdc > 200_000) s += 20;
    if (d.averageBetSizeUsdc > 500) s += 20;
    if (d.tradeCount < 200 && d.totalVolumeUsdc > 10_000) s += 10;
    // Magnitude bonus: reward genuinely huge volume so whale beats other 100s
    if (d.totalVolumeUsdc > 1_000_000) s += 50;
    else if (d.totalVolumeUsdc > 500_000) s += 35;
    else if (d.totalVolumeUsdc > 200_000) s += 15;
    return clamp(s);
  },

  shrimp: (d) => {
    let s = 0;
    if (d.tradeCount > 20) s += 30;
    if (d.averageBetSizeUsdc < 10) s += 50;
    if (d.totalVolumeUsdc < 500) s += 20;
    return clamp(s);
  },

  shark: (d) => {
    let s = 0;
    if (d.totalVolumeUsdc > 10_000) s += 30;
    if (d.winRate > 0.58) s += 40;
    const sd = stdDev(d.positionSizes);
    const mean =
      d.positionSizes.length > 0
        ? d.positionSizes.reduce((a, b) => a + b, 0) / d.positionSizes.length
        : 1;
    if (sd / mean < 0.5) s += 20; // consistent sizing
    if (d.pnlTrend === "up") s += 10;
    return clamp(s);
  },

  swarm: (d) => {
    let s = 0;
    if (d.tradeCount > 100) s += 30;
    if (d.averageBetSizeUsdc < 5) s += 40;
    if (d.totalVolumeUsdc > 1_000) s += 30;
    return clamp(s);
  },

  sniper: (d) => {
    if (d.positionSizes.length < 2) return 0;
    const sorted = [...d.positionSizes].sort((a, b) => b - a);
    const median =
      sorted[Math.floor(sorted.length / 2)];
    const largest = sorted[0];
    let s = 0;
    if (largest > median * 10) s += 60;
    else if (largest > median * 5) s += 30;
    if (d.tradeCount < 50) s += 30;
    if (d.bestTradeUsdc > 500) s += 10;
    return clamp(s);
  },

  arrival: (d) => {
    let s = 0;
    if (d.accumulativePoints < 1000 && d.totalVolumeUsdc > 5_000) s += 70;
    if (d.accumulativePoints < 500 && d.totalVolumeUsdc > 1_000) s += 20;
    if (d.tradeCount < 30) s += 10;
    return clamp(s);
  },

  "size-queen": (d) => {
    if (d.positionSizes.length < 2) return 0;
    const sd = stdDev(d.positionSizes);
    const mean =
      d.positionSizes.reduce((a, b) => a + b, 0) / d.positionSizes.length;
    let s = 0;
    if (sd / mean < 0.2) s += 50; // very consistent sizing
    if (mean > 100) s += 30;
    if (d.averageBetSizeUsdc > 200) s += 20;
    return clamp(s);
  },

  dripper: (d) => {
    let s = 0;
    if (d.openPositionCount > 20) s += 30;
    if (d.averageBetSizeUsdc < 5) s += 50;
    if (d.uniqueMarketCount > 15) s += 20;
    return clamp(s);
  },

  // ── Cluster 2: Win Rate & P&L ────────────────────────────────────────────

  oracle: (d) => {
    if (d.winRate === -1) return 0; // can't claim oracle without real win rate data
    let s = 0;
    if (wr(d) > 0.65) s += 60;
    else if (wr(d) > 0.55) s += 30;
    if (d.pnlTrend === "up") s += 30;
    if (d.netPnlUsdc > 0) s += 10;
    return clamp(s);
  },

  rekt: (d) => {
    let s = 0;
    if (d.netPnlUsdc < 0) s += 40;
    if (d.winRate !== -1 && wr(d) < 0.4) s += 40;
    else if (d.winRate === -1 && d.netPnlUsdc < -500) s += 20; // infer from losses
    if (d.tradeCount > 10) s += 20;
    return clamp(s);
  },

  "comeback-kid": (d) => {
    if (d.pnlTrend === "v-shape") return 90;
    const curve = d.pnlCurve;
    if (curve.length < 4) return 0;
    const min = Math.min(...curve);
    const last = curve[curve.length - 1];
    const first = curve[0];
    const range = Math.max(...curve) - min;
    if (min < first - range * 0.4 && last > first) return 70;
    return 0;
  },

  "one-hit-wonder": (d) => {
    if (d.pnlCurve.length < 2) return 0;
    const best = d.bestTradeUsdc;
    if (best <= 0) return 0;
    const totalPnl = Math.abs(d.netPnlUsdc);
    if (totalPnl === 0) return 0;
    const dominance = best / totalPnl;
    let s = 0;
    if (dominance > 0.8) s += 80;
    else if (dominance > 0.6) s += 40;
    if (d.bestTradeUsdc > 100) s += 20;
    return clamp(s);
  },

  "slow-rug": (d) => {
    let s = 0;
    if (d.pnlTrend === "down") s += 50;
    if (d.netPnlUsdc < 0) s += 30;
    const volatility = stdDev(d.pnlCurve);
    const range = Math.max(...d.pnlCurve, 0) - Math.min(...d.pnlCurve, 0);
    if (range > 0 && volatility / range < 0.3) s += 20; // low volatility decline
    return clamp(s);
  },

  ascent: (d) => {
    if (d.pnlTrend === "exponential") return 90;
    const curve = d.pnlCurve;
    if (curve.length < 4) return 0;
    const last = curve[curve.length - 1];
    const firstHalf = curve[Math.floor(curve.length * 0.75)];
    if (last > 0 && firstHalf >= 0 && last > firstHalf * 2) return 70;
    return 10;
  },

  "mid-curve": (d) => {
    let s = 0;
    const pnlPct = d.totalVolumeUsdc > 0
      ? Math.abs(d.netPnlUsdc) / d.totalVolumeUsdc
      : 1;
    if (pnlPct < 0.02) s += 60;
    else if (pnlPct < 0.05) s += 30;
    if (d.tradeCount > 50) s += 30;
    if (d.pnlTrend === "flat") s += 10;
    return clamp(s);
  },

  hodler: (d) => {
    let s = 0;
    if (d.openPositionCount > 3) s += 40;
    if (d.netPnlUsdc < -100) s += 30;
    if (d.pnlTrend === "down") s += 20;
    if (d.winRate < 0.45) s += 10;
    return clamp(s);
  },

  "contrarian-king": (d) => {
    if (d.winRate === -1) return 0;
    let s = 0;
    if (d.avgEntryProbability < 0.4) s += 50;
    if (wr(d) > 0.5) s += 40;
    if (d.avgEntryProbability < 0.3 && wr(d) > 0.45) s += 10;
    return clamp(s);
  },

  // ── Cluster 3: Frequency & Timing ────────────────────────────────────────

  scout: (d) => {
    let s = 0;
    const earlyEntries = d.entryTimingsVsCreation.filter(
      (h) => h >= 0 && h < 48
    ).length;
    const totalEntries = d.entryTimingsVsCreation.length;
    if (totalEntries === 0) return 0;
    const earlyPct = earlyEntries / totalEntries;
    if (earlyPct > 0.7) s += 70;
    else if (earlyPct > 0.5) s += 40;
    if (d.avgEntryHoursAfterCreation < 24) s += 30;
    return clamp(s);
  },

  grinder: (d) => {
    let s = 0;
    if (d.tradeCount > 200) s += 40;
    else if (d.tradeCount > 100) s += 20;
    if (d.accumulativePoints > 5000) s += 40;
    else if (d.accumulativePoints > 1000) s += 20;
    if (d.uniqueMarketCount > 20) s += 20;
    return clamp(s);
  },

  tourist: (d) => {
    let s = 0;
    if (d.tradeCount < 5) s += 60;
    if (d.openPositionCount === 0) s += 20;
    if (d.accumulativePoints < 100) s += 20;
    return clamp(s);
  },

  sprinter: (d) => {
    // High historical count but low recent activity
    let s = 0;
    if (d.tradeCount > 50) s += 40;
    if (d.openPositionCount < 3) s += 30;
    if (d.rewardEarnings < 1 && d.accumulativePoints > 500) s += 30;
    return clamp(s);
  },

  closer: (d) => {
    let s = 0;
    const lateEntries = d.entryTimingsVsExpiry.filter(
      (h) => h >= 0 && h < 24
    ).length;
    const total = d.entryTimingsVsExpiry.length;
    if (total === 0) return 0;
    const latePct = lateEntries / total;
    if (latePct > 0.6) s += 70;
    else if (latePct > 0.4) s += 40;
    if (d.avgEntryHoursBeforeExpiry < 12) s += 30;
    return clamp(s);
  },

  // ── Cluster 4: Category ──────────────────────────────────────────────────

  "sports-bettor": (d) =>
    clamp((d.categoryDistribution["sports"] ?? 0) * 100 + 5),

  "crypto-maximalist": (d) =>
    clamp(
      ((d.categoryDistribution["crypto"] ?? 0) +
        (d.categoryDistribution["cryptocurrency"] ?? 0)) *
        100 + 5
    ),

  "political-animal": (d) =>
    clamp(
      ((d.categoryDistribution["politics"] ?? 0) +
        (d.categoryDistribution["elections"] ?? 0) +
        (d.categoryDistribution["political"] ?? 0)) *
        100 + 5
    ),

  "pop-culture-prophet": (d) =>
    clamp(
      ((d.categoryDistribution["entertainment"] ?? 0) +
        (d.categoryDistribution["culture"] ?? 0) +
        (d.categoryDistribution["celebrity"] ?? 0)) *
        100 + 5
    ),

  "macro-mind": (d) =>
    clamp(
      ((d.categoryDistribution["macro"] ?? 0) +
        (d.categoryDistribution["economics"] ?? 0) +
        (d.categoryDistribution["finance"] ?? 0) +
        (d.categoryDistribution["global"] ?? 0)) *
        100 + 5
    ),

  generalist: (d) => {
    const values = Object.values(d.categoryDistribution);
    if (values.length < 3) return 0;
    const max = Math.max(...values);
    let s = 0;
    if (max < 0.25) s += 70;
    else if (max < 0.4) s += 40;
    if (values.length >= 4) s += 30;
    return clamp(s);
  },

  "narrative-trader": (d) => {
    let s = 0;
    const earlyEntries = d.entryTimingsVsCreation.filter(
      (h) => h >= 0 && h < 48
    ).length;
    const total = d.entryTimingsVsCreation.length;
    if (total > 0 && earlyEntries / total > 0.6) s += 70;
    if (d.dominantCategoryPct < 0.5) s += 30; // spans multiple trending categories
    return clamp(s);
  },

  specialist: (d) => clamp(d.dominantCategoryPct * 120),

  "trend-chaser": (d) => {
    const values = Object.values(d.categoryDistribution);
    if (values.length < 2) return 0;
    // High concentration in one category but no category data consistency
    const max = Math.max(...values);
    let s = 0;
    if (max > 0.5) s += 50;
    if (d.tradeCount > 30) s += 30;
    if (d.uniqueMarketCount > 10) s += 20;
    return clamp(s);
  },

  contrarian: (d) => {
    let s = 0;
    if (d.avgEntryProbability < 0.35) s += 40;
    if (d.uniqueMarketCount > 10) s += 30;
    if (d.averageBetSizeUsdc < 50) s += 30;
    return clamp(s);
  },

  // ── Cluster 5: Position & Hold ───────────────────────────────────────────

  "diamond-hands": (d) => {
    let s = 0;
    if (d.openPositionCount > 2) s += 40;
    if (d.pnlTrend !== "down") s += 20;
    if (d.tradeCount < d.openPositionCount * 3) s += 40; // low turnover
    return clamp(s);
  },

  "locked-in": (d) => clamp(d.portfolioConcentration * 100),

  diversifier: (d) => {
    const maxSize =
      d.positionSizes.length > 0 ? Math.max(...d.positionSizes) : 0;
    const total = d.positionSizes.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    const topConc = maxSize / total;
    let s = 0;
    if (topConc < 0.05) s += 70;
    else if (topConc < 0.15) s += 40;
    if (d.uniqueMarketCount > 10) s += 30;
    return clamp(s);
  },

  accumulator: (d) => {
    // Proxy: high market count relative to positions suggests re-entry
    let s = 0;
    if (d.openPositionCount > 0 && d.tradeCount / d.openPositionCount > 3)
      s += 60;
    if (d.portfolioConcentration > 0.5) s += 40;
    return clamp(s);
  },

  hedger: (d) => {
    // Proxy: mix of YES/NO positions
    const yesFraction = d.yesBias;
    const balance = 1 - Math.abs(yesFraction - 0.5) * 2; // 1 = perfectly balanced
    return clamp(balance * 80 + (d.openPositionCount > 3 ? 20 : 0));
  },

  // ── Cluster 6: Probability ───────────────────────────────────────────────

  moonshot: (d) => {
    const lowProb = d.entryProbabilities.filter((p) => p < 0.2).length;
    const total = d.entryProbabilities.length;
    if (total === 0) return 0;
    return clamp((lowProb / total) * 100);
  },

  "safe-hands": (d) => {
    const highProb = d.entryProbabilities.filter((p) => p > 0.7).length;
    const total = d.entryProbabilities.length;
    if (total === 0) return 0;
    return clamp((highProb / total) * 100);
  },

  "coin-flip": (d) => {
    const midProb = d.entryProbabilities.filter(
      (p) => p >= 0.45 && p <= 0.55
    ).length;
    const total = d.entryProbabilities.length;
    if (total === 0) return 0;
    return clamp((midProb / total) * 100);
  },

  quant: (d) => {
    if (d.winRate === -1) return 0; // quant requires verified win rate
    let s = 0;
    if (wr(d) > 0.55) s += 50;
    if (d.netPnlUsdc > 0) s += 30;
    if (d.tradeCount > 20) s += 20;
    return clamp(s);
  },

  degen: (d) => {
    const veryLowProb = d.entryProbabilities.filter((p) => p < 0.1).length;
    const total = d.entryProbabilities.length;
    if (total === 0) return 0;
    return clamp((veryLowProb / total) * 100);
  },

  "efficiency-trader": (d) => {
    // Proxy: consistent bet sizing relative to portfolio
    if (d.positionSizes.length < 3) return 0;
    const sd = stdDev(d.positionSizes);
    const mean =
      d.positionSizes.reduce((a, b) => a + b, 0) / d.positionSizes.length;
    if (mean === 0) return 0;
    const cv = sd / mean; // coefficient of variation
    // Low CV = consistent sizing = Kelly-like behaviour
    return clamp((1 - cv) * 80 + (d.winRate > 0.5 ? 20 : 0));
  },

  // ── Cluster 7: Ecosystem ─────────────────────────────────────────────────

  "point-farmer": (d) => {
    if (d.totalVolumeUsdc === 0) return 0;
    const pointsPerUsdc = d.accumulativePoints / d.totalVolumeUsdc;
    return clamp(Math.min(pointsPerUsdc * 10, 100));
  },

  og: (d) => {
    let s = 0;
    if (d.accumulativePoints > 10_000) s += 60;
    else if (d.accumulativePoints > 3_000) s += 30;
    if (d.tradeCount > 100) s += 40;
    // Magnitude bonus: deep history earns higher OG score
    if (d.accumulativePoints > 100_000) s += 40;
    else if (d.accumulativePoints > 50_000) s += 25;
    else if (d.accumulativePoints > 20_000) s += 10;
    return clamp(s);
  },

  lurker: (d) => {
    let s = 0;
    if (d.uniqueMarketCount > 15) s += 50;
    if (d.averageBetSizeUsdc < 10) s += 30;
    if (d.openPositionCount > 10 && d.totalVolumeUsdc < 500) s += 20;
    return clamp(s);
  },

  "true-believer": (d) => {
    let s = 0;
    if (d.accumulativePoints > 5000) s += 50;
    if (d.tradeCount > 100) s += 30;
    if (d.netPnlUsdc > -1000) s += 20; // stayed despite varying results
    return clamp(s);
  },

  "hype-trader": (d) => {
    let s = 0;
    if (d.avgEntryProbability > 0.4 && d.avgEntryProbability < 0.7) s += 30;
    if (d.dominantCategoryPct > 0.4) s += 30;
    if (d.tradeCount > 30) s += 20;
    if (d.totalVolumeUsdc > 5_000) s += 20;
    return clamp(s);
  },
};

// ─── Main classify function ───────────────────────────────────────────────────

export interface ScoredCard {
  card: CardConfig;
  score: number;
}

export function classifyTrader(d: DerivedData): ScoredCard {
  const scores: ScoredCard[] = CARD_CONFIGS.map((card) => {
    const scorer = SCORERS[card.id];
    const score = scorer ? scorer(d) : 0;
    return { card, score };
  });

  scores.sort((a, b) => b.score - a.score);

  // Tiebreaker: if top two are within 5 points, pick based on strongest primary signal
  const top = scores[0];
  const second = scores[1];
  if (second && Math.abs(top.score - second.score) <= 5) {
    // Keep top — primary trigger is already strongest by definition
  }

  return top;
}

export function getAllScores(d: DerivedData): ScoredCard[] {
  return CARD_CONFIGS.map((card) => {
    const scorer = SCORERS[card.id];
    return { card, score: scorer ? scorer(d) : 0 };
  }).sort((a, b) => b.score - a.score);
}
