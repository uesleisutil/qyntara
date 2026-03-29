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
  body { background: ${theme.bg}; color: ${theme.text}; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; overflow-x: hidden; }
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

  /* Advanced landing animations */
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-12px); }
  }
  @keyframes floatSlow {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-8px) rotate(2deg); }
  }
  @keyframes orbMove {
    0% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -20px) scale(1.05); }
    66% { transform: translate(-20px, 15px) scale(0.95); }
    100% { transform: translate(0, 0) scale(1); }
  }
  @keyframes orbMove2 {
    0% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(-25px, 25px) scale(1.08); }
    66% { transform: translate(20px, -10px) scale(0.92); }
    100% { transform: translate(0, 0) scale(1); }
  }
  @keyframes borderGlow {
    0%, 100% { border-color: rgba(99,102,241,0.15); }
    50% { border-color: rgba(99,102,241,0.4); }
  }
  @keyframes countUp {
    from { opacity: 0; transform: scale(0.5); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes revealLine {
    from { width: 0; }
    to { width: 100%; }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-30px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(30px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes tickerScroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  .landing-card:hover {
    transform: translateY(-4px);
    border-color: ${theme.accentBorder} !important;
    box-shadow: 0 12px 40px rgba(99,102,241,0.12);
  }
  .landing-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(99,102,241,0.4) !important;
  }
  .landing-btn-secondary:hover {
    border-color: ${theme.accentBorder} !important;
    color: ${theme.accent} !important;
  }
  .plan-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }
  .stat-card:hover {
    background: ${theme.cardHover} !important;
  }
  .feature-icon-wrap:hover {
    transform: scale(1.1);
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .landing-card:hover, .plan-card:hover { transform: none; }
  }
  @media (max-width: 480px) {
    body { font-size: 14px; }
  }
  nav::-webkit-scrollbar { display: none; }
  @media (max-width: 640px) {
    .auth-branding { display: none !important; }
  }
`;
