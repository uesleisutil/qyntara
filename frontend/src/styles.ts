// Design tokens — centralized theme
export const theme = {
  bg: '#0a0b0f',
  bgAlt: '#0d0e14',
  card: '#12141c',
  cardHover: '#181a24',
  border: '#1e2130',
  borderHover: '#2a2d40',
  text: '#e2e8f0',
  textSecondary: '#8892a4',
  textMuted: '#5a6478',
  accent: '#6366f1',
  accentHover: '#818cf8',
  accentBg: 'rgba(99,102,241,0.08)',
  accentBorder: 'rgba(99,102,241,0.25)',
  green: '#10b981',
  greenBg: 'rgba(16,185,129,0.08)',
  red: '#ef4444',
  redBg: 'rgba(239,68,68,0.08)',
  yellow: '#f59e0b',
  yellowBg: 'rgba(245,158,11,0.08)',
  purple: '#8b5cf6',
  purpleBg: 'rgba(139,92,246,0.08)',
  blue: '#3b82f6',
  blueBg: 'rgba(59,130,246,0.08)',
  cyan: '#06b6d4',
};

export const cardStyle = (hover = false): React.CSSProperties => ({
  background: hover ? theme.cardHover : theme.card,
  border: `1px solid ${hover ? theme.borderHover : theme.border}`,
  borderRadius: 12,
  padding: 'clamp(0.75rem, 2vw, 1.25rem)',
  transition: 'all 0.2s ease',
});

export const badgeStyle = (color: string, bg: string): React.CSSProperties => ({
  fontSize: '0.6rem',
  padding: '2px 8px',
  borderRadius: 6,
  fontWeight: 700,
  background: bg,
  color,
  letterSpacing: '0.03em',
  textTransform: 'uppercase' as const,
});

export const globalStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: ${theme.bg}; color: ${theme.text}; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: ${theme.borderHover}; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes glow { 0%,100% { box-shadow: 0 0 4px rgba(99,102,241,0.3); } 50% { box-shadow: 0 0 12px rgba(99,102,241,0.5); } }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
`;
