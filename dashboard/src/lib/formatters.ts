/**
 * Shared formatting utilities.
 * Replaces the duplicated `fmt` / `authHeaders` helpers scattered across 20+ files.
 */

/** Format a number with `d` decimal places; returns '—' for null / NaN. */
export const fmt = (v: number | null | undefined, d = 2): string =>
  v != null && !isNaN(Number(v)) ? Number(v).toFixed(d) : '—';

/** Format as percentage string, e.g. "12.34%" */
export const fmtPct = (v: number): string => `${(v * 100).toFixed(2)}%`;

/** Format as BRL currency, e.g. "R$ 1.234" */
export const fmtBRL = (v: number): string =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

/** Format as USD currency, e.g. "$12.34" */
export const fmtUsd = (v: number | null | undefined, d = 2): string =>
  v != null && !isNaN(Number(v)) ? `$${Number(v).toFixed(d)}` : '—';

/** Format as BRL with decimals, e.g. "R$ 49.90" */
export const fmtBrl = (v: number | null | undefined, d = 2): string =>
  v != null && !isNaN(Number(v)) ? `R$ ${Number(v).toFixed(d)}` : '—';

/** Format ISO date to pt-BR locale string */
export const fmtDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
};

/** Build auth headers from localStorage token */
export const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('authToken');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};
