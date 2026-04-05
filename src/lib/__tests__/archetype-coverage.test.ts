/**
 * Archetype coverage test — verifies all 48 archetypes are reachable.
 *
 * For each card ID we craft a DerivedData profile that should make that
 * archetype win (highest score). This simulates the real-world scenario of
 * 10,000+ diverse wallets hitting the system — every archetype must be
 * triggerable by some wallet profile.
 */

import { describe, it, expect } from "vitest";
import { classifyTrader, getAllScores } from "../score";
import { CARD_CONFIGS } from "../cards";
import type { DerivedData } from "../derive";

// ─── Base profile with neutral/low values so specific overrides dominate ────

function base(overrides: Partial<DerivedData> = {}): DerivedData {
  return {
    totalVolumeUsdc: 500,
    tradeCount: 10,
    averageBetSizeUsdc: 50,
    netPnlUsdc: 0,
    winRate: -1,
    winRateSource: "none",
    pnlCurve: [0, 1, 2, 3, 4],
    bestDayUsdc: 5,
    worstDayUsdc: -2,
    pnlTrend: "flat",
    openPositionCount: 2,
    positionSizes: [50, 50],
    yesBias: 0.5,
    ammPositionCount: 0,
    clobPositionCount: 2,
    uniqueMarketCount: 3,
    portfolioConcentration: 0.5,
    categoryDistribution: {},
    dominantCategory: "unknown",
    dominantCategoryPct: 0,
    entryTimingsVsCreation: [],
    entryTimingsVsExpiry: [],
    avgEntryHoursAfterCreation: 100,
    avgEntryHoursBeforeExpiry: 100,
    points: 0,
    accumulativePoints: 200,
    rewardEarnings: 0,
    entryProbabilities: [],
    avgEntryProbability: 0.5,
    activeDays: 5,
    ...overrides,
  };
}

// ─── Profile map: card ID → DerivedData overrides that make it win ──────────

const WINNING_PROFILES: Record<string, Partial<DerivedData>> = {
  // Cluster 1: Volume & Size
  whale: {
    totalVolumeUsdc: 1_500_000,
    averageBetSizeUsdc: 5000,
    tradeCount: 150,
  },
  shrimp: {
    tradeCount: 50,
    averageBetSizeUsdc: 3,
    totalVolumeUsdc: 150,
    openPositionCount: 0,
    positionSizes: [],
  },
  shark: {
    totalVolumeUsdc: 80_000,
    winRate: 0.7,
    winRateSource: "realisedPnl",
    pnlTrend: "up",
    netPnlUsdc: 5000,
    positionSizes: [200, 200, 200, 200, 200],
    averageBetSizeUsdc: 200,
    tradeCount: 400,
    accumulativePoints: 5000,
  },
  swarm: {
    tradeCount: 300,
    averageBetSizeUsdc: 2,
    totalVolumeUsdc: 3000,
    openPositionCount: 0,
    positionSizes: [],
    accumulativePoints: 50,
  },
  sniper: {
    positionSizes: [1, 1, 1, 1, 1, 1, 1, 1, 1, 500],
    tradeCount: 10,
    bestDayUsdc: 2000,
    openPositionCount: 1,
    totalVolumeUsdc: 600,
    accumulativePoints: 50,
  },
  arrival: {
    accumulativePoints: 100,
    totalVolumeUsdc: 20_000,
    tradeCount: 15,
    averageBetSizeUsdc: 1000,
    openPositionCount: 0,
    positionSizes: [],
  },
  "size-queen": {
    positionSizes: [500, 500, 500, 500, 500, 500, 500, 500],
    averageBetSizeUsdc: 500,
    totalVolumeUsdc: 4000,
    tradeCount: 8,
    openPositionCount: 8,
    accumulativePoints: 50,
  },
  dripper: {
    openPositionCount: 35,
    averageBetSizeUsdc: 2,
    uniqueMarketCount: 30,
    totalVolumeUsdc: 600,
    tradeCount: 15,
    positionSizes: Array(35).fill(2),
    accumulativePoints: 50,
  },

  // Cluster 2: Win Rate & P&L
  oracle: {
    winRate: 0.75,
    winRateSource: "realisedPnl",
    pnlTrend: "up",
    netPnlUsdc: 10000,
    totalVolumeUsdc: 50000,
    tradeCount: 200,
    averageBetSizeUsdc: 250,
    accumulativePoints: 5000,
    positionSizes: [100, 300, 50, 400, 200],
  },
  rekt: {
    netPnlUsdc: -15000,
    winRate: 0.15,
    winRateSource: "realisedPnl",
    tradeCount: 80,
    pnlTrend: "down",
    totalVolumeUsdc: 5000,
    openPositionCount: 0,
    positionSizes: [],
    accumulativePoints: 300,
  },
  "comeback-kid": {
    pnlTrend: "v-shape",
    pnlCurve: [100, 50, -200, -300, -100, 50, 150],
    netPnlUsdc: 150,
    totalVolumeUsdc: 2000,
    openPositionCount: 0,
    positionSizes: [],
    accumulativePoints: 50,
  },
  "one-hit-wonder": {
    bestDayUsdc: 9500,
    netPnlUsdc: 10000,
    pnlCurve: [0, 100, 50, 9500, 10000],
    totalVolumeUsdc: 15000,
    tradeCount: 5,
    openPositionCount: 0,
    positionSizes: [],
    accumulativePoints: 1500,
  },
  "slow-rug": {
    pnlTrend: "down",
    netPnlUsdc: -3000,
    pnlCurve: [1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 0, -100],
    totalVolumeUsdc: 5000,
    openPositionCount: 0,
    positionSizes: [],
    tradeCount: 8,
    accumulativePoints: 50,
    winRate: 0.42,
    winRateSource: "realisedPnl",
  },
  ascent: {
    pnlTrend: "exponential",
    pnlCurve: [0, 10, 30, 100, 300, 1000, 3000],
    netPnlUsdc: 3000,
    totalVolumeUsdc: 8000,
    openPositionCount: 0,
    positionSizes: [],
    accumulativePoints: 1500,
  },
  "mid-curve": {
    netPnlUsdc: 2,
    totalVolumeUsdc: 80000,
    tradeCount: 200,
    pnlTrend: "flat",
    averageBetSizeUsdc: 400,
    accumulativePoints: 5000,
  },
  hodler: {
    openPositionCount: 15,
    netPnlUsdc: -2000,
    pnlTrend: "down",
    winRate: 0.41,
    winRateSource: "realisedPnl",
    tradeCount: 20,
    totalVolumeUsdc: 3000,
    positionSizes: Array(15).fill(200),
    accumulativePoints: 300,
  },
  "contrarian-king": {
    winRate: 0.65,
    winRateSource: "realisedPnl",
    avgEntryProbability: 0.2,
    entryProbabilities: [0.15, 0.2, 0.18, 0.22, 0.19],
    netPnlUsdc: 3000,
    totalVolumeUsdc: 5000,
    tradeCount: 20,
    accumulativePoints: 300,
  },

  // Cluster 3: Frequency & Timing
  scout: {
    entryTimingsVsCreation: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15],
    avgEntryHoursAfterCreation: 7,
    tradeCount: 10,
    totalVolumeUsdc: 500,
    accumulativePoints: 50,
    openPositionCount: 0,
    positionSizes: [],
    dominantCategoryPct: 0.8,
  },
  grinder: {
    tradeCount: 400,
    accumulativePoints: 8000,
    uniqueMarketCount: 40,
    totalVolumeUsdc: 20000,
    averageBetSizeUsdc: 50,
    netPnlUsdc: -1500,
    openPositionCount: 5,
    positionSizes: [50, 50, 50, 50, 50],
    rewardEarnings: 10,
  },
  tourist: {
    tradeCount: 2,
    openPositionCount: 0,
    accumulativePoints: 10,
    totalVolumeUsdc: 30,
    averageBetSizeUsdc: 15,
    positionSizes: [],
    entryProbabilities: [],
    entryTimingsVsCreation: [],
    entryTimingsVsExpiry: [],
    uniqueMarketCount: 1,
    portfolioConcentration: 0,
    categoryDistribution: {},
    dominantCategoryPct: 0,
    netPnlUsdc: 0,
    pnlCurve: [],
  },
  sprinter: {
    tradeCount: 100,
    openPositionCount: 1,
    rewardEarnings: 0,
    accumulativePoints: 2000,
    totalVolumeUsdc: 5000,
    averageBetSizeUsdc: 50,
    positionSizes: [50],
    uniqueMarketCount: 5,
    netPnlUsdc: 500,
  },
  closer: {
    entryTimingsVsExpiry: [1, 2, 3, 4, 5, 6, 8, 10, 12, 3],
    avgEntryHoursBeforeExpiry: 5,
    tradeCount: 10,
    totalVolumeUsdc: 500,
    accumulativePoints: 50,
    openPositionCount: 0,
    positionSizes: [],
  },

  // Cluster 4: Category
  "sports-bettor": {
    categoryDistribution: { sports: 0.95 },
    dominantCategory: "sports",
    dominantCategoryPct: 0.8,
    totalVolumeUsdc: 500,
    accumulativePoints: 50,
  },
  "crypto-maximalist": {
    categoryDistribution: { crypto: 0.6, cryptocurrency: 0.35 },
    dominantCategory: "crypto",
    dominantCategoryPct: 0.6,
    totalVolumeUsdc: 500,
    accumulativePoints: 50,
  },
  "political-animal": {
    categoryDistribution: { politics: 0.5, elections: 0.3, political: 0.15 },
    dominantCategory: "politics",
    dominantCategoryPct: 0.5,
    totalVolumeUsdc: 500,
    accumulativePoints: 50,
  },
  "pop-culture-prophet": {
    categoryDistribution: { entertainment: 0.5, culture: 0.3, celebrity: 0.15 },
    dominantCategory: "entertainment",
    dominantCategoryPct: 0.5,
    totalVolumeUsdc: 500,
    accumulativePoints: 50,
  },
  "macro-mind": {
    categoryDistribution: { macro: 0.3, economics: 0.3, finance: 0.2, global: 0.15 },
    dominantCategory: "macro",
    dominantCategoryPct: 0.3,
    totalVolumeUsdc: 500,
    accumulativePoints: 50,
  },
  generalist: {
    categoryDistribution: {
      sports: 0.15, crypto: 0.15, politics: 0.15,
      entertainment: 0.15, macro: 0.15, science: 0.13, other: 0.12,
    },
    dominantCategory: "sports",
    dominantCategoryPct: 0.15,
    totalVolumeUsdc: 500,
    accumulativePoints: 50,
    openPositionCount: 0,
    positionSizes: [],
  },
  "narrative-trader": {
    entryTimingsVsCreation: [2, 4, 6, 8, 10, 12, 14, 60, 70, 80],
    avgEntryHoursAfterCreation: 30,
    dominantCategoryPct: 0.3,
    categoryDistribution: { sports: 0.3, crypto: 0.3, politics: 0.2, macro: 0.2 },
    totalVolumeUsdc: 500,
    accumulativePoints: 50,
    openPositionCount: 0,
    positionSizes: [],
  },
  specialist: {
    dominantCategoryPct: 1.0,
    categoryDistribution: { sports: 1.0 },
    dominantCategory: "sports",
    totalVolumeUsdc: 500,
    accumulativePoints: 50,
    openPositionCount: 0,
    positionSizes: [],
    entryTimingsVsCreation: [],
  },
  "trend-chaser": {
    categoryDistribution: { crypto: 0.65, politics: 0.35 },
    dominantCategoryPct: 0.65,
    tradeCount: 50,
    uniqueMarketCount: 15,
    totalVolumeUsdc: 2000,
    accumulativePoints: 50,
    openPositionCount: 0,
    positionSizes: [],
  },
  contrarian: {
    avgEntryProbability: 0.25,
    entryProbabilities: [0.2, 0.25, 0.3, 0.28, 0.22],
    uniqueMarketCount: 15,
    averageBetSizeUsdc: 20,
    totalVolumeUsdc: 500,
    accumulativePoints: 50,
    openPositionCount: 0,
    positionSizes: [],
  },

  // Cluster 5: Position & Hold
  "diamond-hands": {
    openPositionCount: 20,
    tradeCount: 22,
    pnlTrend: "up",
    totalVolumeUsdc: 2000,
    positionSizes: Array(20).fill(100),
    accumulativePoints: 50,
    averageBetSizeUsdc: 100,
  },
  "locked-in": {
    portfolioConcentration: 0.98,
    totalVolumeUsdc: 500,
    openPositionCount: 1,
    positionSizes: [500],
    accumulativePoints: 50,
    tradeCount: 2,
    pnlTrend: "down", // suppress diamond-hands (+0 for down)
  },
  diversifier: {
    positionSizes: Array(30).fill(10),
    uniqueMarketCount: 30,
    openPositionCount: 30,
    totalVolumeUsdc: 500,
    averageBetSizeUsdc: 10,
    tradeCount: 100, // 100 >= 30*3 → diamond-hands turnover bonus = 0
    accumulativePoints: 50,
    yesBias: 0.9, // suppress hedger (balance = 1 - |0.9-0.5|*2 = 0.2)
    pnlTrend: "down", // suppress diamond-hands pnlTrend bonus
  },
  accumulator: {
    openPositionCount: 5,
    tradeCount: 50,
    portfolioConcentration: 0.7,
    totalVolumeUsdc: 2000,
    positionSizes: [200, 200, 200, 200, 200],
    averageBetSizeUsdc: 40,
    accumulativePoints: 200,
  },
  hedger: {
    yesBias: 0.5,
    openPositionCount: 10,
    positionSizes: Array(10).fill(50),
    totalVolumeUsdc: 500,
    tradeCount: 40, // 40 >= 10*3 → diamond-hands turnover bonus = 0
    accumulativePoints: 50,
    pnlTrend: "down", // suppress diamond-hands pnlTrend bonus
  },

  // Cluster 6: Probability
  moonshot: {
    entryProbabilities: [0.05, 0.08, 0.1, 0.12, 0.07, 0.09, 0.06, 0.11, 0.04, 0.15],
    avgEntryProbability: 0.09,
    totalVolumeUsdc: 500,
    accumulativePoints: 50,
    openPositionCount: 0,
    positionSizes: [],
  },
  "safe-hands": {
    entryProbabilities: [0.8, 0.85, 0.9, 0.75, 0.82, 0.88, 0.78, 0.92],
    avgEntryProbability: 0.84,
    totalVolumeUsdc: 500,
    accumulativePoints: 50,
    openPositionCount: 0,
    positionSizes: [],
  },
  "coin-flip": {
    entryProbabilities: [0.48, 0.50, 0.52, 0.49, 0.51, 0.50, 0.47, 0.53],
    avgEntryProbability: 0.5,
    totalVolumeUsdc: 500,
    accumulativePoints: 50,
    openPositionCount: 0,
    positionSizes: [],
  },
  quant: {
    winRate: 0.7,
    winRateSource: "realisedPnl",
    netPnlUsdc: 5000,
    tradeCount: 50,
    totalVolumeUsdc: 20000,
    averageBetSizeUsdc: 400,
    accumulativePoints: 2000,
  },
  degen: {
    entryProbabilities: [0.02, 0.03, 0.05, 0.01, 0.04, 0.03, 0.02, 0.06, 0.01, 0.03],
    avgEntryProbability: 0.03,
    totalVolumeUsdc: 500,
    accumulativePoints: 50,
    openPositionCount: 0,
    positionSizes: [],
  },
  "efficiency-trader": {
    positionSizes: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
    winRate: 0.6,
    winRateSource: "realisedPnl",
    totalVolumeUsdc: 1000,
    averageBetSizeUsdc: 100,
    tradeCount: 35,
    openPositionCount: 10,
    accumulativePoints: 50,
    yesBias: 0.8,
    pnlTrend: "down",
  },

  // Cluster 7: Ecosystem
  "point-farmer": {
    accumulativePoints: 50000,
    totalVolumeUsdc: 500,
    tradeCount: 5,
    openPositionCount: 0,
    positionSizes: [],
  },
  og: {
    accumulativePoints: 120_000,
    tradeCount: 300,
    totalVolumeUsdc: 50000,
    averageBetSizeUsdc: 167,
  },
  lurker: {
    uniqueMarketCount: 25,
    averageBetSizeUsdc: 3,
    openPositionCount: 2,
    totalVolumeUsdc: 200,
    tradeCount: 15,
    positionSizes: [3, 3],
    accumulativePoints: 50,
    yesBias: 0.8,
    pnlTrend: "down",
    netPnlUsdc: 20,
  },
  "true-believer": {
    accumulativePoints: 8000,
    tradeCount: 200,
    netPnlUsdc: -500,
    totalVolumeUsdc: 10000,
    averageBetSizeUsdc: 50,
    openPositionCount: 5,
    rewardEarnings: 5,
    yesBias: 0.9,
  },
  "hype-trader": {
    avgEntryProbability: 0.55,
    entryProbabilities: [0.5, 0.55, 0.6, 0.52, 0.58],
    dominantCategoryPct: 0.6,
    categoryDistribution: { crypto: 0.6, politics: 0.4 },
    tradeCount: 50,
    totalVolumeUsdc: 8000,
    averageBetSizeUsdc: 160,
    accumulativePoints: 200,
    openPositionCount: 0,
    positionSizes: [],
  },
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Archetype coverage — every card can be the #1 winner", () => {
  // First verify we have profiles for all 48 cards
  it("has a winning profile for every card config", () => {
    const profileIds = Object.keys(WINNING_PROFILES);
    const configIds = CARD_CONFIGS.map((c) => c.id);

    const missing = configIds.filter((id) => !profileIds.includes(id));
    expect(missing).toEqual([]);
    expect(profileIds.length).toBe(48);
  });

  // Test each archetype individually
  for (const [cardId, overrides] of Object.entries(WINNING_PROFILES)) {

    it(`"${cardId}" wins with its tailored profile`, () => {
      const d = base(overrides);
      const result = classifyTrader(d);

      // Primary assertion: this card wins
      expect(result.card.id).toBe(cardId);

      // Secondary: score should be meaningful (not a fluke 1-point win)
      expect(result.score).toBeGreaterThan(10);

      // Tertiary: all scores remain valid (no NaN/Infinity)
      const all = getAllScores(d);
      for (const s of all) {
        expect(Number.isFinite(s.score)).toBe(true);
        expect(s.score).toBeGreaterThanOrEqual(0);
      }
    });
  }

});

// ─── Stress: randomized wallets never produce broken output ─────────────────

describe("Stress — random wallet profiles produce valid output", () => {
  function randomProfile(): DerivedData {
    const vol = Math.random() * 2_000_000;
    const trades = Math.floor(Math.random() * 500) + 1;
    const wr = Math.random() > 0.2 ? Math.random() : -1;
    const positions = Math.floor(Math.random() * 50);
    const markets = Math.floor(Math.random() * 40) + 1;
    const cats = ["sports", "crypto", "politics", "entertainment", "macro", "science"];
    const catDist: Record<string, number> = {};
    let remaining = 1;
    for (const cat of cats.slice(0, Math.floor(Math.random() * 6) + 1)) {
      const share = Math.random() * remaining;
      catDist[cat] = share;
      remaining -= share;
    }

    return base({
      totalVolumeUsdc: vol,
      tradeCount: trades,
      averageBetSizeUsdc: vol / trades,
      netPnlUsdc: (Math.random() - 0.5) * 100000,
      winRate: wr,
      winRateSource: wr === -1 ? "none" : "realisedPnl",
      pnlCurve: Array.from({ length: 20 }, () => (Math.random() - 0.3) * 1000),
      bestDayUsdc: Math.random() * 10000,
      worstDayUsdc: -Math.random() * 5000,
      pnlTrend: ["up", "down", "flat", "volatile", "v-shape", "exponential"][
        Math.floor(Math.random() * 6)
      ] as DerivedData["pnlTrend"],
      openPositionCount: positions,
      positionSizes: Array.from({ length: positions }, () => Math.random() * 1000),
      yesBias: Math.random(),
      uniqueMarketCount: markets,
      portfolioConcentration: Math.random(),
      categoryDistribution: catDist,
      dominantCategoryPct: Math.random(),
      entryTimingsVsCreation: Array.from({ length: trades }, () => Math.random() * 200),
      entryTimingsVsExpiry: Array.from({ length: trades }, () => Math.random() * 200),
      avgEntryHoursAfterCreation: Math.random() * 100,
      avgEntryHoursBeforeExpiry: Math.random() * 100,
      accumulativePoints: Math.random() * 100000,
      points: Math.random() * 5000,
      rewardEarnings: Math.random() * 100,
      entryProbabilities: Array.from({ length: trades }, () => Math.random()),
      avgEntryProbability: Math.random(),
      activeDays: Math.floor(Math.random() * 365),
    });
  }

  // 200 random profiles — none should crash or produce invalid scores
  for (let i = 0; i < 200; i++) {
    it(`random profile #${i + 1} produces valid classification`, () => {
      const d = randomProfile();
      const result = classifyTrader(d);

      expect(result.card.id).toBeTruthy();
      expect(result.card.title).toBeTruthy();
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  }
});
