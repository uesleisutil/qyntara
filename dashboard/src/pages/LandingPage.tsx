import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Shield, BarChart3, Zap, ArrowRight, CheckCircle, Menu, X, Award, Target } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../config';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [trackRecord, setTrackRecord] = useState<{ totalReturn: number; alpha: number; winRate: number; days: number } | null>(null);
  const [socialProof, setSocialProof] = useState<{ userCount: number; lastUpdate: string }>({ userCount: 0, lastUpdate: '' });

  useEffect(() => {
    (async () => {
      try {
        const headers = { 'x-api-key': API_KEY };
        const [histRes, marRes, febRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/recommendations/history`, { headers }),
          fetch(`${API_BASE_URL}/s3-proxy?key=curated/daily_monthly/year=2026/month=03/daily.csv`, { headers }),
          fetch(`${API_BASE_URL}/s3-proxy?key=curated/daily_monthly/year=2026/month=02/daily.csv`, { headers }),
        ]);
        if (!histRes.ok) return;
        const hd = await histRes.json();
        const history: Record<string, { date: string; score: number }[]> = hd.data || {};
        const priceMap: Record<string, Record<string, number>> = {};
        for (const res of [febRes, marRes]) {
          if (res.ok) {
            const rows: { date: string; ticker: string; close: string }[] = await res.json();
            rows.forEach(r => {
              if (!priceMap[r.ticker]) priceMap[r.ticker] = {};
              priceMap[r.ticker][r.date] = parseFloat(r.close);
            });
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
            if (entry.score >= 1.5) buyReturns.push(dayReturn);
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
        setTrackRecord({
          totalReturn, alpha: totalReturn - ibovReturn,
          winRate: dailyReturns.length > 0 ? (buyWins / dailyReturns.length) * 100 : 0,
          days: dailyReturns.length,
        });
      } catch {}
    })();
  }, []);

  // Fetch social proof: user count + last recommendation date
  useEffect(() => {
    (async () => {
      try {
        const headers = { 'x-api-key': API_KEY };
        const [statsRes, recRes] = await Promise.all([
          fetch(`${API_BASE_URL}/auth/stats`).catch(() => null),
          fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers }),
        ]);
        let userCount = 0;
        if (statsRes && statsRes.ok) {
          const sd = await statsRes.json();
          userCount = sd.userCount || 0;
        }
        let lastUpdate = '';
        if (recRes && recRes.ok) {
          const rd = await recRes.json();
          lastUpdate = rd.date || '';
        }
        setSocialProof({ userCount, lastUpdate });
      } catch {}
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9' }}>
      {/* Navbar */}
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem clamp(1rem, 4vw, 2rem)', maxWidth: 1200, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <TrendingUp size={28} color="#3b82f6" />
          <span style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)', fontWeight: 700, color: '#f1f5f9' }}>B3 Tactical Ranking</span>
        </div>
        {/* Desktop buttons */}
        <div className="landing-nav-desktop" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={() => navigate('/login')} style={{
            background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
            padding: '0.5rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#f1f5f9'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94a3b8'; }}
          >Entrar</button>
          <button onClick={() => navigate('/register')} style={{
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white',
            padding: '0.5rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
          }}>Começar Grátis</button>
        </div>
        {/* Mobile hamburger */}
        <button className="landing-nav-mobile" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{
          display: 'none', background: 'none', border: 'none', color: '#f1f5f9', cursor: 'pointer', padding: 4,
        }} aria-label="Menu">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="landing-mobile-menu" style={{
          display: 'none', flexDirection: 'column', gap: '0.5rem',
          padding: '0 1rem 1rem', maxWidth: 1200, margin: '0 auto',
        }}>
          <button onClick={() => { navigate('/login'); setMobileMenuOpen(false); }} style={{
            width: '100%', padding: '0.75rem', background: 'transparent', border: '1px solid #334155',
            color: '#f1f5f9', borderRadius: 8, cursor: 'pointer', fontSize: '0.95rem',
          }}>Entrar</button>
          <button onClick={() => { navigate('/register'); setMobileMenuOpen(false); }} style={{
            width: '100%', padding: '0.75rem', background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600,
          }}>Começar Grátis</button>
        </div>
      )}

      {/* Hero */}
      <section style={{
        maxWidth: 1200, margin: '0 auto', padding: 'clamp(2rem, 8vw, 5rem) clamp(1rem, 4vw, 2rem) 3rem', textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: 20, padding: '0.35rem 1rem', marginBottom: '1.5rem', fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', color: '#60a5fa',
        }}>
          Powered by Machine Learning &amp; DeepAR
        </div>
        <h1 style={{
          fontSize: 'clamp(1.75rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1,
          marginBottom: '1.5rem', background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Recomendações inteligentes<br />para a Bolsa Brasileira
        </h1>
        <p style={{
          fontSize: 'clamp(0.95rem, 2.5vw, 1.15rem)', color: '#94a3b8', maxWidth: 600, margin: '0 auto 2.5rem',
          lineHeight: 1.6, padding: '0 0.5rem',
        }}>
          Sistema de ranking tático que combina modelos de ML com análise fundamentalista
          para identificar as melhores oportunidades na B3.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', padding: '0 0.5rem' }}>
          <button onClick={() => navigate('/register')} style={{
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white',
            padding: '0.85rem 2rem', borderRadius: 10, cursor: 'pointer', fontSize: '1rem',
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem',
            boxShadow: '0 4px 14px rgba(37,99,235,0.4)', flex: '1 1 auto', maxWidth: 250, justifyContent: 'center',
          }}>
            Criar Conta <ArrowRight size={18} />
          </button>
          <button onClick={() => navigate('/login')} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', color: '#f1f5f9',
            padding: '0.85rem 2rem', borderRadius: 10, cursor: 'pointer', fontSize: '1rem',
            flex: '1 1 auto', maxWidth: 250, justifyContent: 'center',
          }}>
            Já tenho conta
          </button>
        </div>
      </section>

      {/* Social Proof */}
      <section style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 clamp(1rem, 4vw, 2rem) 2rem',
        display: 'flex', justifyContent: 'center', gap: 'clamp(1.5rem, 4vw, 3rem)', flexWrap: 'wrap',
      }}>
        {[
          { value: '46', label: 'Ações analisadas diariamente' },
          { value: socialProof.userCount > 0 ? `${socialProof.userCount}+` : '20+', label: 'Investidores cadastrados' },
          { value: '100%', label: 'Automatizado por ML' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center', minWidth: 120 }}>
            <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, color: '#3b82f6' }}>{s.value}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{s.label}</div>
          </div>
        ))}
      </section>
      {/* Last update timestamp */}
      {socialProof.lastUpdate && (
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.25rem 0.75rem', borderRadius: 20, fontSize: '0.72rem',
            background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 500,
          }}>
            ● Última atualização: {new Date(socialProof.lastUpdate + 'T18:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
        </div>
      )}

      {/* How it works */}
      <section style={{
        maxWidth: 900, margin: '0 auto', padding: '3rem clamp(1rem, 4vw, 2rem)', textAlign: 'center',
      }}>
        <h2 style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.75rem)', fontWeight: 700, marginBottom: '0.5rem' }}>Como funciona?</h2>
        <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '0.9rem' }}>Em 3 passos simples</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '1.5rem' }}>
          {[
            { step: '1', title: 'Coleta de Dados', desc: 'Todos os dias, coletamos preços, volumes e indicadores de todas as ações da B3.' },
            { step: '2', title: 'Modelo de ML', desc: 'Nosso modelo DeepAR processa os dados e gera previsões de preço para os próximos 20 pregões.' },
            { step: '3', title: 'Ranking & Sinal', desc: 'As ações são ranqueadas por score e você recebe sinais claros de Compra, Venda ou Neutro.' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                fontSize: '1.1rem', fontWeight: 700,
              }}>{s.step}</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#f1f5f9' }}>{s.title}</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{
        maxWidth: 1200, margin: '0 auto', padding: '3rem clamp(1rem, 4vw, 2rem)',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: '1rem',
      }}>
        {[
          { icon: <TrendingUp size={24} />, title: 'Ranking Diário', desc: 'Top ações ranqueadas por ML com atualização automática após o pregão.' },
          { icon: <BarChart3 size={24} />, title: 'Explicabilidade', desc: 'Entenda por que cada ação foi recomendada com SHAP values e análise de features.' },
          { icon: <Shield size={24} />, title: 'Backtesting', desc: 'Simule estratégias com dados históricos e métricas de risco completas.' },
          { icon: <Zap size={24} />, title: 'Tempo Real', desc: 'Monitoramento contínuo de drift, qualidade de dados e performance do modelo.' },
        ].map((f, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 12, padding: '1.5rem',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, background: 'rgba(59,130,246,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', marginBottom: '1rem',
            }}>{f.icon}</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#f1f5f9' }}>{f.title}</h3>
            <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Dashboard Preview */}
      <section style={{
        maxWidth: 900, margin: '0 auto', padding: '3rem clamp(1rem, 4vw, 2rem)', textAlign: 'center',
      }}>
        <h2 style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.75rem)', fontWeight: 700, marginBottom: '0.5rem' }}>Veja o que te espera</h2>
        <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Dashboard completo com recomendações, explicabilidade e backtesting
        </p>
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 16,
          padding: 'clamp(1rem, 3vw, 1.5rem)', textAlign: 'left',
        }}>
          {/* Mock dashboard preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '0.5rem' }}>B3 Tactical Ranking — Dashboard</span>
          </div>
          {/* KPI preview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100px, 100%), 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {[
              { label: 'Compra', value: '12', color: '#10b981' },
              { label: 'Venda', value: '8', color: '#ef4444' },
              { label: 'Neutro', value: '26', color: '#f59e0b' },
              { label: 'Top Score', value: '3.2', color: '#8b5cf6' },
            ].map((k, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #334155', borderRadius: 8, padding: '0.5rem' }}>
                <div style={{ fontSize: '0.6rem', color: '#64748b' }}>{k.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>
          {/* Table preview */}
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #334155' }}>
            {[
              { ticker: 'PETR4', signal: 'Compra', score: '3.21', ret: '+8.5%', sc: '#10b981' },
              { ticker: 'VALE3', signal: 'Compra', score: '2.87', ret: '+6.2%', sc: '#10b981' },
              { ticker: 'ITUB4', signal: 'Neutro', score: '0.45', ret: '+1.1%', sc: '#f59e0b' },
              { ticker: 'BBDC4', signal: 'Venda', score: '-2.10', ret: '-3.8%', sc: '#ef4444' },
            ].map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem',
                borderBottom: i < 3 ? '1px solid #334155' : 'none', fontSize: '0.78rem',
              }}>
                <span style={{ fontWeight: 700, color: '#f1f5f9', width: 50 }}>{r.ticker}</span>
                <span style={{
                  padding: '0.12rem 0.4rem', borderRadius: 8, fontSize: '0.65rem', fontWeight: 600,
                  background: `${r.sc}15`, color: r.sc,
                }}>{r.signal}</span>
                <span style={{ color: '#3b82f6', fontWeight: 600, marginLeft: 'auto' }}>{r.score}</span>
                <span style={{ color: r.sc, fontWeight: 600, width: 50, textAlign: 'right' }}>{r.ret}</span>
                <span style={{ filter: 'blur(4px)', color: '#64748b', fontSize: '0.7rem' }}>R$ 38.50</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              + 42 ações analisadas · Colunas Pro com blur
            </span>
          </div>
        </div>
        <button onClick={() => navigate('/register')} style={{
          marginTop: '1.25rem', padding: '0.7rem 1.5rem', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: 'white',
          fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
        }}>
          Criar Conta Grátis <ArrowRight size={16} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
        </button>
      </section>

      {/* Strategy C: Track Record — Resultados Reais */}
      {trackRecord && trackRecord.days >= 3 && (
        <section style={{
          maxWidth: 900, margin: '0 auto', padding: '3rem clamp(1rem, 4vw, 2rem)', textAlign: 'center',
        }}>
          <h2 style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.75rem)', fontWeight: 700, marginBottom: '0.5rem' }}>Resultados Reais</h2>
          <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '0.9rem' }}>
            Performance real dos sinais de Compra do modelo nos últimos {trackRecord.days} pregões
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { icon: <TrendingUp size={22} />, label: 'Retorno Realizado', value: `${trackRecord.totalReturn >= 0 ? '+' : ''}${trackRecord.totalReturn.toFixed(2)}%`, color: trackRecord.totalReturn >= 0 ? '#10b981' : '#ef4444' },
              { icon: <Award size={22} />, label: 'Alpha vs Mercado', value: `${trackRecord.alpha >= 0 ? '+' : ''}${trackRecord.alpha.toFixed(2)}pp`, color: trackRecord.alpha >= 0 ? '#10b981' : '#ef4444' },
              { icon: <Target size={22} />, label: 'Win Rate', value: `${trackRecord.winRate.toFixed(0)}%`, color: trackRecord.winRate >= 55 ? '#10b981' : '#f59e0b' },
            ].map((m, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 12, padding: '1.25rem',
              }}>
                <div style={{ color: m.color, marginBottom: '0.5rem', opacity: 0.8 }}>{m.icon}</div>
                <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, color: m.color, marginBottom: '0.25rem' }}>{m.value}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{m.label}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.72rem', color: '#475569', lineHeight: 1.5 }}>
            Dados calculados com preços reais da B3. Retorno acumulado comprando igualmente todas as ações com sinal de Compra.
            Resultados passados não garantem resultados futuros.
          </p>
        </section>
      )}

      {/* Pricing */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '4rem clamp(1rem, 4vw, 2rem)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 700, marginBottom: '0.75rem' }}>Planos</h2>
        <p style={{ color: '#64748b', marginBottom: '2.5rem' }}>Comece grátis e escale conforme sua necessidade.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '1.5rem' }}>
          {[
            { name: 'Free', price: 'R$ 0', period: '/mês', features: ['46 ações analisadas diariamente', 'Explicabilidade (SHAP)', 'Backtesting com dados reais', 'Performance acumulada', 'Colunas Pro com blur'], cta: 'Começar Grátis', highlight: false },
            { name: 'Pro', price: 'R$ 49', period: '/mês', features: ['Tudo do Free, sem restrições', 'Confiança, Stop-Loss, Take-Profit', 'Carteira modelo otimizada', 'Tracking por safra', 'Ranking de confiança', 'Portfólio com perfis de risco'], cta: 'Assinar Pro', highlight: true },
          ].map((plan, i) => (
            <div key={i} style={{
              background: plan.highlight ? 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(59,130,246,0.05))' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${plan.highlight ? '#2563eb' : '#1e293b'}`,
              borderRadius: 16, padding: '2rem', position: 'relative',
            }}>
              {plan.highlight && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: '#2563eb', color: 'white', fontSize: '0.75rem', fontWeight: 600,
                  padding: '0.25rem 0.75rem', borderRadius: 12,
                }}>Popular</div>
              )}
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{plan.name}</h3>
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: 'clamp(2rem, 5vw, 2.5rem)', fontWeight: 800 }}>{plan.price}</span>
                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{plan.period}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem', textAlign: 'left' }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                    <CheckCircle size={16} color="#10b981" /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/register')} style={{
                width: '100%', padding: '0.7rem',
                background: plan.highlight ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : 'transparent',
                border: plan.highlight ? 'none' : '1px solid #334155',
                color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
              }}>{plan.cta}</button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #1e293b', padding: '2rem clamp(1rem, 4vw, 2rem)', textAlign: 'center',
        color: '#475569', fontSize: '0.85rem',
      }}>
        <p>© 2026 B3 Tactical Ranking. Todos os direitos reservados.</p>
        <p style={{ marginTop: '0.5rem' }}>
          Não é recomendação de investimento. Resultados passados não garantem resultados futuros.
        </p>
        <a href="#/privacidade" style={{ color: '#64748b', fontSize: '0.78rem', textDecoration: 'underline', marginTop: '0.5rem', display: 'inline-block' }}>
          Política de Privacidade
        </a>
      </footer>

      {/* Sticky CTA for mobile */}
      <div className="landing-sticky-cta" style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        padding: '0.75rem 1rem', background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(8px)',
        borderTop: '1px solid #1e293b',
      }}>
        <button onClick={() => navigate('/register')} style={{
          width: '100%', padding: '0.75rem', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: 'white',
          fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        }}>
          Começar Grátis <ArrowRight size={16} />
        </button>
      </div>

      <style>{`
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
