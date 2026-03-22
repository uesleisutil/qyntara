import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Shield, BarChart3, Zap, ArrowRight, CheckCircle, Menu, X } from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          { value: '20+', label: 'Indicadores por ação' },
          { value: '100%', label: 'Automatizado por ML' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center', minWidth: 120 }}>
            <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, color: '#3b82f6' }}>{s.value}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{s.label}</div>
          </div>
        ))}
      </section>

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

      {/* Pricing */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '4rem clamp(1rem, 4vw, 2rem)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 700, marginBottom: '0.75rem' }}>Planos</h2>
        <p style={{ color: '#64748b', marginBottom: '2.5rem' }}>Comece grátis e escale conforme sua necessidade.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '1.5rem' }}>
          {[
            { name: 'Free', price: 'R$ 0', period: '/mês', features: ['Recomendações diárias (top 5)', 'Explicabilidade básica', 'Backtesting', 'Acompanhamento por safra'], cta: 'Começar Grátis', highlight: false },
            { name: 'Pro', price: 'R$ 49', period: '/mês', features: ['Todas as 46 recomendações', 'Carteira modelo otimizada', 'Stop-loss e take-profit', 'Performance acumulada vs Ibovespa', 'Ranking de confiança', 'Notificações e alertas'], cta: 'Assinar Pro', highlight: true },
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
      </footer>

      <style>{`
        @media (max-width: 640px) {
          .landing-nav-desktop { display: none !important; }
          .landing-nav-mobile { display: flex !important; }
          .landing-mobile-menu { display: flex !important; }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
