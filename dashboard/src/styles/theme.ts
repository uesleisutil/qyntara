/* Shared theme constants — extracted from inline styles for better perf (#7) */

export const getTheme = (darkMode: boolean) => ({
  bg: darkMode ? '#0f172a' : '#f8fafc',
  cardBg: darkMode ? '#1e293b' : 'white',
  text: darkMode ? '#f1f5f9' : '#0f172a',
  textSecondary: darkMode ? '#94a3b8' : '#64748b',
  border: darkMode ? '#334155' : '#e2e8f0',
  hover: darkMode ? '#334155' : '#f1f5f9',
  green: '#10b981',
  red: '#ef4444',
  yellow: '#f59e0b',
  blue: '#3b82f6',
  purple: '#8b5cf6',
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
