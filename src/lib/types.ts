export interface CardConfig {
  id: string;
  title: string;
  accentColour: string;
  motivationTemplate: string;
  cluster: string;
}

export interface TraderStats {
  winRate: number;       // percentage (e.g. 68), or -1 = not enough data
  pnl: number;          // net P&L in USDC
  volume: number;       // total traded volume in USDC
  bestDay: number;      // largest single-day P&L gain in USDC
}

export interface TraderCardData {
  card: CardConfig;
  stats: TraderStats;
  walletAddress: string;
}
