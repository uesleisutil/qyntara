/* Shared theme constants — extracted from inline styles for better perf (#7) */

/* ── Brand base — change here to re-skin the entire app ── */
const ACCENT = '#3b82f6';
const ACCENT_LIGHT = '#60a5fa';
const ACCENT_DARK = '#2563eb';

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

const accentRgb = hexToRgb(ACCENT);
const accentDarkRgb = hexToRgb(ACCENT_DARK);

/** Brand tokens derived from the accent color. */
export const brand = {
  accent: ACCENT,
  accentLight: ACCENT_LIGHT,
  accentDark: ACCENT_DARK,
  gradient: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})`,
  /** Accent with custom opacity, e.g. brand.alpha(0.12) */
  alpha: (o: number) => `rgba(${accentRgb},${o})`,
  alphaDark: (o: number) => `rgba(${accentDarkRgb},${o})`,
  glow: `rgba(${accentRgb},0.15)`,
  glowStrong: `rgba(${accentRgb},0.25)`,
  surface: `rgba(${accentRgb},0.04)`,
  surfaceHover: `rgba(${accentRgb},0.06)`,
  border: `rgba(${accentRgb},0.12)`,
  borderSubtle: `rgba(${accentRgb},0.08)`,
  accentSoft: `rgba(${accentRgb},0.12)`,
  accentBorder: `rgba(${accentRgb},0.25)`,
} as const;

export const getTheme = (darkMode: boolean) => ({
  bg: darkMode ? '#0f1117' : '#f8f9fb',
  cardBg: darkMode ? '#1a1d27' : 'white',
  text: darkMode ? '#e8eaf0' : '#0c0e14',
  textSecondary: darkMode ? '#9ba1b0' : '#5f6577',
  border: darkMode ? '#2a2e3a' : '#e0e2e8',
  hover: darkMode ? '#22252f' : '#f1f2f6',
  green: '#10b981',
  red: '#ef4444',
  yellow: '#f59e0b',
  blue: '#3b82f6',
} as const);

export type Theme = ReturnType<typeof getTheme>;

export const getCardStyle = (theme: Theme): React.CSSProperties => ({
  background: theme.cardBg,
  border: `1px solid ${theme.border}`,
  borderRadius: 12,
  padding: 'clamp(0.75rem, 3vw, 1.25rem)',
});

export const getChipStyle = (active: boolean, theme: Theme, color?: string): React.CSSProperties => ({
  padding: '0.35rem 0.7rem',
  borderRadius: 20,
  fontSize: '0.76rem',
  fontWeight: active ? 600 : 400,
  border: `1px solid ${active ? (color || theme.blue) : theme.border}`,
  background: active ? (color || theme.blue) : 'transparent',
  color: active ? 'white' : theme.textSecondary,
  cursor: 'pointer',
  transition: 'all 0.15s',
  WebkitAppearance: 'none' as any,
  whiteSpace: 'nowrap' as const,
});
