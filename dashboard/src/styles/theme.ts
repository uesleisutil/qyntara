/* Shared theme constants — extracted from inline styles for better perf (#7) */
/* Palette: Lavender-Green — soft, calming tones for confident decision-making */

export const getTheme = (darkMode: boolean) => ({
  bg: darkMode ? '#121a1a' : '#f6faf8',
  cardBg: darkMode ? '#1a2626' : 'white',
  text: darkMode ? '#e8f0ed' : '#0f1a16',
  textSecondary: darkMode ? '#8fa89c' : '#5a7268',
  border: darkMode ? '#2a3d36' : '#d4e5dc',
  hover: darkMode ? '#223330' : '#edf5f1',
  green: '#4ead8a',
  red: '#e07070',
  yellow: '#d4a84b',
  blue: '#6ba89a',
  purple: '#7ea896',
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
