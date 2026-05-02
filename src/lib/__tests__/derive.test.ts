import { describe, it, expect } from "vitest";
import { deriveData } from "../derive";
import type { RawPortfolioData, MarketInfo, ClobPosition } from "../limitless-api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRawPortfolio(overrides: {
  volume?: string;
  clob?: ClobPosition[];
  amm?: RawPortfolioData["positions"]["amm"];
  pnl?: { timestamp: number; value: number }[];
  points?: string;
  accumulativePoints?: string;
  rewards?: RawPortfolioData["positions"]["rewards"];
} = {}): RawPortfolioData {
  return {
    tradedVolume: { data: overrides.volume ?? "10000" },
    positions: {
      points: overrides.points ?? "0",
      accumulativePoints: overrides.accumulativePoints ?? "1000",
      rewards: overrides.rewards ?? {
        todaysRewards: "0",
        totalUnpaidRewards: "0",
        rewardsChartData: [],
        rewardsByEpoch: [],
      },
      amm: overrides.amm ?? [],
      clob: overrides.clob ?? [],
      group: [],
    },
    pnlChart: {
      timeframe: "all",
      data: overrides.pnl ?? [
        { timestamp: 1, value: 0 },
        { timestamp: 2, value: 10 },
        { timestamp: 3, value: 5 },
        { timestamp: 4, value: 20 },
        { timestamp: 5, value: 30 },
      ],
    },
  };
}

function makeClobPosition(overrides: Partial<ClobPosition> = {}): ClobPosition {
  return {
    market: {
      id: 1,
      slug: "test-market",
      status: "FUNDED",
    },
    positions: {
      yes: {
        cost: "100000000",       // 100 USDC (6 decimals)
        fillPrice: "500000",     // 0.50
        marketValue: "120000000",
        realisedPnl: "20000000", // +20 USDC
        unrealizedPnl: "0",
      },
    },
    tokensBalance: { yes: "200", no: "0" },
    ...overrides,
  };
}

const emptyMarketDetails = new Map<string, MarketInfo>();

// ─── Basic derivation ────────────────────────────────────────────────────────

describe("deriveData — basics", () => {
  it("derives totalVolumeUsdc from tradedVolume.data string", () => {
    const d = deriveData(makeRawPortfolio({ volume: "50000" }), emptyMarketDetails);
    expect(d.totalVolumeUsdc).toBe(50000);
  });

  it("handles zero volume", () => {
    const d = deriveData(makeRawPortfolio({ volume: "0" }), emptyMarketDetails);
    expect(d.totalVolumeUsdc).toBe(0);
    // tradeCount is clamped to min 1 by: Math.max(1, Math.min(...))
    expect(d.tradeCount).toBeGreaterThanOrEqual(1);
    expect(d.averageBetSizeUsdc).toBe(0);
  });

  it("counts open positions from clob + amm", () => {
    const clob = [makeClobPosition(), makeClobPosition()];
    const amm = [{
      collateralAmount: "50000000",
      outcomeIndex: 0,
      outcomeTokenAmount: "100",
      market: { id: 2, slug: "amm-market" },
      account: "0x123",
    }];
    const d = deriveData(makeRawPortfolio({ clob, amm }), emptyMarketDetails);
    expect(d.openPositionCount).toBe(3);
    expect(d.clobPositionCount).toBe(2);
    expect(d.ammPositionCount).toBe(1);
  });
});

// ─── P&L curve and trend ─────────────────────────────────────────────────────

describe("deriveData — P&L", () => {
  it("computes netPnlUsdc from last pnlCurve value", () => {
    const d = deriveData(makeRawPortfolio({
      pnl: [
        { timestamp: 1, value: 0 },
        { timestamp: 2, value: -50 },
        { timestamp: 3, value: 100 },
      ],
    }), emptyMarketDetails);
    expect(d.netPnlUsdc).toBe(100);
  });

  it("computes bestDayUsdc and worstDayUsdc from daily deltas", () => {
    const d = deriveData(makeRawPortfolio({
      pnl: [
        { timestamp: 1, value: 0 },
        { timestamp: 2, value: 100 },  // +100
        { timestamp: 3, value: 50 },   // -50
        { timestamp: 4, value: 200 },  // +150
      ],
    }), emptyMarketDetails);
    expect(d.bestDayUsdc).toBe(150);
    expect(d.worstDayUsdc).toBe(-50);
  });

  it("returns flat trend for short curves", () => {
    const d = deriveData(makeRawPortfolio({
      pnl: [{ timestamp: 1, value: 5 }, { timestamp: 2, value: 10 }],
    }), emptyMarketDetails);
    expect(d.pnlTrend).toBe("flat");
  });

  it("detects up trend", () => {
    // Need curve where sd < |mean| * 0.5 to avoid "volatile" classification
    // Use a curve centered at a high mean with small increments
    const pnl = Array.from({ length: 10 }, (_, i) => ({
      timestamp: i,
      value: 500 + i * 10, // mean ~545, range 90, sd ~29 < 545*0.5=272
    }));
    const d = deriveData(makeRawPortfolio({ pnl }), emptyMarketDetails);
    expect(d.pnlTrend).toBe("up");
  });

  it("detects down trend", () => {
    // Same approach: high mean, gentle decline
    const pnl = Array.from({ length: 10 }, (_, i) => ({
      timestamp: i,
      value: 600 - i * 10, // mean ~555, range 90, sd ~29 < 555*0.5=277
    }));
    const d = deriveData(makeRawPortfolio({ pnl }), emptyMarketDetails);
    expect(d.pnlTrend).toBe("down");
  });

  it("detects v-shape trend", () => {
    // Drop significantly below start, then recover above start
    const pnl = [
      { timestamp: 0, value: 100 },
      { timestamp: 1, value: 50 },
      { timestamp: 2, value: -100 },  // min, well below first - range*0.4
      { timestamp: 3, value: 0 },
      { timestamp: 4, value: 50 },
      { timestamp: 5, value: 150 },   // last > first
    ];
    const d = deriveData(makeRawPortfolio({ pnl }), emptyMarketDetails);
    expect(d.pnlTrend).toBe("v-shape");
  });

  it("detects exponential trend", () => {
    // q3 value should be < last * 0.3, and last > first
    const pnl = [
      { timestamp: 0, value: 0 },
      { timestamp: 1, value: 1 },
      { timestamp: 2, value: 2 },
      { timestamp: 3, value: 3 },
      { timestamp: 4, value: 5 },
      { timestamp: 5, value: 10 },
      { timestamp: 6, value: 20 },
      { timestamp: 7, value: 100 },
    ];
    const d = deriveData(makeRawPortfolio({ pnl }), emptyMarketDetails);
    expect(d.pnlTrend).toBe("exponential");
  });

  it("handles empty pnl data", () => {
    const d = deriveData(makeRawPortfolio({ pnl: [] }), emptyMarketDetails);
    expect(d.netPnlUsdc).toBe(0);
    expect(d.bestDayUsdc).toBe(0);
    expect(d.worstDayUsdc).toBe(0);
    expect(d.pnlCurve).toEqual([]);
  });
});

// ─── Trade count estimation ──────────────────────────────────────────────────

describe("deriveData — trade count estimation", () => {
  it("estimates from median position size with ≥3 positions", () => {
    const clob = [
      makeClobPosition({ positions: { yes: { cost: "50000000", fillPrice: "500000", marketValue: "0", realisedPnl: "0", unrealizedPnl: "0" } } }),
      makeClobPosition({ positions: { yes: { cost: "100000000", fillPrice: "500000", marketValue: "0", realisedPnl: "0", unrealizedPnl: "0" } } }),
      makeClobPosition({ positions: { yes: { cost: "200000000", fillPrice: "500000", marketValue: "0", realisedPnl: "0", unrealizedPnl: "0" } } }),
    ];
    const d = deriveData(makeRawPortfolio({ volume: "1000", clob }), emptyMarketDetails);
    // Median of [50, 100, 200] = 100, so 1000/100 = 10 trades
    expect(d.tradeCount).toBe(10);
  });

  it("clamps trade count to at least 1", () => {
    const d = deriveData(makeRawPortfolio({ volume: "1" }), emptyMarketDetails);
    expect(d.tradeCount).toBeGreaterThanOrEqual(1);
  });

  it("uses activeDays fallback when no positions", () => {
    const pnl = Array.from({ length: 20 }, (_, i) => ({
      timestamp: i,
      value: i % 2 === 0 ? i * 50 : i * 50 - 30,
    }));
    const d = deriveData(makeRawPortfolio({ volume: "5000", pnl }), emptyMarketDetails);
    expect(d.tradeCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── Win rate ────────────────────────────────────────────────────────────────

describe("deriveData — win rate", () => {
  it("returns -1 when no data is available", () => {
    const d = deriveData(makeRawPortfolio({
      clob: [], pnl: [{ timestamp: 1, value: 0 }],
    }), emptyMarketDetails);
    expect(d.winRate).toBe(-1);
    expect(d.winRateSource).toBe("none");
  });

  it("uses realisedPnl method when positions have PnL data", () => {
    const winning = makeClobPosition({
      positions: { yes: { cost: "100000000", fillPrice: "500000", marketValue: "0", realisedPnl: "50000000", unrealizedPnl: "0" } },
    });
    const losing = makeClobPosition({
      positions: { yes: { cost: "100000000", fillPrice: "500000", marketValue: "0", realisedPnl: "-30000000", unrealizedPnl: "0" } },
    });
    // 2-point pnl chart → 1 delta, below the dailyPnl threshold (3), so the
    // realisedPnl candidate is the only one active and is selected.
    const d = deriveData(
      makeRawPortfolio({
        clob: [winning, winning, losing],
        pnl: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 50 }],
      }),
      emptyMarketDetails,
    );
    // 2 wins out of 3
    expect(d.winRate).toBeCloseTo(0.667, 2);
    expect(d.winRateSource).toBe("realisedPnl");
  });

  it("picks method with most data points", () => {
    // 2 CLOB positions (realisedPnl method) vs 10+ daily deltas (dailyPnl method)
    const winning = makeClobPosition({
      positions: { yes: { cost: "100000000", fillPrice: "500000", marketValue: "0", realisedPnl: "50000000", unrealizedPnl: "0" } },
    });
    const pnl = Array.from({ length: 15 }, (_, i) => ({
      timestamp: i,
      value: i * 10, // all positive days → high daily win rate
    }));
    const d = deriveData(
      makeRawPortfolio({ clob: [winning, winning], pnl }),
      emptyMarketDetails,
    );
    // dailyPnl has 14 data points vs realisedPnl has 2
    expect(d.winRateSource).toBe("dailyPnl");
  });
});

// ─── Portfolio metrics ───────────────────────────────────────────────────────

describe("deriveData — portfolio metrics", () => {
  it("computes uniqueMarketCount from slugs", () => {
    const clob = [
      makeClobPosition({ market: { id: 1, slug: "market-a" } }),
      makeClobPosition({ market: { id: 2, slug: "market-b" } }),
      makeClobPosition({ market: { id: 3, slug: "market-a" } }), // duplicate
    ];
    const d = deriveData(makeRawPortfolio({ clob }), emptyMarketDetails);
    expect(d.uniqueMarketCount).toBe(2);
  });

  it("computes yesBias correctly", () => {
    const yesPos = makeClobPosition({
      tokensBalance: { yes: "100", no: "0" },
    });
    const noPos = makeClobPosition({
      tokensBalance: { yes: "0", no: "100" },
    });
    const d = deriveData(
      makeRawPortfolio({ clob: [yesPos, yesPos, noPos] }),
      emptyMarketDetails,
    );
    // 2 yes out of 3 sided
    expect(d.yesBias).toBeCloseTo(0.667, 2);
  });

  it("defaults yesBias to 0.5 with no positions", () => {
    const d = deriveData(makeRawPortfolio(), emptyMarketDetails);
    expect(d.yesBias).toBe(0.5);
  });

  it("computes portfolioConcentration from top-3 positions", () => {
    const makePos = (cost: string) => makeClobPosition({
      positions: { yes: { cost, fillPrice: "500000", marketValue: "0", realisedPnl: "0", unrealizedPnl: "0" } },
    });
    const clob = [
      makePos("500000000"),  // 500
      makePos("300000000"),  // 300
      makePos("100000000"),  // 100
      makePos("50000000"),   // 50
      makePos("50000000"),   // 50
    ];
    const d = deriveData(makeRawPortfolio({ clob }), emptyMarketDetails);
    // top 3 = 500+300+100 = 900, total = 1000, concentration = 0.9
    expect(d.portfolioConcentration).toBeCloseTo(0.9, 1);
  });
});

// ─── Category distribution ───────────────────────────────────────────────────

describe("deriveData — categories", () => {
  it("computes category distribution from market details", () => {
    const clob = [
      makeClobPosition({ market: { id: 1, slug: "sports-1" } }),
      makeClobPosition({ market: { id: 2, slug: "sports-2" } }),
      makeClobPosition({ market: { id: 3, slug: "crypto-1" } }),
    ];
    const marketMap = new Map<string, MarketInfo>([
      ["sports-1", { id: 1, slug: "sports-1", categories: ["Sports"] }],
      ["sports-2", { id: 2, slug: "sports-2", categories: ["Sports"] }],
      ["crypto-1", { id: 3, slug: "crypto-1", categories: ["Crypto"] }],
    ]);
    const d = deriveData(makeRawPortfolio({ clob }), marketMap);
    expect(d.categoryDistribution["sports"]).toBeCloseTo(0.667, 2);
    expect(d.categoryDistribution["crypto"]).toBeCloseTo(0.333, 2);
    expect(d.dominantCategory).toBe("sports");
  });

  it("falls back to tags when categories missing", () => {
    const clob = [makeClobPosition({ market: { id: 1, slug: "m1" } })];
    const marketMap = new Map<string, MarketInfo>([
      ["m1", { id: 1, slug: "m1", tags: ["Politics"] }],
    ]);
    const d = deriveData(makeRawPortfolio({ clob }), marketMap);
    expect(d.categoryDistribution["politics"]).toBe(1);
  });
});

// ─── Entry probabilities ─────────────────────────────────────────────────────

describe("deriveData — entry probabilities", () => {
  it("extracts probabilities from fill prices", () => {
    const pos = makeClobPosition({
      positions: {
        yes: { cost: "100000000", fillPrice: "600000", marketValue: "0", realisedPnl: "0", unrealizedPnl: "0" },
      },
    });
    const d = deriveData(makeRawPortfolio({ clob: [pos] }), emptyMarketDetails);
    // fillPrice 600000 / 1e6 = 0.6
    expect(d.entryProbabilities[0]).toBeCloseTo(0.6, 2);
    expect(d.avgEntryProbability).toBeCloseTo(0.6, 2);
  });

  it("defaults avgEntryProbability to 0.5 with no data", () => {
    const d = deriveData(makeRawPortfolio(), emptyMarketDetails);
    expect(d.avgEntryProbability).toBe(0.5);
  });
});

// ─── Ecosystem metrics ───────────────────────────────────────────────────────

describe("deriveData — ecosystem", () => {
  it("parses points and accumulativePoints", () => {
    const d = deriveData(makeRawPortfolio({
      points: "123.456",
      accumulativePoints: "9999.99",
    }), emptyMarketDetails);
    expect(d.points).toBeCloseTo(123.456);
    expect(d.accumulativePoints).toBeCloseTo(9999.99);
  });

  it("handles missing/zero reward data", () => {
    const d = deriveData(makeRawPortfolio(), emptyMarketDetails);
    expect(d.rewardEarnings).toBe(0);
  });
});
