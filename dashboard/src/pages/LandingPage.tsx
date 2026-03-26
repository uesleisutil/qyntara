import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, BarChart3, ArrowRight, CheckCircle, Menu, X,
  Target, Brain, TestTubes, Lock, Crown,
  ArrowUpRight, ArrowDownRight, Eye, RefreshCw, Zap,
  Rocket, Landmark, Trophy, TrendingUp, Layers, Sparkles,
  Activity, LineChart, PieChart, Cpu,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../config';
import { brand as brandTokens } from '../styles/theme';
import { SCORE_BUY_THRESHOLD, getPriceDataKeys, PRO_PRICE, UNIVERSE_SIZE_FALLBACK, getSignal, getSignalColor } from '../constants';
import { fmt } from '../lib/formatters';
import { useLiveData } from '../hooks/useLiveData';

interface LiveRec { ticker: string; score: number; last_close: number; exp_return_20: number; pred_price_t_plus_20: number; vol_20d: number; }

/* ─── Design tokens ─── */
const c = {
  bg: '#0a0c14',
  bgAlt: '#0e1019',
  surface: 'rgba(255,255,255,0.03)',
  surfaceHover: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.06)',
  borderHover: 'rgba(99,102,241,0.4)',
  text: '#f0f0f5',
  textMuted: '#8b8fa3',
  textDim: '#5a5e72',
  accent: '#6366f1',
  accentLight: '#818cf8',
  accentGlow: 'rgba(99,102,241,0.15)',
  accentGlowStrong: 'rgba(99,102,241,0.3)',
  buy: '#22c55e',
  sell: '#ef4444',
  gold: '#f59e0b',
  gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)',
  gradientText: 'linear-gradient(135deg, #c7d2fe, #818cf8, #6366f1)',
  glass: 'rgba(15,17,25,0.6)',
};

/* ─── Scroll reveal hook ─── */
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, vis };
}

const Reveal: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; delay?: number; id?: string }> = ({ children, style, delay = 0, id }) => {
  const { ref, vis } = useReveal(0.08);
  return (
    <div ref={ref} id={id} style={{
      ...style, opacity: vis ? 1 : 0,
      transform: vis ? 'translateY(0)' : 'translateY(40px)',
      transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
    }}>{children}</div>
  );
};

/* ─── Animated floating icon ─── */
const FloatIcon: React.FC<{ children: React.ReactNode; color: string; delay?: number; size?: number }> = ({ children, color, delay = 0, size = 48 }) => (
  <div style={{
    width: size, height: size, borderRadius: 14,
    background: `${color}12`, border: `1px solid ${color}25`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color, animation: `float 3s ease-in-out ${delay}s infinite`,
    transition: 'transform 0.3s, box-shadow 0.3s',
  }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = `0 0 24px ${color}30`; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
  >{children}</div>
);

/* ─── Glassmorphism card ─── */
const GlassCard: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; accent?: string; className?: string }> = ({ children, style, accent, className }) => (
  <div className={className} style={{
    background: c.surface, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${c.border}`, borderRadius: 20, padding: '1.75rem',
    transition: 'border-color 0.4s, background 0.4s, transform 0.3s, box-shadow 0.4s',
    position: 'relative', overflow: 'hidden', ...style,
  }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = accent || c.borderHover;
      e.currentTarget.style.background = c.surfaceHover;
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = `0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px ${accent || c.borderHover}`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = c.border;
      e.currentTarget.style.background = c.surface;
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }}
  >
    {accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent, opacity: 0.6 }} />}
    {children}
  </div>
);


/* ─── Animated counter ─── */
const AnimCounter: React.FC<{ end: number; suffix?: string; prefix?: string; duration?: number }> = ({ end, suffix = '', prefix = '', duration = 2000 }) => {
  const [val, setVal] = useState(0);
  const { ref, vis } = useReveal(0.3);
  useEffect(() => {
    if (!vis || end <= 0) return;
    let start = 0;
    const step = end / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= end) { setVal(end); clearInterval(id); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(id);
  }, [vis, end, duration]);
  return <span ref={ref}>{prefix}{val.toLocaleString('pt-BR')}{suffix}</span>;
};

/* ─── Flowing data animation (background) ─── */
const DataFlow: React.FC = () => {
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 4,
      size: 2 + Math.random() * 3,
      opacity: 0.1 + Math.random() * 0.2,
    })), []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: `${p.x}%`, top: '-5%',
          width: p.size, height: p.size, borderRadius: '50%',
          background: c.accentLight, opacity: p.opacity,
          animation: `datafall ${p.duration}s linear ${p.delay}s infinite`,
        }} />
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navSolid, setNavSolid] = useState(false);
  const [liveDataTimedOut, setLiveDataTimedOut] = useState(false);

  useEffect(() => { const t = setTimeout(() => setLiveDataTimedOut(true), 5000); return () => clearTimeout(t); }, []);

  useEffect(() => {
    const handler = () => setNavSolid(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  /* ─── Data fetching (same logic as before) ─── */
  const fetchRecsAndTrackRecord = useCallback(async () => {
    const headers = { 'x-api-key': API_KEY };
    const [curKey, prevKey] = getPriceDataKeys();
    const [latestRes, histRes, curPriceRes, prevPriceRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers }),
      fetch(`${API_BASE_URL}/api/recommendations/history`, { headers }),
      fetch(`${API_BASE_URL}/s3-proxy?key=${curKey}`, { headers }).catch(() => null),
      fetch(`${API_BASE_URL}/s3-proxy?key=${prevKey}`, { headers }).catch(() => null),
    ]);
    let liveRecs: LiveRec[] = [];
    let liveDate = '';
    if (latestRes.ok) {
      const data = await latestRes.json();
      liveRecs = (data.recommendations || []).slice(0, 6);
      liveDate = data.date || '';
    }
    let trackRecord: { totalReturn: number; alpha: number; winRate: number; days: number; totalSignals: number } | null = null;
    if (histRes.ok) {
      const hd = await histRes.json();
      const history: Record<string, { date: string; score: number }[]> = hd.data || {};
      const priceMap: Record<string, Record<string, number>> = {};
      for (const res of [prevPriceRes, curPriceRes]) {
        if (res?.ok) {
          const rows: { date: string; ticker: string; close: string }[] = await res.json();
          rows.forEach(r => { if (!priceMap[r.ticker]) priceMap[r.ticker] = {}; priceMap[r.ticker][r.date] = parseFloat(r.close); });
        }
      }
      if (Object.keys(history).length && Object.keys(priceMap).length) {
        const allDates = new Set<string>();
        Object.values(history).forEach(entries => entries.forEach(e => allDates.add(e.date)));
        const sortedDates = Array.from(allDates).sort();
        let totalBuySignals = 0, winningBuySignals = 0, cumBuy = 1, cumIbov = 1;
        for (let i = 0; i < sortedDates.length - 1; i++) {
          const predDate = sortedDates[i], nextDate = sortedDates[i + 1];
          const buyReturns: number[] = [], allReturns: number[] = [];
          for (const [ticker, entries] of Object.entries(history)) {
            const entry = entries.find(e => e.date === predDate);
            if (!entry) continue;
            const tp = priceMap[ticker];
            if (!tp || !tp[predDate] || !tp[nextDate]) continue;
            const dayReturn = (tp[nextDate] - tp[predDate]) / tp[predDate];
            if (entry.score >= SCORE_BUY_THRESHOLD) { buyReturns.push(dayReturn); totalBuySignals++; if (dayReturn > 0) winningBuySignals++; }
          }
          for (const tp of Object.values(priceMap)) { if (tp[predDate] && tp[nextDate]) allReturns.push((tp[nextDate] - tp[predDate]) / tp[predDate]); }
          cumBuy *= (1 + (buyReturns.length ? buyReturns.reduce((s, r) => s + r, 0) / buyReturns.length : 0));
          cumIbov *= (1 + (allReturns.length ? allReturns.reduce((s, r) => s + r, 0) / allReturns.length : 0));
        }
        const totalReturn = (cumBuy - 1) * 100, ibovReturn = (cumIbov - 1) * 100;
        trackRecord = { totalReturn, alpha: totalReturn - ibovReturn, winRate: totalBuySignals > 0 ? (winningBuySignals / totalBuySignals) * 100 : 0, days: sortedDates.length - 1, totalSignals: totalBuySignals };
      }
    }
    return { liveRecs, liveDate, trackRecord };
  }, []);

  const fetchStats = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/auth/stats`);
    if (res.ok) { const d = await res.json(); return { userCount: d.userCount || 0 }; }
    return null;
  }, []);

  const { data: recsData } = useLiveData(fetchRecsAndTrackRecord, 'recommendations');
  const { data: statsData } = useLiveData(fetchStats);
  const liveRecs = recsData?.liveRecs ?? [];
  const liveDate = recsData?.liveDate ?? '';
  const trackRecord = recsData?.trackRecord ?? null;
  const userCount = statsData?.userCount ?? 0;
  const totalBuy = liveRecs.filter(r => r.score >= SCORE_BUY_THRESHOLD).length;

  const scrollTo = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setMobileMenuOpen(false); };

  const fallbackRecs = [
    { ticker: 'PETR4', score: 2.34, last_close: 38.52, exp_return_20: 0.08, pred_price_t_plus_20: 41.60, vol_20d: 0.03 },
    { ticker: 'VALE3', score: 1.87, last_close: 58.90, exp_return_20: 0.06, pred_price_t_plus_20: 62.44, vol_20d: 0.04 },
    { ticker: 'ITUB4', score: 0.45, last_close: 32.15, exp_return_20: 0.01, pred_price_t_plus_20: 32.47, vol_20d: 0.02 },
    { ticker: 'BBDC4', score: -1.92, last_close: 12.80, exp_return_20: -0.05, pred_price_t_plus_20: 12.16, vol_20d: 0.04 },
    { ticker: 'WEGE3', score: 2.10, last_close: 41.25, exp_return_20: 0.07, pred_price_t_plus_20: 44.14, vol_20d: 0.03 },
    { ticker: 'RENT3', score: -0.33, last_close: 65.40, exp_return_20: -0.01, pred_price_t_plus_20: 64.75, vol_20d: 0.03 },
  ];

  const displayRecs = liveRecs.length > 0 ? liveRecs : (liveDataTimedOut ? fallbackRecs : []);
  const isLive = liveRecs.length > 0;


  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.text, overflowX: 'hidden', fontFamily: "'Inter', -apple-system, system-ui, sans-serif" }}>

      {/* ─── CSS Animations ─── */}
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes pulse-glow { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes datafall { 0% { transform: translateY(-10vh); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(110vh); opacity: 0; } }
        @keyframes gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        @keyframes shimmer-line { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
        @media (max-width: 768px) {
          .lp-nav-links { display: none !important; }
          .lp-mobile-btn { display: flex !important; }
          .lp-mobile-menu { display: flex !important; }
          .lp-hero-btns { flex-direction: column !important; align-items: stretch !important; }
          .lp-sticky-cta { display: block !important; }
          .lp-features-grid { grid-template-columns: 1fr !important; }
          .lp-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (min-width: 769px) {
          .lp-nav-links { display: flex !important; }
          .lp-mobile-btn { display: none !important; }
          .lp-mobile-menu { display: none !important; }
          .lp-sticky-cta { display: none !important; }
        }
      `}</style>

      {/* ─── Navbar ─── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: navSolid ? 'rgba(10,12,20,0.85)' : 'transparent',
        backdropFilter: navSolid ? 'saturate(180%) blur(20px)' : 'none',
        borderBottom: navSolid ? `1px solid ${c.border}` : 'none',
        transition: 'all 0.4s',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem clamp(1rem, 4vw, 2.5rem)', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => scrollTo('hero')}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: c.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>Q</span>
            </div>
            <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>Qyntara</span>
          </div>
          <div className="lp-nav-links" style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            {['Recursos', 'Resultados', 'Planos'].map(n => (
              <button key={n} onClick={() => scrollTo(n.toLowerCase())} style={{ background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', fontSize: '0.82rem', padding: 0, transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = c.text)} onMouseLeave={e => (e.currentTarget.style.color = c.textMuted)}>{n}</button>
            ))}
            <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', fontSize: '0.82rem', padding: 0 }}>Entrar</button>
            <button onClick={() => navigate('/register')} style={{ background: `${c.accent}18`, border: `1px solid ${c.accent}40`, color: c.text, padding: '0.4rem 1rem', borderRadius: 20, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500, transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = `${c.accent}30`)} onMouseLeave={e => (e.currentTarget.style.background = `${c.accent}18`)}>Começar Grátis</button>
          </div>
          <button className="lp-mobile-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ display: 'none', background: 'none', border: 'none', color: c.text, cursor: 'pointer', padding: 4 }} aria-label="Menu">
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="lp-mobile-menu" style={{ display: 'none', flexDirection: 'column', gap: '0.4rem', padding: '0 1rem 1rem' }}>
            {['Recursos', 'Resultados', 'Planos'].map(n => (
              <button key={n} onClick={() => scrollTo(n.toLowerCase())} style={{ width: '100%', padding: '0.6rem', background: c.surface, border: 'none', color: c.text, borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem' }}>{n}</button>
            ))}
            <button onClick={() => { navigate('/login'); setMobileMenuOpen(false); }} style={{ width: '100%', padding: '0.6rem', background: c.surface, border: 'none', color: c.text, borderRadius: 8, cursor: 'pointer' }}>Entrar</button>
            <button onClick={() => { navigate('/register'); setMobileMenuOpen(false); }} style={{ width: '100%', padding: '0.6rem', background: c.gradient, border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Começar Grátis</button>
          </div>
        )}
      </nav>

      {/* ─── Hero ─── */}
      <section id="hero" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', position: 'relative', padding: '0 clamp(1rem, 4vw, 2rem)' }}>
        {/* Ambient orbs */}
        <div style={{ position: 'absolute', top: '10%', left: '20%', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${c.accent}15 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none', animation: 'gradient-shift 8s ease infinite', backgroundSize: '200% 200%' }} />
        <div style={{ position: 'absolute', bottom: '15%', right: '15%', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, #8b5cf620 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
        <DataFlow />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Live badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: c.surface, border: `1px solid ${c.border}`, borderRadius: 24, padding: '0.35rem 1rem', marginBottom: '2.5rem', backdropFilter: 'blur(8px)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.buy, animation: 'pulse-glow 2s infinite' }} />
            <span style={{ fontSize: '0.78rem', color: c.textMuted }}>{liveDate ? `Atualizado: ${liveDate}` : 'Dados atualizados diariamente'}</span>
          </div>

          <h1 style={{ fontSize: 'clamp(3rem, 8vw, 5.5rem)', fontWeight: 700, lineHeight: 1.0, letterSpacing: '-0.04em', marginBottom: '1.5rem' }}>
            <span style={{ background: 'linear-gradient(180deg, #f0f0f5 0%, #8b8fa3 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Inteligência preditiva.</span>
            <br />
            <span style={{ background: c.gradientText, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Para a Bolsa brasileira.</span>
          </h1>

          <p style={{ fontSize: 'clamp(1.05rem, 2.5vw, 1.3rem)', color: c.textMuted, maxWidth: 560, margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
            Modelos de deep learning analisam {UNIVERSE_SIZE_FALLBACK} ações da B3 e geram sinais de Compra e Venda com previsões para 20 pregões.
          </p>

          <div className="lp-hero-btns" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/register')} style={{
              background: c.gradient, border: 'none', color: 'white', padding: '1rem 2.5rem', borderRadius: 980, cursor: 'pointer', fontSize: '1.05rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: `0 0 50px ${c.accentGlowStrong}`, transition: 'transform 0.2s, box-shadow 0.2s',
            }} onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = `0 0 70px ${c.accentGlowStrong}`; }}
               onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 0 50px ${c.accentGlowStrong}`; }}>
              Começar Grátis <ArrowRight size={18} />
            </button>
            <button onClick={() => scrollTo('live-data')} style={{
              background: c.surface, border: `1px solid ${c.border}`, color: c.text, padding: '1rem 2.5rem', borderRadius: 980, cursor: 'pointer', fontSize: '1.05rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem', backdropFilter: 'blur(8px)', transition: 'background 0.2s, border-color 0.2s',
            }} onMouseEnter={e => { e.currentTarget.style.background = c.surfaceHover; e.currentTarget.style.borderColor = c.borderHover; }}
               onMouseLeave={e => { e.currentTarget.style.background = c.surface; e.currentTarget.style.borderColor = c.border; }}>
              <Eye size={18} /> Ver dados ao vivo
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', animation: 'float 2s ease-in-out infinite' }}>
          <div style={{ width: 24, height: 38, borderRadius: 12, border: `1.5px solid ${c.accent}40`, display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
            <div style={{ width: 3, height: 8, borderRadius: 2, background: c.accent, opacity: 0.6 }} />
          </div>
        </div>
      </section>


      {/* ─── Stats bar ─── */}
      <section style={{ background: c.bgAlt, borderTop: `1px solid ${c.border}`, borderBottom: `1px solid ${c.border}` }}>
        <Reveal style={{ maxWidth: 1000, margin: '0 auto', padding: '4rem clamp(1rem, 4vw, 2rem)' }}>
          <div className="lp-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem', textAlign: 'center' }}>
            {[
              { value: UNIVERSE_SIZE_FALLBACK, suffix: '', label: 'ações analisadas' },
              { value: userCount > 0 ? userCount : 20, suffix: '+', label: 'investidores ativos' },
              { value: 20, suffix: '', label: 'pregões de previsão' },
              { value: 3, suffix: '', label: 'modelos DL no ensemble' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 700, letterSpacing: '-0.03em', background: c.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  <AnimCounter end={s.value} suffix={s.suffix} duration={1500} />
                </div>
                <div style={{ fontSize: '0.82rem', color: c.textDim, marginTop: '0.25rem' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ─── Features grid (animated cards) ─── */}
      <section id="recursos" style={{ background: c.bg }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <div style={{ fontSize: '0.75rem', color: c.accentLight, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>Recursos</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1rem' }}>
              Tudo para investir melhor.
              <br /><span style={{ color: c.textDim }}>Em um só lugar.</span>
            </h2>
          </Reveal>

          {/* Main feature cards — 3 large */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
            {[
              {
                icon: <Brain size={24} />, color: c.accent, delay: 0,
                title: 'Deep Learning Ensemble',
                desc: '3 modelos neurais (Transformer+BiLSTM, TabTransformer, FT-Transformer) combinados com pesos adaptativos. Estado da arte para dados tabulares financeiros.',
                badge: 'IA',
              },
              {
                icon: <Activity size={24} />, color: '#22c55e', delay: 0.3,
                title: 'Sinais em Tempo Real',
                desc: 'Recomendações atualizadas diariamente após o fechamento do mercado. Compra, Venda ou Neutro — sem ambiguidade.',
                badge: 'Live',
              },
              {
                icon: <TestTubes size={24} />, color: '#f59e0b', delay: 0.6,
                title: 'Backtesting Completo',
                desc: 'Valide estratégias com dados históricos reais. Walk-forward validation sem data leakage.',
                badge: 'Pro',
              },
            ].map((f, i) => (
              <Reveal key={i} delay={f.delay}>
                <GlassCard accent={f.color} style={{ height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <FloatIcon color={f.color} delay={i * 0.5}>{f.icon}</FloatIcon>
                    <span style={{ padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700, background: `${f.color}18`, color: f.color, border: `1px solid ${f.color}30` }}>{f.badge}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.5rem' }}>{f.title}</div>
                  <div style={{ fontSize: '0.85rem', color: c.textMuted, lineHeight: 1.6 }}>{f.desc}</div>
                </GlassCard>
              </Reveal>
            ))}
          </div>

          {/* Secondary features — 4 smaller */}
          <div className="lp-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {[
              { icon: <Target size={20} />, color: '#a78bfa', title: 'Análise de Acurácia', desc: 'Métricas reais de performance vs preços de mercado.' },
              { icon: <Shield size={20} />, color: '#38bdf8', title: 'Análise de Risco', desc: 'Volatilidade, drawdown e score ajustado por risco.' },
              { icon: <Layers size={20} />, color: '#fb923c', title: 'Carteiras Personalizadas', desc: 'Monte e acompanhe carteiras com suas ações favoritas.' },
              { icon: <Sparkles size={20} />, color: '#f472b6', title: 'Explicabilidade SHAP', desc: 'Entenda por que cada ação recebeu seu sinal.' },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <GlassCard accent={f.color} style={{ padding: '1.25rem' }}>
                  <FloatIcon color={f.color} delay={i * 0.4} size={40}>{f.icon}</FloatIcon>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '0.75rem', marginBottom: '0.35rem' }}>{f.title}</div>
                  <div style={{ fontSize: '0.78rem', color: c.textMuted, lineHeight: 1.5 }}>{f.desc}</div>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>


      {/* ─── Live Data Table ─── */}
      <section id="live-data" style={{ background: c.bgAlt, borderTop: `1px solid ${c.border}`, borderBottom: `1px solid ${c.border}`, position: 'relative', overflow: 'hidden' }}>
        <DataFlow />
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)', position: 'relative', zIndex: 1 }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '0.75rem', color: c.accentLight, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>Recomendações</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1rem' }}>
              Sinais claros.
              <br /><span style={{ color: c.textDim }}>Atualizados todo dia.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.15}>
            <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ padding: '1rem 1.5rem', borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: c.textMuted }}>{isLive ? 'Recomendações reais do modelo' : 'Exemplo de recomendações'}</span>
                {isLive && (
                  <span style={{ fontSize: '0.75rem', color: c.buy, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.buy, animation: 'pulse-glow 2s infinite' }} /> {totalBuy} sinais de compra
                  </span>
                )}
              </div>
              {/* Table */}
              {displayRecs.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        {['Ticker', 'Sinal', 'Score', 'Preço', 'Previsto', 'Retorno'].map((h, i) => (
                          <th key={i} style={{ padding: '0.75rem 1rem', textAlign: i === 0 ? 'left' : 'right', color: c.textDim, fontWeight: 500, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${c.border}` }}>
                            {h}{i >= 4 && <Lock size={9} style={{ marginLeft: 3, verticalAlign: 'middle', color: c.gold }} />}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayRecs.map((r, idx) => {
                        const signal = getSignal(r.score);
                        const sc = getSignalColor(signal);
                        return (
                          <tr key={r.ticker} style={{ borderBottom: `1px solid ${c.border}`, transition: 'background 0.2s', animationDelay: `${idx * 0.05}s` }}
                            onMouseEnter={e => (e.currentTarget.style.background = c.surfaceHover)}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <td style={{ padding: '0.7rem 1rem', fontWeight: 600 }}>{r.ticker}</td>
                            <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>
                              <span style={{ padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, background: sc.bg, color: sc.text, display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                                {signal === 'Compra' ? <ArrowUpRight size={10} /> : signal === 'Venda' ? <ArrowDownRight size={10} /> : null}{signal}
                              </span>
                            </td>
                            <td style={{ padding: '0.7rem 1rem', textAlign: 'right', fontWeight: 600, color: sc.text }}>{fmt(r.score, 2)}</td>
                            <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>R$ {fmt(r.last_close, 2)}</td>
                            <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}><span style={{ filter: 'blur(5px)', userSelect: 'none' }}>R$ {fmt(r.pred_price_t_plus_20, 2)}</span></td>
                            <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}><span style={{ filter: 'blur(5px)', userSelect: 'none', color: r.exp_return_20 >= 0 ? c.buy : c.sell }}>{r.exp_return_20 >= 0 ? '+' : ''}{fmt(r.exp_return_20 * 100, 1)}%</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: c.textDim }}>
                  <RefreshCw size={24} style={{ animation: 'spin-slow 1s linear infinite', marginBottom: '0.5rem' }} />
                  <div>Carregando dados ao vivo...</div>
                </div>
              )}
              {/* Table footer */}
              <div style={{ padding: '1rem 1.5rem', borderTop: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: c.textDim }}>
                  {isLive ? `6 de ${UNIVERSE_SIZE_FALLBACK} ações` : 'Dados ilustrativos'} · <Lock size={9} style={{ verticalAlign: 'middle' }} /> exclusivo Pro
                </span>
                <button onClick={() => navigate('/register')} style={{ padding: '0.4rem 1rem', borderRadius: 980, border: 'none', fontSize: '0.78rem', fontWeight: 600, background: c.gradient, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'transform 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')} onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                  {isLive ? 'Ver todas' : 'Ver dados reais'} <ArrowRight size={13} />
                </button>
              </div>
            </GlassCard>
          </Reveal>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section style={{ background: c.bg }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '0.75rem', color: c.accentLight, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>Como funciona</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
              Da análise ao sinal.
              <br /><span style={{ color: c.textDim }}>Em 3 passos.</span>
            </h2>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
            {[
              { step: '01', icon: <Cpu size={28} />, color: c.accent, title: 'Modelo analisa', desc: 'Ensemble de 3 redes neurais processa ~92 features por ação: técnicas, fundamentalistas, macro e sentimento.' },
              { step: '02', icon: <BarChart3 size={28} />, color: '#22c55e', title: 'Sinais gerados', desc: 'Cada ação recebe um score de confiança e um sinal claro: Compra, Venda ou Neutro. Score = predição / volatilidade.' },
              { step: '03', icon: <Target size={28} />, color: '#f59e0b', title: 'Você decide', desc: 'Acompanhe previsões, monte carteiras, faça backtesting e tome decisões com dados — não com achismo.' },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 0.15}>
                <GlassCard accent={s.color} style={{ position: 'relative', overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.65rem', color: s.color, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '1rem' }}>PASSO {s.step}</div>
                  <FloatIcon color={s.color} delay={i * 0.5}>{s.icon}</FloatIcon>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: '1rem', marginBottom: '0.5rem' }}>{s.title}</div>
                  <div style={{ fontSize: '0.85rem', color: c.textMuted, lineHeight: 1.6 }}>{s.desc}</div>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>


      {/* ─── SHAP Explainability ─── */}
      <section style={{ background: c.bgAlt, borderTop: `1px solid ${c.border}`, borderBottom: `1px solid ${c.border}` }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '0.75rem', color: c.accentLight, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>Explicabilidade</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1rem' }}>
              Entenda cada previsão.
              <br /><span style={{ color: c.textDim }}>Sem caixa preta.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.15}>
            <GlassCard style={{ maxWidth: 700, margin: '0 auto' }}>
              <div style={{ fontSize: '0.78rem', color: c.textMuted, marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Exemplo: Por que PETR4 é Compra?</span>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, background: `${c.buy}18`, color: c.buy }}>
                  <ArrowUpRight size={10} /> Compra
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {[
                  { feature: 'Momentum 20d', impact: 0.82, positive: true },
                  { feature: 'Volume relativo', impact: 0.54, positive: true },
                  { feature: 'RSI (14)', impact: 0.31, positive: true },
                  { feature: 'Volatilidade 20d', impact: -0.18, positive: false },
                  { feature: 'Distância da média', impact: -0.12, positive: false },
                  { feature: 'Beta setorial', impact: 0.15, positive: true },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.78rem', color: c.textMuted, width: 130, flexShrink: 0, textAlign: 'right' }}>{s.feature}</span>
                    <div style={{ flex: 1, height: 20, background: c.surface, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                      <div style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: s.positive ? '50%' : undefined, right: s.positive ? undefined : '50%',
                        width: `${Math.abs(s.impact) * 40}%`,
                        background: s.positive ? `${c.buy}50` : `${c.sell}50`,
                        borderRadius: 4, transition: 'width 0.6s ease-out',
                      }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, width: 50, color: s.positive ? c.buy : c.sell }}>
                      {s.positive ? '+' : ''}{s.impact.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', color: c.textDim }}>SHAP Waterfall · Disponível para cada ação no plano Pro</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: c.gold }}><Crown size={11} /> Pro</span>
              </div>
            </GlassCard>
          </Reveal>
        </div>
      </section>

      {/* ─── Track Record / Resultados ─── */}
      <section id="resultados" style={{ background: c.bg }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '0.75rem', color: c.accentLight, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>Resultados</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1rem' }}>
              Números reais.
              <br /><span style={{ color: c.textDim }}>Sem promessas vazias.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.15}>
            {trackRecord ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                {[
                  { label: 'Retorno (Compras)', value: `${trackRecord.totalReturn >= 0 ? '+' : ''}${fmt(trackRecord.totalReturn, 2)}%`, color: trackRecord.totalReturn >= 0 ? c.buy : c.sell },
                  { label: 'Alpha vs Mercado', value: `${trackRecord.alpha >= 0 ? '+' : ''}${fmt(trackRecord.alpha, 2)}%`, color: trackRecord.alpha >= 0 ? c.buy : c.sell },
                  { label: 'Win Rate', value: `${fmt(trackRecord.winRate, 0)}%`, color: c.accentLight },
                  { label: 'Sinais de Compra', value: `${trackRecord.totalSignals}`, color: c.text },
                  { label: 'Dias Analisados', value: `${trackRecord.days}`, color: c.textMuted },
                ].map((m, i) => (
                  <Reveal key={i} delay={i * 0.1}>
                    <GlassCard style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 700, color: m.color, letterSpacing: '-0.02em' }}>{m.value}</div>
                      <div style={{ fontSize: '0.78rem', color: c.textDim, marginTop: '0.35rem' }}>{m.label}</div>
                    </GlassCard>
                  </Reveal>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: c.textDim }}>
                <RefreshCw size={20} style={{ animation: 'spin-slow 1s linear infinite', marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '0.85rem' }}>Calculando track record...</div>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* ─── Carteiras + Desafio ─── */}
      <section style={{ background: c.bgAlt, borderTop: `1px solid ${c.border}`, borderBottom: `1px solid ${c.border}` }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '0.75rem', color: c.accentLight, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>Carteiras & Desafio</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1rem' }}>
              Carteiras personalizadas.
              <br /><span style={{ color: c.textDim }}>E o desafio de bater o IBOV.</span>
            </h2>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            {[
              { icon: <Rocket size={20} />, name: 'Tech Brasil', color: '#6366f1', tickers: ['TOTS3', 'LWSA3', 'POSI3'] },
              { icon: <Landmark size={20} />, name: 'Bancos', color: '#3b82f6', tickers: ['ITUB4', 'BBDC4', 'BBAS3'] },
              { icon: <Zap size={20} />, name: 'Energia', color: '#22c55e', tickers: ['ELET3', 'ENGI11', 'CPFE3'] },
              { icon: <Trophy size={20} />, name: 'Desafio IBOV', color: '#f59e0b', tickers: [] },
            ].map((cart, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <GlassCard accent={cart.color} style={{ padding: '1.5rem' }}>
                  <FloatIcon color={cart.color} delay={i * 0.3} size={40}>{cart.icon}</FloatIcon>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.75rem', marginBottom: '0.5rem' }}>{cart.name}</div>
                  {cart.tickers.length > 0 ? (
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {cart.tickers.map(t => (
                        <span key={t} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: 4, background: c.surface, color: c.textMuted }}>{t}</span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: c.textMuted, lineHeight: 1.5 }}>Monte sua carteira e tente bater o IBOVESPA.</div>
                  )}
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>


      {/* ─── Pricing ─── */}
      <section id="planos" style={{ background: c.bg }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '0.75rem', color: c.accentLight, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>Planos</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
              Comece grátis.
              <br /><span style={{ color: c.textDim }}>Evolua quando quiser.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.15}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {/* Free */}
              <GlassCard style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '0.82rem', color: c.textMuted, fontWeight: 500, marginBottom: '0.5rem' }}>Free</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>R$ 0</div>
                <div style={{ fontSize: '0.78rem', color: c.textDim, marginBottom: '1.5rem' }}>Para sempre</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                  {['Recomendações diárias (sinal)', '1 carteira personalizada', 'Acompanhamento básico', 'Dados com delay'].map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: c.textMuted }}>
                      <CheckCircle size={14} style={{ color: c.accent, flexShrink: 0 }} /> {f}
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate('/register')} style={{
                  width: '100%', padding: '0.75rem', borderRadius: 12, border: `1px solid ${c.borderHover}`,
                  background: 'transparent', color: c.text, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, transition: 'background 0.2s',
                }} onMouseEnter={e => (e.currentTarget.style.background = c.surfaceHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  Criar conta grátis
                </button>
              </GlassCard>

              {/* Pro */}
              <GlassCard accent={c.accent} style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${c.accent}40` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: c.gold, fontWeight: 600, marginBottom: '0.5rem' }}>
                  <Crown size={14} /> Pro
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>{PRO_PRICE}</div>
                <div style={{ fontSize: '0.78rem', color: c.textDim, marginBottom: '1.5rem' }}>por mês</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                  {['Tudo do Free', 'Preço previsto e retorno esperado', 'Carteiras ilimitadas', 'Backtesting completo', 'Explicabilidade (SHAP)', 'Análise de risco avançada', 'Dados em tempo real', 'Suporte prioritário'].map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: c.textMuted }}>
                      <CheckCircle size={14} style={{ color: c.buy, flexShrink: 0 }} /> {f}
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate('/register')} style={{
                  width: '100%', padding: '0.75rem', borderRadius: 12, border: 'none',
                  background: c.gradient, color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
                  boxShadow: `0 0 30px ${c.accentGlow}`, transition: 'transform 0.2s, box-shadow 0.2s',
                }} onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = `0 0 50px ${c.accentGlowStrong}`; }}
                   onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 0 30px ${c.accentGlow}`; }}>
                  Assinar Pro
                </button>
              </GlassCard>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section style={{ background: c.bg, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 600, borderRadius: '50%', background: `radial-gradient(circle, ${c.accent}12 0%, transparent 70%)`, filter: 'blur(80px)', pointerEvents: 'none' }} />
        <Reveal style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1rem' }}>
            Pronto para investir
            <br /><span style={{ background: c.gradientText, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>com inteligência?</span>
          </h2>
          <p style={{ fontSize: 'clamp(0.95rem, 2vw, 1.15rem)', color: c.textMuted, maxWidth: 480, margin: '0 auto 2rem', lineHeight: 1.6 }}>
            Junte-se a {userCount > 0 ? `${userCount}+` : ''} investidores que usam IA para tomar decisões melhores na B3.
          </p>
          <button onClick={() => navigate('/register')} style={{
            background: c.gradient, border: 'none', color: 'white', padding: '1rem 3rem', borderRadius: 980, cursor: 'pointer', fontSize: '1.1rem', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem', boxShadow: `0 0 60px ${c.accentGlowStrong}`, transition: 'transform 0.2s, box-shadow 0.2s',
          }} onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = `0 0 80px ${c.accentGlowStrong}`; }}
             onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 0 60px ${c.accentGlowStrong}`; }}>
            Começar Grátis <ArrowRight size={18} />
          </button>
        </Reveal>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{ borderTop: `1px solid ${c.border}`, background: c.bgAlt, padding: '2.5rem clamp(1rem, 4vw, 2rem)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: c.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '0.7rem' }}>Q</span>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Qyntara</span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.78rem', color: c.textDim }}>
            <span style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={() => navigate('/privacidade')} onMouseEnter={e => (e.currentTarget.style.color = c.text)} onMouseLeave={e => (e.currentTarget.style.color = c.textDim)}>Termos</span>
            <span style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={() => navigate('/privacidade')} onMouseEnter={e => (e.currentTarget.style.color = c.text)} onMouseLeave={e => (e.currentTarget.style.color = c.textDim)}>Privacidade</span>
            <span style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={() => navigate('/privacidade')} onMouseEnter={e => (e.currentTarget.style.color = c.text)} onMouseLeave={e => (e.currentTarget.style.color = c.textDim)}>LGPD</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: c.textDim }}>© {new Date().getFullYear()} Qyntara. Todos os direitos reservados.</div>
        </div>
      </footer>

      {/* ─── Sticky mobile CTA ─── */}
      <div className="lp-sticky-cta" style={{ display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90, padding: '0.75rem 1rem', background: 'rgba(10,12,20,0.9)', backdropFilter: 'blur(20px)', borderTop: `1px solid ${c.border}` }}>
        <button onClick={() => navigate('/register')} style={{ width: '100%', padding: '0.75rem', borderRadius: 12, border: 'none', background: c.gradient, color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
          Começar Grátis
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
