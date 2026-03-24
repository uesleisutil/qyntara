import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, BarChart3, Zap, ArrowRight, CheckCircle, Menu, X,
  Award, Target, Brain, TestTubes, LineChart, Lock, Crown, Star,
  ArrowUpRight, ArrowDownRight, Eye, Briefcase, FileText, RefreshCw,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../config';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD, getPriceDataKeys, PRO_PRICE, UNIVERSE_SIZE_FALLBACK, getSignal, getSignalColor } from '../constants';

interface LiveRec { ticker: string; score: number; last_close: number; exp_return_20: number; pred_price_t_plus_20: number; vol_20d: number; }

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

/* ── Qyntara brand tokens ── */
const brand = {
  gradient: 'linear-gradient(135deg, #7c3aed, #6366f1, #3b82f6)',
  gradientHover: 'linear-gradient(135deg, #6d28d9, #4f46e5, #2563eb)',
  accent: '#8b5cf6',
  accentSoft: 'rgba(139,92,246,0.12)',
  accentBorder: 'rgba(139,92,246,0.25)',
  glow: 'rgba(139,92,246,0.15)',
  glowStrong: 'rgba(99,102,241,0.25)',
  surface: '#0c0f1a',
  surfaceCard: 'rgba(255,255,255,0.025)',
  border: 'rgba(139,92,246,0.12)',
  borderSubtle: '#1a1f35',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  buy: '#10b981',
  sell: '#ef4444',
  pro: '#f59e0b',
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [trackRecord, setTrackRecord] = useState<{ totalReturn: number; alpha: number; winRate: number; days: number } | null>(null);
  const [liveRecs, setLiveRecs] = useState<LiveRec[]>([]);
  const [liveDate, setLiveDate] = useState('');
  const [userCount, setUserCount] = useState(0);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const headers = { 'x-api-key': API_KEY };
        const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        setLiveRecs((data.recommendations || []).slice(0, 8));
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
        const dailyReturns: { buyReturn: number; ibovReturn: number }[] = [];
        for (let i = 0; i < sortedDates.length - 1; i++) {
          const predDate = sortedDates[i];
          const nextDate = sortedDates[i + 1];
          const buyReturns: number[] = [];
          const allReturns: number[] = [];
          Object.entries(history).forEach(([ticker, entries]) => {
            const entry = entries.find(e => e.date === predDate);
            if (!entry) return;
            const tp = priceMap[ticker];
            if (!tp || !tp[predDate] || !tp[nextDate]) return;
            const dayReturn = (tp[nextDate] - tp[predDate]) / tp[predDate];
            if (entry.score >= SCORE_BUY_THRESHOLD) buyReturns.push(dayReturn);
          });
          Object.values(priceMap).forEach(tp => {
            if (tp[predDate] && tp[nextDate]) allReturns.push((tp[nextDate] - tp[predDate]) / tp[predDate]);
          });
          dailyReturns.push({
            buyReturn: buyReturns.length ? buyReturns.reduce((s, r) => s + r, 0) / buyReturns.length : 0,
            ibovReturn: allReturns.length ? allReturns.reduce((s, r) => s + r, 0) / allReturns.length : 0,
          });
        }
        let cumBuy = 1, cumIbov = 1;
        dailyReturns.forEach(d => { cumBuy *= (1 + d.buyReturn); cumIbov *= (1 + d.ibovReturn); });
        const totalReturn = (cumBuy - 1) * 100;
        const ibovReturn = (cumIbov - 1) * 100;
        const buyWins = dailyReturns.filter(d => d.buyReturn > 0).length;
        setTrackRecord({ totalReturn, alpha: totalReturn - ibovReturn, winRate: dailyReturns.length > 0 ? (buyWins / dailyReturns.length) * 100 : 0, days: dailyReturns.length });
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

  useEffect(() => {
    const handler = () => {
      const sections = ['hero', 'live-data', 'features', 'track-record', 'pricing'];
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 300) setActiveSection(id);
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const totalBuy = liveRecs.filter(r => r.score >= SCORE_BUY_THRESHOLD).length;
  const totalSell = liveRecs.filter(r => r.score <= SCORE_SELL_THRESHOLD).length;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: brand.surface, color: brand.text, overflowX: 'hidden' }}>

      {/* ─── Navbar ─── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50, background: 'rgba(12,15,26,0.82)', backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${brand.borderSubtle}`,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.75rem clamp(1rem, 4vw, 2rem)', maxWidth: 1200, margin: '0 auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }} onClick={() => scrollTo('hero')}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: brand.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 2px 12px ${brand.glow}`,
            }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem', fontFamily: "'Inter', system-ui, sans-serif" }}>Q</span>
            </div>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.02em', background: brand.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Qyntara</span>
          </div>
          <div className="landing-nav-desktop" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            {[
              { label: 'Dados ao Vivo', id: 'live-data' },
              { label: 'Recursos', id: 'features' },
              { label: 'Resultados', id: 'track-record' },
              { label: 'Planos', id: 'pricing' },
            ].map(n => (
              <button key={n.id} onClick={() => scrollTo(n.id)} style={{
                background: 'none', border: 'none', color: activeSection === n.id ? brand.accent : brand.textMuted,
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, transition: 'color 0.2s', padding: 0,
              }}>{n.label}</button>
            ))}
            <button onClick={() => navigate('/login')} style={{
              background: 'transparent', border: `1px solid ${brand.borderSubtle}`, color: brand.textMuted,
              padding: '0.45rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s',
            }}>Entrar</button>
            <button onClick={() => navigate('/register')} style={{
              background: brand.gradient, border: 'none', color: 'white',
              padding: '0.45rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
              boxShadow: `0 2px 12px ${brand.glow}`,
            }}>Começar Grátis</button>
          </div>
          <button className="landing-nav-mobile" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{
            display: 'none', background: 'none', border: 'none', color: brand.text, cursor: 'pointer', padding: 4,
          }} aria-label="Menu">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="landing-mobile-menu" style={{ display: 'none', flexDirection: 'column', gap: '0.5rem', padding: '0 1rem 1rem', maxWidth: 1200, margin: '0 auto' }}>
            {['live-data', 'features', 'track-record', 'pricing'].map(id => (
              <button key={id} onClick={() => scrollTo(id)} style={{ width: '100%', padding: '0.6rem', background: 'transparent', border: `1px solid ${brand.borderSubtle}`, color: brand.text, borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem', textTransform: 'capitalize' }}>
                {id.replace('-', ' ')}
              </button>
            ))}
            <button onClick={() => { navigate('/login'); setMobileMenuOpen(false); }} style={{ width: '100%', padding: '0.6rem', background: 'transparent', border: `1px solid ${brand.borderSubtle}`, color: brand.text, borderRadius: 8, cursor: 'pointer' }}>Entrar</button>
            <button onClick={() => { navigate('/register'); setMobileMenuOpen(false); }} style={{ width: '100%', padding: '0.6rem', background: brand.gradient, border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Começar Grátis</button>
          </div>
        )}
      </nav>

      {/* ─── Hero ─── */}
      <section id="hero" style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(3rem, 10vw, 6rem) clamp(1rem, 4vw, 2rem) 2rem', textAlign: 'center', position: 'relative' }}>
        {/* Dual glow */}
        <div style={{ position: 'absolute', top: '10%', left: '35%', width: 500, height: 500, background: `radial-gradient(ellipse, ${brand.glow} 0%, transparent 70%)`, pointerEvents: 'none', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', top: '25%', left: '55%', width: 400, height: 400, background: 'radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(40px)' }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: brand.accentSoft, border: `1px solid ${brand.accentBorder}`, borderRadius: 20, padding: '0.3rem 0.9rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: brand.accent }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: brand.accent, animation: 'qyntara-pulse 2s infinite' }} />
          {liveDate ? `Atualizado: ${liveDate}` : 'Dados atualizados diariamente'}
        </div>

        <h1 style={{ fontSize: 'clamp(2.25rem, 6vw, 4rem)', fontWeight: 800, lineHeight: 1.05, marginBottom: '1.25rem', position: 'relative', letterSpacing: '-0.03em' }}>
          <span style={{ background: 'linear-gradient(135deg, #f1f5f9 20%, #a78bfa 50%, #60a5fa 80%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Inteligência preditiva<br />para a Bolsa brasileira
          </span>
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.15rem)', color: brand.textMuted, maxWidth: 600, margin: '0 auto 2.25rem', lineHeight: 1.7 }}>
          Modelos de deep learning analisam {UNIVERSE_SIZE_FALLBACK} ações da B3 diariamente e geram sinais de Compra, Venda e Neutro com previsões para 20 pregões.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
          <button onClick={() => navigate('/register')} style={{
            background: brand.gradient, border: 'none', color: 'white',
            padding: '0.9rem 2.25rem', borderRadius: 12, cursor: 'pointer', fontSize: '1.05rem',
            fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem',
            boxShadow: `0 4px 24px ${brand.glowStrong}`, transition: 'transform 0.15s, box-shadow 0.2s',
          }}>
            Começar Grátis <ArrowRight size={18} />
          </button>
          <button onClick={() => scrollTo('live-data')} style={{
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${brand.borderSubtle}`, color: brand.text,
            padding: '0.9rem 2.25rem', borderRadius: 12, cursor: 'pointer', fontSize: '1.05rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <Eye size={18} /> Ver dados ao vivo
          </button>
        </div>

        {/* Trust badges */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(1.5rem, 5vw, 3rem)', flexWrap: 'wrap', opacity: 0.8 }}>
          {[
            { v: `${UNIVERSE_SIZE_FALLBACK}`, l: 'ações analisadas' },
            { v: userCount > 0 ? `${userCount}+` : '20+', l: 'investidores' },
            { v: '100%', l: 'automatizado' },
            { v: 'DeepAR', l: 'modelo AWS' },
          ].map((b, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', fontWeight: 800, background: brand.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{b.v}</div>
              <div style={{ fontSize: '0.7rem', color: brand.textDim }}>{b.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Live Data Preview ─── */}
      <section id="live-data" style={{ maxWidth: 1000, margin: '0 auto', padding: '3rem clamp(1rem, 4vw, 2rem)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 700, marginBottom: '0.5rem' }}>
            Dados reais, atualizados hoje
          </h2>
          <p style={{ color: brand.textDim, fontSize: '0.9rem' }}>
            Estas são as recomendações reais do modelo — não é mockup
          </p>
        </div>

        {liveRecs.length > 0 ? (
          <div style={{ background: brand.surfaceCard, border: `1px solid ${brand.borderSubtle}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '1rem', borderBottom: `1px solid ${brand.borderSubtle}`, flexWrap: 'wrap', gap: '0.5rem' }}>
              {[
                { label: 'Compra', value: totalBuy, color: brand.buy, icon: <ArrowUpRight size={14} /> },
                { label: 'Venda', value: totalSell, color: brand.sell, icon: <ArrowDownRight size={14} /> },
                { label: 'Neutro', value: liveRecs.length - totalBuy - totalSell, color: brand.textMuted, icon: null },
              ].map((k, i) => (
                <div key={i} style={{ textAlign: 'center', minWidth: 60 }}>
                  <div style={{ fontSize: '0.65rem', color: brand.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>{k.icon}{k.value}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${brand.borderSubtle}` }}>
                    {['#', 'Ticker', 'Sinal', 'Score', 'Preço', 'Previsto', 'Retorno', 'Faixa'].map((h, i) => (
                      <th key={i} style={{ padding: '0.6rem 0.6rem', textAlign: i < 2 ? 'left' : 'right', color: brand.textDim, fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                        {h}
                        {i >= 5 && <Lock size={9} style={{ marginLeft: 3, verticalAlign: 'middle', color: brand.pro }} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {liveRecs.map((r, idx) => {
                    const signal = getSignal(r.score);
                    const sc = getSignalColor(signal);
                    return (
                      <tr key={r.ticker} style={{ borderBottom: `1px solid rgba(139,92,246,0.06)` }}>
                        <td style={{ padding: '0.55rem 0.6rem', color: brand.textDim, fontSize: '0.72rem' }}>{idx + 1}</td>
                        <td style={{ padding: '0.55rem 0.6rem', fontWeight: 700, color: brand.text }}>{r.ticker}</td>
                        <td style={{ padding: '0.55rem 0.6rem', textAlign: 'right' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', padding: '0.15rem 0.45rem', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600, background: sc.bg, color: sc.text }}>
                            {signal === 'Compra' ? <ArrowUpRight size={11} /> : signal === 'Venda' ? <ArrowDownRight size={11} /> : null}
                            {signal}
                          </span>
                        </td>
                        <td style={{ padding: '0.55rem 0.6rem', textAlign: 'right', fontWeight: 600, color: sc.text }}>{fmt(r.score, 2)}</td>
                        <td style={{ padding: '0.55rem 0.6rem', textAlign: 'right', color: brand.text }}>R$ {fmt(r.last_close)}</td>
                        <td style={{ padding: '0.55rem 0.6rem', textAlign: 'right' }}>
                          <span style={{ filter: 'blur(5px)', userSelect: 'none', color: brand.text }}>R$ {fmt(r.pred_price_t_plus_20)}</span>
                        </td>
                        <td style={{ padding: '0.55rem 0.6rem', textAlign: 'right' }}>
                          <span style={{ filter: 'blur(5px)', userSelect: 'none', color: r.exp_return_20 >= 0 ? brand.buy : brand.sell }}>{r.exp_return_20 >= 0 ? '+' : ''}{fmt(r.exp_return_20 * 100, 1)}%</span>
                        </td>
                        <td style={{ padding: '0.55rem 0.6rem', textAlign: 'right' }}>
                          <span style={{ filter: 'blur(5px)', userSelect: 'none', color: brand.textDim, fontSize: '0.75rem' }}>R$ {fmt(r.last_close * 0.95)} → R$ {fmt(r.pred_price_t_plus_20 * 1.05)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '0.75rem 1rem', borderTop: `1px solid ${brand.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: brand.textDim }}>
                Mostrando 8 de {UNIVERSE_SIZE_FALLBACK} ações · Colunas com <Lock size={9} style={{ verticalAlign: 'middle' }} /> são exclusivas Pro
              </span>
              <button onClick={() => navigate('/register')} style={{
                padding: '0.4rem 1rem', borderRadius: 8, border: 'none', fontSize: '0.8rem', fontWeight: 600,
                background: brand.gradient, color: 'white', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                boxShadow: `0 2px 10px ${brand.glow}`,
              }}>
                Ver todas <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: brand.textDim }}>
            <RefreshCw size={24} style={{ animation: 'qyntara-spin 1s linear infinite', marginBottom: '0.5rem' }} />
            <div>Carregando dados ao vivo...</div>
          </div>
        )}
      </section>

      {/* ─── How it Works ─── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '4rem clamp(1rem, 4vw, 2rem) 2rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.75rem)', fontWeight: 700, marginBottom: '0.5rem' }}>Como funciona?</h2>
        <p style={{ color: brand.textDim, marginBottom: '2.5rem', fontSize: '0.9rem' }}>Pipeline 100% automatizado, do dado ao sinal</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { step: '1', icon: <BarChart3 size={20} />, title: 'Coleta', desc: 'Preços, volumes e indicadores de todas as ações da B3 são coletados automaticamente.' },
            { step: '→', icon: null, title: '', desc: '' },
            { step: '2', icon: <Brain size={20} />, title: 'Modelo DeepAR', desc: 'O modelo de ML processa os dados e gera previsões de preço para 20 pregões.' },
            { step: '→', icon: null, title: '', desc: '' },
            { step: '3', icon: <BarChart3 size={20} />, title: 'Sinais', desc: 'Ações ranqueadas por score com sinais claros de Compra, Venda ou Neutro.' },
          ].map((s, i) => s.icon ? (
            <div key={i} style={{ flex: '1 1 160px', maxWidth: 200, padding: '1.25rem 0.75rem', background: brand.surfaceCard, border: `1px solid ${brand.borderSubtle}`, borderRadius: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: brand.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', margin: '0 auto 0.75rem', fontSize: '0.9rem', fontWeight: 700, boxShadow: `0 2px 10px ${brand.glow}` }}>{s.step}</div>
              <div style={{ color: brand.accent, marginBottom: '0.4rem' }}>{s.icon}</div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.3rem', color: brand.text }}>{s.title}</h3>
              <p style={{ fontSize: '0.78rem', color: brand.textDim, lineHeight: 1.5, margin: 0 }}>{s.desc}</p>
            </div>
          ) : (
            <div key={i} style={{ display: 'flex', alignItems: 'center', color: brand.accent, fontSize: '1.5rem', padding: '0 0.25rem', opacity: 0.4 }}>→</div>
          ))}
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section id="features" style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem clamp(1rem, 4vw, 2rem)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 700, marginBottom: '0.5rem' }}>O que você encontra dentro</h2>
          <p style={{ color: brand.textDim, fontSize: '0.9rem' }}>Tudo que um investidor precisa para tomar decisões informadas</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '1rem' }}>
          {[
            { icon: <BarChart3 size={22} />, title: 'Ranking Diário', desc: 'Todas as ações ranqueadas por score ML com sinais de Compra/Venda/Neutro atualizados diariamente.', tag: 'Free', tagColor: brand.buy },
            { icon: <Brain size={22} />, title: 'Explicabilidade', desc: 'Entenda por que cada ação foi recomendada com SHAP values, importância de features e comparação entre ações.', tag: 'Free', tagColor: brand.buy },
            { icon: <TestTubes size={22} />, title: 'Backtesting', desc: 'Simule estratégias com dados históricos reais. Métricas de risco, Sharpe, drawdown e comparação com benchmarks.', tag: 'Free', tagColor: brand.buy },
            { icon: <LineChart size={22} />, title: 'Performance', desc: 'Acompanhe a performance acumulada do modelo vs mercado com gráficos interativos e métricas detalhadas.', tag: 'Free', tagColor: brand.buy },
            { icon: <RefreshCw size={22} />, title: 'Mudanças de Sinal', desc: 'Veja quais ações mudaram de sinal hoje vs ontem e compare o ranking com dias anteriores.', tag: 'Free', tagColor: brand.buy },
            { icon: <Eye size={22} />, title: 'Preço Previsto & Retorno', desc: 'Acesse previsões de preço para 20 pregões e retorno esperado para cada ação do universo.', tag: 'Pro', tagColor: brand.pro },
            { icon: <Shield size={22} />, title: 'Stop-Loss & Take-Profit', desc: 'Faixas de preço sugeridas baseadas em volatilidade para proteger seu capital e maximizar ganhos.', tag: 'Pro', tagColor: brand.pro },
            { icon: <Target size={22} />, title: 'Tracking por Safra', desc: 'Acompanhe cada safra de recomendações e veja como performaram ao longo do tempo.', tag: 'Pro', tagColor: brand.pro },
            { icon: <Briefcase size={22} />, title: 'Carteira Modelo', desc: 'Portfólio otimizado com perfis de risco (conservador, moderado, agressivo) e rebalanceamento sugerido.', tag: 'Pro', tagColor: brand.pro },
            { icon: <Star size={22} />, title: 'Seguir Posições', desc: 'Siga ações e acompanhe sua performance pessoal com P&L, win rate e meta de rentabilidade.', tag: 'Pro', tagColor: brand.pro },
            { icon: <FileText size={22} />, title: 'Relatório Mensal', desc: 'Exporte um relatório completo do mês com suas posições, retornos e as top recomendações.', tag: 'Pro', tagColor: brand.pro },
            { icon: <Zap size={22} />, title: 'Filtros Avançados', desc: 'Filtre por setor, sinal, favoritos. Exporte CSV. Notificações de mudança de sinal em tempo real.', tag: 'Free', tagColor: brand.buy },
          ].map((f, i) => (
            <div key={i} style={{
              background: f.tag === 'Pro' ? 'linear-gradient(135deg, rgba(245,158,11,0.04), rgba(245,158,11,0.01))' : brand.surfaceCard,
              border: `1px solid ${f.tag === 'Pro' ? 'rgba(245,158,11,0.15)' : brand.borderSubtle}`,
              borderRadius: 12, padding: '1.25rem', transition: 'border-color 0.2s, transform 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: f.tag === 'Pro' ? 'rgba(245,158,11,0.1)' : brand.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.tag === 'Pro' ? brand.pro : brand.accent }}>{f.icon}</div>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 8, background: `${f.tagColor}15`, color: f.tagColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.tag}</span>
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.35rem', color: brand.text }}>{f.title}</h3>
              <p style={{ fontSize: '0.82rem', color: brand.textDim, lineHeight: 1.5, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Track Record ─── */}
      <section id="track-record" style={{ maxWidth: 900, margin: '0 auto', padding: '4rem clamp(1rem, 4vw, 2rem)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 700, marginBottom: '0.5rem' }}>Resultados Reais</h2>
        <p style={{ color: brand.textDim, marginBottom: '2rem', fontSize: '0.9rem' }}>
          Performance real dos sinais de Compra — calculada com preços da B3
        </p>
        {trackRecord && trackRecord.days >= 3 ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { icon: <ArrowUpRight size={24} />, label: 'Retorno Acumulado', value: `${trackRecord.totalReturn >= 0 ? '+' : ''}${trackRecord.totalReturn.toFixed(2)}%`, color: trackRecord.totalReturn >= 0 ? brand.buy : brand.sell, sub: `em ${trackRecord.days} pregões` },
                { icon: <Award size={24} />, label: 'Alpha vs Mercado', value: `${trackRecord.alpha >= 0 ? '+' : ''}${trackRecord.alpha.toFixed(2)}pp`, color: trackRecord.alpha >= 0 ? brand.buy : brand.sell, sub: 'acima do benchmark' },
                { icon: <Target size={24} />, label: 'Win Rate', value: `${trackRecord.winRate.toFixed(0)}%`, color: trackRecord.winRate >= 55 ? brand.buy : brand.pro, sub: 'dos dias positivos' },
              ].map((m, i) => (
                <div key={i} style={{ background: brand.surfaceCard, border: `1px solid ${brand.borderSubtle}`, borderRadius: 16, padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: brand.gradient, opacity: 0.6 }} />
                  <div style={{ color: m.color, marginBottom: '0.75rem', opacity: 0.8 }}>{m.icon}</div>
                  <div style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 800, color: m.color, marginBottom: '0.15rem' }}>{m.value}</div>
                  <div style={{ fontSize: '0.85rem', color: brand.textMuted, fontWeight: 500 }}>{m.label}</div>
                  <div style={{ fontSize: '0.7rem', color: brand.textDim, marginTop: '0.2rem' }}>{m.sub}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: brand.textDim, lineHeight: 1.5, maxWidth: 600, margin: '0 auto' }}>
              Retorno acumulado comprando igualmente todas as ações com sinal de Compra (score ≥ {SCORE_BUY_THRESHOLD}).
              Dados reais da B3. Resultados passados não garantem resultados futuros.
            </p>
          </>
        ) : (
          <div style={{ padding: '2rem', color: brand.textDim, fontSize: '0.9rem' }}>Calculando resultados...</div>
        )}
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" style={{ maxWidth: 950, margin: '0 auto', padding: '4rem clamp(1rem, 4vw, 2rem)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: 700, marginBottom: '0.5rem' }}>Planos</h2>
        <p style={{ color: brand.textDim, marginBottom: '2.5rem', fontSize: '0.95rem' }}>Comece grátis. Escale quando quiser.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '1.5rem' }}>
          {/* Free */}
          <div style={{ background: brand.surfaceCard, border: `1px solid ${brand.borderSubtle}`, borderRadius: 16, padding: '2rem', textAlign: 'left' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Free</h3>
            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>R$ 0</span>
              <span style={{ color: brand.textDim, fontSize: '0.9rem' }}>/mês</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: brand.textMuted, marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Acesso completo ao ranking, explicabilidade, backtesting e performance.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem' }}>
              {[
                `${UNIVERSE_SIZE_FALLBACK} ações com sinal diário`,
                'Ranking por score ML',
                'Explicabilidade com SHAP',
                'Backtesting com dados reais',
                'Performance acumulada',
                'Mudanças de sinal',
                'Comparação temporal',
                'Filtro por setor e sinal',
              ].map((f, j) => (
                <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', color: brand.textMuted, fontSize: '0.85rem' }}>
                  <CheckCircle size={15} color={brand.buy} style={{ flexShrink: 0, marginTop: 2 }} /> {f}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/register')} style={{
              width: '100%', padding: '0.75rem', background: 'transparent', border: `1px solid ${brand.borderSubtle}`,
              color: brand.text, borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', transition: 'all 0.2s',
            }}>Criar Conta Grátis</button>
          </div>
          {/* Pro */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(99,102,241,0.04))',
            border: `2px solid ${brand.accent}`, borderRadius: 16, padding: '2rem', textAlign: 'left', position: 'relative',
          }}>
            <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: brand.gradient, color: 'white', fontSize: '0.75rem', fontWeight: 700, padding: '0.3rem 1rem', borderRadius: 12, display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: `0 2px 12px ${brand.glow}` }}>
              <Crown size={12} /> Recomendado
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Pro <Crown size={16} color={brand.pro} />
            </h3>
            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>{PRO_PRICE}</span>
              <span style={{ color: brand.textDim, fontSize: '0.9rem' }}>/mês</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: brand.textMuted, marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Tudo do Free + previsões completas, tracking e ferramentas avançadas.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem' }}>
              {[
                { text: 'Tudo do plano Free', highlight: false },
                { text: 'Preço previsto (20 pregões)', highlight: true },
                { text: 'Retorno previsto por ação', highlight: true },
                { text: 'Stop-Loss & Take-Profit', highlight: true },
                { text: 'Confiança do modelo', highlight: true },
                { text: 'Tracking por safra', highlight: true },
                { text: 'Carteira modelo otimizada', highlight: true },
                { text: 'Seguir posições + P&L pessoal', highlight: true },
                { text: 'Meta de rentabilidade', highlight: true },
                { text: 'Relatório mensal exportável', highlight: true },
                { text: 'Exportação CSV', highlight: true },
              ].map((f, j) => (
                <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', color: f.highlight ? brand.text : brand.textMuted, fontSize: '0.85rem', fontWeight: f.highlight ? 500 : 400 }}>
                  <CheckCircle size={15} color={f.highlight ? brand.pro : brand.buy} style={{ flexShrink: 0, marginTop: 2 }} /> {f.text}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/register')} style={{
              width: '100%', padding: '0.75rem', background: brand.gradient,
              border: 'none', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem',
              boxShadow: `0 4px 20px ${brand.glowStrong}`,
            }}>Começar com Pro</button>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section style={{ maxWidth: 700, margin: '0 auto', padding: '4rem clamp(1rem, 4vw, 2rem)', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, height: 300, background: `radial-gradient(ellipse, ${brand.glow} 0%, transparent 70%)`, pointerEvents: 'none', filter: 'blur(50px)' }} />
        <h2 style={{ fontSize: 'clamp(1.3rem, 4vw, 1.75rem)', fontWeight: 700, marginBottom: '0.75rem', position: 'relative' }}>
          Pronto para investir com inteligência?
        </h2>
        <p style={{ color: brand.textDim, marginBottom: '1.5rem', fontSize: '0.95rem', position: 'relative' }}>
          Crie sua conta em 30 segundos e comece a receber sinais do modelo.
        </p>
        <button onClick={() => navigate('/register')} style={{
          padding: '0.9rem 2.5rem', borderRadius: 12, border: 'none',
          background: brand.gradient, color: 'white',
          fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer',
          boxShadow: `0 4px 24px ${brand.glowStrong}`,
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem', position: 'relative',
        }}>
          Começar Grátis <ArrowRight size={18} />
        </button>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{ borderTop: `1px solid ${brand.borderSubtle}`, padding: '2.5rem clamp(1rem, 4vw, 2rem)', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6, background: brand.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.7rem' }}>Q</span>
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, background: brand.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Qyntara</span>
        </div>
        <p style={{ color: brand.textDim, fontSize: '0.78rem' }}>© {new Date().getFullYear()} Qyntara. Todos os direitos reservados.</p>
        <p style={{ marginTop: '0.3rem', fontSize: '0.72rem', color: brand.textDim }}>
          Não é recomendação de investimento. Resultados passados não garantem resultados futuros.
        </p>
        <a href="#/privacidade" style={{ color: brand.textMuted, fontSize: '0.72rem', textDecoration: 'underline', marginTop: '0.4rem', display: 'inline-block' }}>
          <Shield size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />Política de Privacidade
        </a>
      </footer>

      {/* Sticky CTA mobile */}
      <div className="landing-sticky-cta" style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        padding: '0.6rem 1rem', background: 'rgba(12,15,26,0.95)', backdropFilter: 'blur(8px)',
        borderTop: `1px solid ${brand.borderSubtle}`, paddingBottom: 'env(safe-area-inset-bottom, 0.6rem)',
      }}>
        <button onClick={() => navigate('/register')} style={{
          width: '100%', padding: '0.7rem', borderRadius: 10, border: 'none',
          background: brand.gradient, color: 'white',
          fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          boxShadow: `0 2px 12px ${brand.glow}`,
        }}>
          Começar Grátis <ArrowRight size={16} />
        </button>
      </div>

      <style>{`
        @keyframes qyntara-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes qyntara-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .landing-nav-desktop { display: none !important; }
          .landing-nav-mobile { display: flex !important; }
          .landing-mobile-menu { display: flex !important; }
          .landing-sticky-cta { display: block !important; }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
