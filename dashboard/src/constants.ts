/**
 * Application-wide constants — single source of truth.
 * Nothing should be hardcoded in components; import from here.
 */

// ── Score thresholds ──
export const SCORE_BUY_THRESHOLD = 1.5;
export const SCORE_SELL_THRESHOLD = -1.5;

// ── Pricing ──
export const PRO_PRICE = 'R$ 49';
export const PRO_PRICE_LABEL = `${PRO_PRICE}/mês`;

// ── Signal helpers ──
export const getSignal = (score: number): 'Compra' | 'Venda' | 'Neutro' =>
  score >= SCORE_BUY_THRESHOLD ? 'Compra' : score <= SCORE_SELL_THRESHOLD ? 'Venda' : 'Neutro';

export const getSignalColor = (signal: string) => {
  if (signal === 'Compra') return { bg: 'rgba(16,185,129,0.15)', text: '#4ead8a', border: 'rgba(16,185,129,0.3)' };
  if (signal === 'Venda') return { bg: 'rgba(224,112,112,0.15)', text: '#e07070', border: 'rgba(224,112,112,0.3)' };
  return { bg: 'rgba(148,163,184,0.15)', text: '#8fa89c', border: 'rgba(148,163,184,0.3)' };
};

// ── S3 price data paths ──
/**
 * Returns S3 keys for the current month and previous month of daily price data.
 * This avoids hardcoding year=2026/month=03 everywhere.
 */
export function getPriceDataKeys(): string[] {
  const now = new Date();
  const keys: string[] = [];

  // Current month
  const curYear = now.getFullYear();
  const curMonth = String(now.getMonth() + 1).padStart(2, '0');
  keys.push(`curated/daily_monthly/year=${curYear}/month=${curMonth}/daily.csv`);

  // Previous month
  const prev = new Date(curYear, now.getMonth() - 1, 1);
  const prevYear = prev.getFullYear();
  const prevMonth = String(prev.getMonth() + 1).padStart(2, '0');
  keys.push(`curated/daily_monthly/year=${prevYear}/month=${prevMonth}/daily.csv`);

  return keys;
}

/**
 * Returns the S3 key for the current month's daily price data only.
 */
export function getCurrentMonthPriceKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `curated/daily_monthly/year=${year}/month=${month}/daily.csv`;
}

/**
 * Returns the S3 prefix for listing curated data months for the current year.
 */
export function getCuratedYearPrefix(): string {
  return `curated/daily_monthly/year=${new Date().getFullYear()}/`;
}

// ── Universe size (derive from data, use this as fallback) ──
export const UNIVERSE_SIZE_FALLBACK = 46;

/**
 * Returns a label like "46 ações" using the actual count when available.
 */
export function universeLabel(count?: number): string {
  return `${count ?? UNIVERSE_SIZE_FALLBACK} ações`;
}
