import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, BarChart3, ArrowRight, CheckCircle, Menu, X,
  Target, Brain, TestTubes, Lock, Crown,
  ArrowUpRight, ArrowDownRight, Eye, RefreshCw, Zap,
  Rocket, Landmark, Trophy,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../config';
import { brand as brandTokens } from '../styles/theme';
import { SCORE_BUY_THRESHOLD, getPriceDataKeys, PRO_PRICE, UNIVERSE_SIZE_FALLBACK, getSignal, getSignalColor } from '../constants';
import { fmt } from '../lib/formatters';

interface LiveRec { ticker: string; score: number; last_close: number; exp_return_20: number; pred_price_t_plus_20: number; vol_20d: number; }

const brand = {
  ...brandTokens,
  gradientSoft: `linear-gradient(135deg, ${brandTokens.alpha(0.08)}, ${brandTokens.alpha(0.06)}, ${brandTokens.alpha(0.04)})`,
  surface: '#0f1117',
  surfaceAlt: '#111520',
  surfaceCard: brandTokens.surface,
  text: '#f5f5f7',
  textMuted: '#9ba1b0',
  textDim: '#6b7280',
  buy: '#30d158',
  sell: '#ff453a',
  pro: '#ffd60a',
};

/* ── Scroll-triggered animation hook ── */
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

const RevealSection: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  delay?: number;
  id?: string;
  className?: string;
}> = ({ children, style, delay = 0, id, className }) => {
  const { ref, visible } = useScrollReveal(0.1);
  return (
    <div ref={ref} id={id} className={className} style={{
      ...style,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(60px)',
      transition: `opacity 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s, transform 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s`,
    }}>
      {children}
    </div>
  );
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [trackRecord, setTrackRecord] = useState<{ totalReturn: number; alpha: number; winRate: number; days: number; totalSignals: number } | null>(null);
  const [liveRecs, setLiveRecs] = useState<LiveRec[]>([]);
  const [liveDate, setLiveDate] = useState('');
  const [userCount, setUserCount] = useState(0);
  const [navSolid, setNavSolid] = useState(false);
  const [heroScale, setHeroScale] = useState(1);
  const [liveDataTimedOut, setLiveDataTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLiveDataTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = () => {
      const y = window.scrollY;
      setNavSolid(y > 60);
      const s = Math.max(0.85, 1 - y * 0.0003);
      setHeroScale(s);
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const headers = { 'x-api-key': API_KEY };
        const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        setLiveRecs((data.recommendations || []).slice(0, 6));
        setLiveDate(data.date || '');
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const headers = { 'x-api-key': API_KEY };
        const [curKey, prevKey] = getPriceDataKeys();
        const [histRes, marRes, febRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/recommendations/history`, { headers }),
          fetch(`${API_BASE_URL}/s3-proxy?key=${curKey}`, { headers }),
          fetch(`${API_BASE_URL}/s3-proxy?key=${prevKey}`, { headers }),
        ]);
        if (!histRes.ok) return;
        const hd = await histRes.json();
        const history: Record<string, { date: string; score: number }[]> = hd.data || {};
        const priceMap: Record<string, Record<string, number>> = {};
        for (const res of [febRes, marRes]) {
          if (res.ok) {
            const rows: { date: string; ticker: string; close: string }[] = await res.json();
            rows.forEach(r => { if (!priceMap[r.ticker]) priceMap[r.ticker] = {}; priceMap[r.ticker][r.date] = parseFloat(r.close); });
          }
        }
        if (!Object.keys(history).length || !Object.keys(priceMap).length) return;
        const allDates = new Set<string>();
        Object.values(history).forEach(entries => entries.forEach(e => allDates.add(e.date)));
        const sortedDates = Array.from(allDates).sort();

        /* Track individual buy signals, not daily averages */
        let totalBuySignals = 0, winningBuySignals = 0;
        let cumBuy = 1, cumIbov = 1;
        const dailyReturns: { buyReturn: number }[] = [];

        for (let i = 0; i < sortedDates.length - 1; i++) {
          const predDate = sortedDates[i], nextDate = sortedDates[i + 1];
          const buyReturns: number[] = [], allReturns: number[] = [];
          const histEntries = Object.entries(history);
          for (const [ticker, entries] of histEntries) {
            const entry = entries.find(e => e.date === predDate);
            if (!entry) continue;
            const tp = priceMap[ticker];
            if (!tp || !tp[predDate] || !tp[nextDate]) continue;
            const dayReturn = (tp[nextDate] - tp[predDate]) / tp[predDate];
            if (entry.score >= SCORE_BUY_THRESHOLD) {
              buyReturns.push(dayReturn);
              totalBuySignals++;
              if (dayReturn > 0) winningBuySignals++;
            }
          }
          const priceEntries = Object.values(priceMap);
          for (const tp of priceEntries) {
            if (tp[predDate] && tp[nextDate]) allReturns.push((tp[nextDate] - tp[predDate]) / tp[predDate]);
          }
          const br = buyReturns.length ? buyReturns.reduce((s, r) => s + r, 0) / buyReturns.length : 0;
          const ir = allReturns.length ? allReturns.reduce((s, r) => s + r, 0) / allReturns.length : 0;
          cumBuy *= (1 + br); cumIbov *= (1 + ir);
          dailyReturns.push({ buyReturn: br });
        }
        const totalReturn = (cumBuy - 1) * 100, ibovReturn = (cumIbov - 1) * 100;
        setTrackRecord({
          totalReturn,
          alpha: totalReturn - ibovReturn,
          winRate: totalBuySignals > 0 ? (winningBuySignals / totalBuySignals) * 100 : 0,
          days: dailyReturns.length,
          totalSignals: totalBuySignals,
        });
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/stats`);
        if (res.ok) { const d = await res.json(); setUserCount(d.userCount || 0); }
      } catch {}
    })();
  }, []);

  const totalBuy = liveRecs.filter(r => r.score >= SCORE_BUY_THRESHOLD).length;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  /* ── Reusable feature card ── */
  const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; desc: string }> = ({ icon, title, desc }) => (
    <div style={{
      background: brand.surfaceCard, border: `0.5px solid ${brand.borderSubtle}`,
      borderRadius: 16, padding: '1.5rem', transition: 'border-color 0.3s, background 0.3s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = brand.accentBorder; e.currentTarget.style.background = brand.alpha(0.06); }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = brand.borderSubtle; e.currentTarget.style.background = brand.surfaceCard; }}
    >
      <div style={{ color: brand.accent, marginBottom: '0.75rem' }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.35rem' }}>{title}</div>
      <div style={{ fontSize: '0.82rem', color: brand.textMuted, lineHeight: 1.5 }}>{desc}</div>
    </div>
  );

  /* ── Live data table (reused for real + fallback) ── */
  const renderRecsTable = (recs: { ticker: string; signal?: string; score: number; price: number; pred?: number; ret?: number }[], isLive: boolean) => (
    <div style={{ background: brand.alpha(0.03), border: `0.5px solid ${brand.borderSubtle}`, borderRadius: 20, overflow: 'hidden', backdropFilter: 'blur(20px)' }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: `0.5px solid ${brand.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.82rem', color: brand.textMuted }}>{isLive ? 'Recomendações reais do modelo' : 'Exemplo de recomendações do modelo'}</span>
        {isLive && (
          <span style={{ fontSize: '0.75rem', color: brand.buy, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: brand.buy }} /> {totalBuy} sinais de compra
          </span>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              {['Ticker', 'Sinal', 'Score', 'Preço', 'Previsto', 'Retorno'].map((h, i) => (
                <th key={i} style={{ padding: '0.75rem 1rem', textAlign: i === 0 ? 'left' : 'right', color: brand.textDim, fontWeight: 500, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `0.5px solid ${brand.borderSubtle}` }}>
                  {h}{i >= 4 && <Lock size={9} style={{ marginLeft: 3, verticalAlign: 'middle', color: brand.pro }} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recs.map(r => {
              const signal = r.signal || getSignal(r.score);
              const sc = getSignalColor(signal);
              return (
                <tr key={r.ticker} style={{ borderBottom: `0.5px solid ${brand.alpha(0.04)}` }}>
                  <td style={{ padding: '0.7rem 1rem', fontWeight: 600 }}>{r.ticker}</td>
                  <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, background: sc.bg, color: sc.text, display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                      {signal === 'Compra' ? <ArrowUpRight size={10} /> : signal === 'Venda' ? <ArrowDownRight size={10} /> : null}{signal}
                    </span>
                  </td>
                  <td style={{ padding: '0.7rem 1rem', textAlign: 'right', fontWeight: 600, color: sc.text }}>{fmt(r.score, 2)}</td>
                  <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>R$ {fmt(r.price, 2)}</td>
                  <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}><span style={{ filter: 'blur(5px)', userSelect: 'none' }}>R$ {r.pred != null ? fmt(r.pred, 2) : '--'}</span></td>
                  <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}><span style={{ filter: 'blur(5px)', userSelect: 'none', color: (r.ret ?? 0) >= 0 ? brand.buy : brand.sell }}>{r.ret != null ? `${r.ret >= 0 ? '+' : ''}${fmt(r.ret * 100, 1)}%` : '+--.--%'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '1rem 1.5rem', borderTop: `0.5px solid ${brand.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: brand.textDim }}>{isLive ? `6 de ${UNIVERSE_SIZE_FALLBACK} ações · ` : 'Dados ilustrativos · '}<Lock size={9} style={{ verticalAlign: 'middle' }} /> exclusivo Pro</span>
        <button onClick={() => navigate('/register')} style={{ padding: '0.4rem 1rem', borderRadius: 980, border: 'none', fontSize: '0.78rem', fontWeight: 600, background: brand.gradient, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          {isLive ? 'Ver todas' : 'Ver dados reais'} <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );

  const fallbackRecs = [
    { ticker: 'PETR4', signal: 'Compra', score: 2.34, price: 38.52 },
    { ticker: 'VALE3', signal: 'Compra', score: 1.87, price: 58.90 },
    { ticker: 'ITUB4', signal: 'Neutro', score: 0.45, price: 32.15 },
    { ticker: 'BBDC4', signal: 'Venda', score: -1.92, price: 12.80 },
    { ticker: 'WEGE3', signal: 'Compra', score: 2.10, price: 41.25 },
    { ticker: 'RENT3', signal: 'Neutro', score: -0.33, price: 65.40 },
  ];

  return (
    <div style={{ minHeight: '100vh', background: brand.surface, color: brand.text, overflowX: 'hidden', fontFamily: "'SF Pro Display', 'Inter', -apple-system, system-ui, sans-serif" }}>

      {/* ─── Navbar ─── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: navSolid ? 'rgba(12,10,26,0.82)' : 'transparent',
        backdropFilter: navSolid ? 'saturate(180%) blur(20px)' : 'none',
        WebkitBackdropFilter: navSolid ? 'saturate(180%) blur(20px)' : 'none',
        borderBottom: navSolid ? `0.5px solid ${brand.borderSubtle}` : 'none',
        transition: 'background 0.4s, backdrop-filter 0.4s',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.8rem clamp(1rem, 4vw, 2.5rem)', maxWidth: 1200, margin: '0 auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => scrollTo('hero')}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: brand.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem' }}>Q</span>
            </div>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: brand.text }}>Qyntara</span>
          </div>
          <div className="lp-nav-desktop" style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            {['Recursos', 'Resultados', 'Planos'].map(n => (
              <button key={n} onClick={() => scrollTo(n.toLowerCase())} style={{
                background: 'none', border: 'none', color: brand.textMuted, cursor: 'pointer',
                fontSize: '0.82rem', fontWeight: 400, transition: 'color 0.2s', padding: 0,
              }}
                onMouseEnter={e => (e.currentTarget.style.color = brand.text)}
                onMouseLeave={e => (e.currentTarget.style.color = brand.textMuted)}
              >{n}</button>
            ))}
            <button onClick={() => navigate('/login')} style={{
              background: 'none', border: 'none', color: brand.textMuted, cursor: 'pointer',
              fontSize: '0.82rem', padding: 0,
            }}>Entrar</button>
            <button onClick={() => navigate('/register')} style={{
              background: brand.alpha(0.15), border: `1px solid ${brand.accentBorder}`, color: brand.text,
              padding: '0.4rem 1rem', borderRadius: 20, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500,
              transition: 'background 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = brand.alpha(0.25))}
              onMouseLeave={e => (e.currentTarget.style.background = brand.alpha(0.15))}
            >Começar Grátis</button>
          </div>
          <button className="lp-nav-mobile" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{
            display: 'none', background: 'none', border: 'none', color: brand.text, cursor: 'pointer', padding: 4,
          }} aria-label="Menu">
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="lp-mobile-menu" style={{ display: 'none', flexDirection: 'column', gap: '0.4rem', padding: '0 1rem 1rem' }}>
            {['Recursos', 'Resultados', 'Planos'].map(n => (
              <button key={n} onClick={() => scrollTo(n.toLowerCase())} style={{ width: '100%', padding: '0.6rem', background: brand.alpha(0.08), border: 'none', color: brand.text, borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem' }}>{n}</button>
            ))}
            <button onClick={() => { navigate('/login'); setMobileMenuOpen(false); }} style={{ width: '100%', padding: '0.6rem', background: brand.alpha(0.08), border: 'none', color: brand.text, borderRadius: 8, cursor: 'pointer' }}>Entrar</button>
            <button onClick={() => { navigate('/register'); setMobileMenuOpen(false); }} style={{ width: '100%', padding: '0.6rem', background: brand.gradient, border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Começar Grátis</button>
          </div>
        )}
      </nav>

      {/* ─── Hero ─── */}
      <section id="hero" style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center', position: 'relative',
        padding: '0 clamp(1rem, 4vw, 2rem)',
        transform: `scale(${heroScale})`, transition: 'transform 0.1s linear',
      }}>
        {/* Ambient glow */}
        <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: '90vw', maxWidth: 900, height: 600, background: `radial-gradient(ellipse, ${brand.alpha(0.15)} 0%, ${brand.alpha(0.08)} 35%, ${brand.alpha(0.03)} 60%, transparent 80%)`, pointerEvents: 'none', filter: 'blur(60px)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: brand.alpha(0.1), border: `1px solid ${brand.borderSubtle}`, borderRadius: 20, padding: '0.3rem 0.9rem', marginBottom: '2rem', fontSize: '0.78rem', color: brand.textMuted }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: brand.buy, animation: 'lp-pulse 2s infinite' }} />
            {liveDate ? `Atualizado: ${liveDate}` : 'Dados atualizados diariamente'}
          </div>

          <h1 style={{
            fontSize: 'clamp(2.8rem, 8vw, 5.5rem)', fontWeight: 700, lineHeight: 1.0,
            letterSpacing: '-0.04em', marginBottom: '1.5rem',
            background: 'linear-gradient(180deg, #f5f5f7 0%, #9ba1b0 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Inteligência preditiva.<br />Para a Bolsa brasileira.
          </h1>

          <p style={{
            fontSize: 'clamp(1.05rem, 2.5vw, 1.35rem)', color: brand.textMuted,
            maxWidth: 580, margin: '0 auto 2.5rem', lineHeight: 1.6, fontWeight: 400,
          }}>
            Modelos de deep learning analisam {UNIVERSE_SIZE_FALLBACK} ações da B3 e geram sinais de Compra e Venda com previsões para 20 pregões.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/register')} style={{
              background: brand.gradient, border: 'none', color: 'white',
              padding: '1rem 2.5rem', borderRadius: 980, cursor: 'pointer', fontSize: '1.05rem',
              fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem',
              boxShadow: `0 0 40px ${brand.glowStrong}`, transition: 'transform 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Começar Grátis <ArrowRight size={18} />
            </button>
            <button onClick={() => scrollTo('live-data')} style={{
              background: brand.alpha(0.1), border: `1px solid ${brand.accentBorder}`, color: brand.text,
              padding: '1rem 2.5rem', borderRadius: 980, cursor: 'pointer', fontSize: '1.05rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'background 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = brand.alpha(0.18))}
              onMouseLeave={e => (e.currentTarget.style.background = brand.alpha(0.1))}
            >
              <Eye size={18} /> Ver dados ao vivo
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', animation: 'lp-bounce 2s infinite' }}>
          <div style={{ width: 24, height: 38, borderRadius: 12, border: `1.5px solid ${brand.accentBorder}`, display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
            <div style={{ width: 3, height: 8, borderRadius: 2, background: brand.accent, opacity: 0.6, animation: 'lp-scroll-dot 2s infinite' }} />
          </div>
        </div>
      </section>

      {/* ─── Stats bar ─── */}
      <section style={{ background: brand.surfaceAlt, borderTop: `0.5px solid ${brand.borderSubtle}`, borderBottom: `0.5px solid ${brand.borderSubtle}` }}>
        <RevealSection style={{ maxWidth: 1000, margin: '0 auto', padding: '4rem clamp(1rem, 4vw, 2rem)', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '2rem' }}>
          {[
            { v: `${UNIVERSE_SIZE_FALLBACK}`, l: 'ações analisadas diariamente' },
            { v: userCount > 0 ? `${userCount}+` : '20+', l: 'investidores ativos' },
            { v: '20', l: 'pregões de previsão' },
            { v: 'IA', l: 'modelo de deep learning' },
          ].map((b, i) => (
            <div key={i} style={{ textAlign: 'center', flex: '1 1 140px' }}>
              <div style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 700, letterSpacing: '-0.03em', background: brand.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{b.v}</div>
              <div style={{ fontSize: '0.82rem', color: brand.textDim, marginTop: '0.25rem' }}>{b.l}</div>
            </div>
          ))}
        </RevealSection>
      </section>

      {/* ─── Section 1: Como Funciona (consolidated flow) ─── */}
      <section id="recursos" style={{ background: brand.surfaceAlt, borderTop: `0.5px solid ${brand.borderSubtle}`, borderBottom: `0.5px solid ${brand.borderSubtle}` }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)' }}>
          <RevealSection style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '0.78rem', color: brand.accent, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Como funciona</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1rem' }}>
              Da análise ao sinal.<br />
              <span style={{ color: brand.textDim }}>Em 3 passos.</span>
            </h2>
          </RevealSection>

          <RevealSection delay={0.15}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              {[
                { step: '01', icon: <Brain size={28} />, title: 'Modelo analisa', desc: 'Nossa IA processa séries temporais de preço, volume e indicadores técnicos de cada ação da B3.' },
                { step: '02', icon: <BarChart3 size={28} />, title: 'Sinais gerados', desc: 'Cada ação recebe um score de confiança e um sinal claro: Compra, Venda ou Neutro.' },
                { step: '03', icon: <Target size={28} />, title: 'Você decide', desc: 'Acompanhe previsões, monte carteiras e tome decisões com dados — não com achismo.' },
              ].map((s, i) => (
                <div key={i} style={{
                  background: brand.surfaceCard, border: `0.5px solid ${brand.borderSubtle}`,
                  borderRadius: 20, padding: '2rem', position: 'relative', overflow: 'hidden',
                  transition: 'border-color 0.3s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = brand.accentBorder)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = brand.borderSubtle)}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: brand.gradient, opacity: 0.5 }} />
                  <div style={{ fontSize: '0.7rem', color: brand.accent, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '1rem' }}>PASSO {s.step}</div>
                  <div style={{ color: brand.accent, marginBottom: '0.75rem' }}>{s.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>{s.title}</div>
                  <div style={{ fontSize: '0.85rem', color: brand.textMuted, lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ─── Section 2: Recomendações + Live Data ─── */}
      <section className="lp-section-recursos" style={{ background: brand.surface }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)' }}>
          <RevealSection style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '0.78rem', color: brand.accent, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Recomendações</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1rem' }}>
              Sinais claros.<br />
              <span style={{ color: brand.textDim }}>Atualizados todo dia.</span>
            </h2>
            <p style={{ fontSize: 'clamp(0.95rem, 2vw, 1.15rem)', color: brand.textMuted, maxWidth: 550, margin: '0 auto', lineHeight: 1.6 }}>
              O modelo analisa cada ação e gera um score de confiança. Compra, Venda ou Neutro — sem ambiguidade.
            </p>
          </RevealSection>

          <RevealSection delay={0.15} id="live-data">
            {liveRecs.length > 0
              ? renderRecsTable(liveRecs.map(r => ({ ticker: r.ticker, score: r.score, price: r.last_close, pred: r.pred_price_t_plus_20, ret: r.exp_return_20 })), true)
              : liveDataTimedOut
                ? renderRecsTable(fallbackRecs, false)
                : (
                  <div style={{ background: brand.alpha(0.03), border: `0.5px solid ${brand.borderSubtle}`, borderRadius: 20, overflow: 'hidden' }}>
                    <div style={{ textAlign: 'center', padding: '4rem', color: brand.textDim }}>
                      <RefreshCw size={24} style={{ animation: 'lp-spin 1s linear infinite', marginBottom: '0.5rem' }} />
                      <div>Carregando dados ao vivo...</div>
                    </div>
                  </div>
                )
            }
          </RevealSection>
        </div>
      </section>

      {/* ─── Section 3: Recursos do Produto (condensed — 6 core features) ─── */}
      <section style={{ background: brand.surface }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)' }}>
          <RevealSection style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '0.78rem', color: brand.accent, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Recursos</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1rem' }}>
              Tudo para investir melhor.<br />
              <span style={{ color: brand.textDim }}>Em um só lugar.</span>
            </h2>
          </RevealSection>

          <RevealSection delay={0.1}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <FeatureCard icon={<BarChart3 size={24} />} title="Recomendações diárias" desc="Sinais de Compra, Venda e Neutro atualizados a cada pregão." />
              <FeatureCard icon={<Brain size={24} />} title="Inteligência Artificial" desc="Rede neural de deep learning treinada com dados reais da B3." />
              <FeatureCard icon={<TestTubes size={24} />} title="Backtesting completo" desc="Valide estratégias com dados históricos reais de mercado." />
              <FeatureCard icon={<Target size={24} />} title="Análise de acurácia" desc="Métricas de performance e taxa de acerto do modelo." />
              <FeatureCard icon={<Shield size={24} />} title="Análise de risco" desc="Volatilidade, drawdown e métricas de risco por ação." />
              <FeatureCard icon={<Lock size={24} />} title="Dados seguros (LGPD)" desc="Seus dados protegidos com criptografia e conformidade LGPD." />
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ─── Section 4: Carteiras ─── */}
      <section style={{ background: brand.surfaceAlt, borderTop: `0.5px solid ${brand.borderSubtle}`, borderBottom: `0.5px solid ${brand.borderSubtle}` }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)' }}>
          <RevealSection style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '0.78rem', color: brand.accent, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Carteiras & Desafio IBOV</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1rem' }}>
              Carteiras personalizadas.<br />
              <span style={{ color: brand.textDim }}>E o desafio de bater o IBOV.</span>
            </h2>
            <p style={{ fontSize: 'clamp(0.95rem, 2vw, 1.15rem)', color: brand.textMuted, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
              Crie carteiras com as ações que você acompanha e participe do Desafio IBOV — monte sua estratégia e veja se consegue superar o índice.
            </p>
          </RevealSection>

          <RevealSection delay={0.15}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', maxWidth: 900, margin: '0 auto' }}>
              {[
                { icon: <Rocket size={20} />, name: 'Tech Brasil', color: '#2563eb', tickers: ['TOTS3', 'LWSA3', 'POSI3'] },
                { icon: <Landmark size={20} />, name: 'Bancos', color: '#3b82f6', tickers: ['ITUB4', 'BBDC4', 'BBAS3'] },
                { icon: <Zap size={20} />, name: 'Energia', color: '#10b981', tickers: ['ELET3', 'ENGI11', 'CPFE3'] },
              ].map((c, i) => (
                <div key={i} style={{
                  background: brand.surfaceCard, border: `0.5px solid ${brand.borderSubtle}`,
                  borderRadius: 16, padding: '1.5rem', position: 'relative', overflow: 'hidden',
                  transition: 'border-color 0.3s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = `${c.color}40`)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = brand.borderSubtle)}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c.color }} />
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: `${c.color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: c.color, marginBottom: '0.75rem',
                  }}>{c.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.5rem' }}>{c.name}</div>
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {c.tickers.map(t => (
                      <span key={t} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: 4, background: brand.alpha(0.08), color: brand.textMuted }}>{t}</span>
                    ))}
                  </div>
                </div>
              ))}
              {/* Desafio IBOV card */}
              <div style={{
                background: brand.surfaceCard, border: `0.5px solid ${brand.borderSubtle}`,
                borderRadius: 16, padding: '1.5rem', position: 'relative', overflow: 'hidden',
                transition: 'border-color 0.3s',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#fbbf2440')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = brand.borderSubtle)}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#fbbf24' }} />
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: '#fbbf2418',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fbbf24', marginBottom: '0.75rem',
                }}><Trophy size={20} /></div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.5rem' }}>Desafio IBOV</div>
                <div style={{ fontSize: '0.78rem', color: brand.textMuted, lineHeight: 1.5 }}>Monte sua carteira e tente bater o IBOVESPA.</div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ─── Section 5: Explicabilidade (SHAP) ─── */}
      <section style={{ background: brand.surface }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)' }}>
          <RevealSection style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '0.78rem', color: brand.accent, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Explicabilidade</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1rem' }}>
              Entenda cada previsão.<br />
              <span style={{ color: brand.textDim }}>Sem caixa preta.</span>
            </h2>
            <p style={{ fontSize: 'clamp(0.95rem, 2vw, 1.15rem)', color: brand.textMuted, maxWidth: 580, margin: '0 auto', lineHeight: 1.6 }}>
              Com SHAP values, você vê exatamente quais fatores influenciaram cada recomendação.
            </p>
          </RevealSection>

          <RevealSection delay={0.15}>
            <div style={{ background: brand.alpha(0.03), border: `0.5px solid ${brand.borderSubtle}`, borderRadius: 20, padding: '2rem', maxWidth: 700, margin: '0 auto' }}>
              <div style={{ fontSize: '0.78rem', color: brand.textMuted, marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Exemplo: Por que PETR4 é Compra?</span>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
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
                    <span style={{ fontSize: '0.78rem', color: brand.textMuted, width: 130, flexShrink: 0, textAlign: 'right' }}>{s.feature}</span>
                    <div style={{ flex: 1, height: 20, background: brand.alpha(0.05), borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                      <div style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: s.positive ? '50%' : undefined,
                        right: s.positive ? undefined : '50%',
                        width: `${Math.abs(s.impact) * 40}%`,
                        background: s.positive ? 'rgba(48,209,88,0.4)' : 'rgba(255,69,58,0.4)',
                        borderRadius: 4,
                      }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, width: 50, color: s.positive ? brand.buy : brand.sell }}>
                      {s.positive ? '+' : ''}{s.impact.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: `0.5px solid ${brand.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', color: brand.textDim }}>SHAP Waterfall · Disponível para cada ação no plano Pro</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: brand.pro }}><Crown size={11} /> Pro</span>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ─── Section 6: Track Record / Resultados ─── */}
      <section id="resultados" style={{ background: brand.surfaceAlt, borderTop: `0.5px solid ${brand.borderSubtle}`, borderBottom: `0.5px solid ${brand.borderSubtle}` }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)' }}>
          <RevealSection style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '0.78rem', color: brand.accent, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Resultados</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1rem' }}>
              Números reais.<br />
              <span style={{ color: brand.textDim }}>Sem promessas vazias.</span>
            </h2>
            <p style={{ fontSize: 'clamp(0.95rem, 2vw, 1.15rem)', color: brand.textMuted, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
              Track record calculado com dados reais de mercado. Resultados de produção, não backtesting otimista.
            </p>
          </RevealSection>

          <RevealSection delay={0.15}>
            {trackRecord ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                {[
                  { label: 'Retorno (só Compras)', value: `${trackRecord.totalReturn >= 0 ? '+' : ''}${fmt(trackRecord.totalReturn, 2)}%`, color: trackRecord.totalReturn >= 0 ? brand.buy : brand.sell },
                  { label: 'Alpha vs Mercado', value: `${trackRecord.alpha >= 0 ? '+' : ''}${fmt(trackRecord.alpha, 2)}%`, color: trackRecord.alpha >= 0 ? brand.buy : brand.sell },
                  { label: 'Win Rate (Compras)', value: `${fmt(trackRecord.winRate, 0)}%`, color: brand.accent },
                  { label: 'Sinais de Compra', value: `${trackRecord.totalSignals}`, color: brand.text },
                  { label: 'Dias Analisados', value: `${trackRecord.days}`, color: brand.textMuted },
                ].map((m, i) => (
                  <div key={i} style={{
                    background: brand.surfaceCard, border: `0.5px solid ${brand.borderSubtle}`,
                    borderRadius: 16, padding: '1.5rem', textAlign: 'center',
                    transition: 'border-color 0.3s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = brand.accentBorder)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = brand.borderSubtle)}
                  >
                    <div style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 700, color: m.color, letterSpacing: '-0.02em' }}>{m.value}</div>
                    <div style={{ fontSize: '0.78rem', color: brand.textDim, marginTop: '0.35rem' }}>{m.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: brand.textDim }}>
                <RefreshCw size={20} style={{ animation: 'lp-spin 1s linear infinite', marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '0.85rem' }}>Calculando track record...</div>
              </div>
            )}
          </RevealSection>
        </div>
      </section>

      {/* ─── Section 7: Planos ─── */}
      <section id="planos" style={{ background: brand.surface }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)' }}>
          <RevealSection style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '0.78rem', color: brand.accent, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Planos</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1rem' }}>
              Comece grátis.<br />
              <span style={{ color: brand.textDim }}>Evolua quando quiser.</span>
            </h2>
          </RevealSection>

          <RevealSection delay={0.15}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {/* Free */}
              <div style={{
                background: brand.surfaceCard, border: `0.5px solid ${brand.borderSubtle}`,
                borderRadius: 20, padding: '2rem', display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ fontSize: '0.82rem', color: brand.textMuted, fontWeight: 500, marginBottom: '0.5rem' }}>Free</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>R$ 0</div>
                <div style={{ fontSize: '0.78rem', color: brand.textDim, marginBottom: '1.5rem' }}>Para sempre</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                  {[
                    'Recomendações diárias (sinal)',
                    '1 carteira personalizada',
                    'Acompanhamento básico',
                    'Dados com delay',
                  ].map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: brand.textMuted }}>
                      <CheckCircle size={14} style={{ color: brand.accent, flexShrink: 0 }} /> {f}
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate('/register')} style={{
                  width: '100%', padding: '0.75rem', borderRadius: 12, border: `1px solid ${brand.accentBorder}`,
                  background: 'transparent', color: brand.text, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
                  transition: 'background 0.2s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = brand.alpha(0.08))}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >Criar conta grátis</button>
              </div>

              {/* Pro */}
              <div style={{
                background: brand.alpha(0.06), border: `1px solid ${brand.accentBorder}`,
                borderRadius: 20, padding: '2rem', display: 'flex', flexDirection: 'column', position: 'relative',
              }}>
                <div style={{ position: 'absolute', top: -1, left: 0, right: 0, height: 3, borderRadius: '20px 20px 0 0', background: brand.gradient }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: brand.pro, fontWeight: 600, marginBottom: '0.5rem' }}>
                  <Crown size={14} /> Pro
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>{PRO_PRICE}</div>
                <div style={{ fontSize: '0.78rem', color: brand.textDim, marginBottom: '1.5rem' }}>por mês</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                  {[
                    'Tudo do Free',
                    'Preço previsto e retorno esperado',
                    'Carteiras ilimitadas',
                    'Backtesting completo',
                    'Explicabilidade (SHAP)',
                    'Análise de risco avançada',
                    'Dados em tempo real',
                    'Suporte prioritário',
                  ].map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: brand.textMuted }}>
                      <CheckCircle size={14} style={{ color: brand.buy, flexShrink: 0 }} /> {f}
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate('/register')} style={{
                  width: '100%', padding: '0.75rem', borderRadius: 12, border: 'none',
                  background: brand.gradient, color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
                  boxShadow: `0 0 30px ${brand.glow}`,
                }}>Assinar Pro</button>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section style={{ background: brand.surface }}>
        <RevealSection style={{
          maxWidth: 800, margin: '0 auto', textAlign: 'center',
          padding: 'clamp(5rem, 12vw, 8rem) clamp(1rem, 4vw, 2rem)',
        }}>
          <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1rem' }}>
            Pronto para investir<br />
            <span style={{ background: brand.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>com inteligência?</span>
          </h2>
          <p style={{ fontSize: 'clamp(0.95rem, 2vw, 1.15rem)', color: brand.textMuted, maxWidth: 480, margin: '0 auto 2rem', lineHeight: 1.6 }}>
            Junte-se a {userCount > 0 ? `${userCount}+` : ''} investidores que usam IA para tomar decisões melhores na B3.
          </p>
          <button onClick={() => navigate('/register')} style={{
            background: brand.gradient, border: 'none', color: 'white',
            padding: '1rem 3rem', borderRadius: 980, cursor: 'pointer', fontSize: '1.1rem',
            fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            boxShadow: `0 0 50px ${brand.glowStrong}`, transition: 'transform 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Começar Grátis <ArrowRight size={18} />
          </button>
        </RevealSection>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{
        borderTop: `0.5px solid ${brand.borderSubtle}`, background: brand.surfaceAlt,
        padding: '2.5rem clamp(1rem, 4vw, 2rem)',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: brand.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '0.7rem' }}>Q</span>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Qyntara</span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.78rem', color: brand.textDim }}>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/privacidade')}>Termos</span>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/privacidade')}>Privacidade</span>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/privacidade')}>LGPD</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: brand.textDim }}>
            © {new Date().getFullYear()} Qyntara. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* ─── Sticky mobile CTA ─── */}
      <div className="lp-sticky-cta" style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
        padding: '0.75rem 1rem', background: 'rgba(12,10,26,0.9)', backdropFilter: 'blur(20px)',
        borderTop: `0.5px solid ${brand.borderSubtle}`,
      }}>
        <button onClick={() => navigate('/register')} style={{
          width: '100%', padding: '0.75rem', borderRadius: 12, border: 'none',
          background: brand.gradient, color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
        }}>Começar Grátis</button>
      </div>

      {/* ─── CSS Keyframes & Responsive ─── */}
      <style>{`
        @keyframes lp-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes lp-bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(8px); }
        }
        @keyframes lp-scroll-dot {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(6px); }
        }
        @keyframes lp-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .lp-nav-desktop { display: none !important; }
          .lp-nav-mobile { display: flex !important; }
          .lp-mobile-menu { display: flex !important; }
          .lp-sticky-cta { display: block !important; }
        }
        @media (min-width: 769px) {
          .lp-nav-desktop { display: flex !important; }
          .lp-nav-mobile { display: none !important; }
          .lp-mobile-menu { display: none !important; }
          .lp-sticky-cta { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
