import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Shield, BarChart3, Zap, ArrowRight, CheckCircle } from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9' }}>
      {/* Navbar */}
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 2rem', maxWidth: 1200, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <TrendingUp size={28} color="#3b82f6" />
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f1f5f9' }}>B3 Tactical Ranking</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
              padding: '0.5rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#f1f5f9'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            Entrar
          </button>
          <button
            onClick={() => navigate('/register')}
            style={{
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white',
              padding: '0.5rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem',
              fontWeight: 600, transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Começar Grátis
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        maxWidth: 1200, margin: '0 auto', padding: '5rem 2rem 3rem', textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: 20, padding: '0.35rem 1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#60a5fa',
        }}>
          Powered by Machine Learning &amp; DeepAR
        </div>
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1,
          marginBottom: '1.5rem', background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Recomendações inteligentes<br />para a Bolsa Brasileira
        </h1>
        <p style={{
          fontSize: '1.15rem', color: '#94a3b8', maxWidth: 600, margin: '0 auto 2.5rem',
          lineHeight: 1.6,
        }}>
          Sistema de ranking tático que combina modelos de ML com análise fundamentalista
          para identificar as melhores oportunidades na B3.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/register')}
            style={{
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white',
              padding: '0.85rem 2rem', borderRadius: 10, cursor: 'pointer', fontSize: '1rem',
              fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem',
              transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Criar Conta <ArrowRight size={18} />
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', color: '#f1f5f9',
              padding: '0.85rem 2rem', borderRadius: 10, cursor: 'pointer', fontSize: '1rem',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
          >
            Já tenho conta
          </button>
        </div>
      </section>

      {/* Features */}
      <section style={{
        maxWidth: 1200, margin: '0 auto', padding: '3rem 2rem',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem',
      }}>
        {[
          { icon: <TrendingUp size={24} />, title: 'Ranking Diário', desc: 'Top ações ranqueadas por ML com atualização automática após o pregão.' },
          { icon: <BarChart3 size={24} />, title: 'Explicabilidade', desc: 'Entenda por que cada ação foi recomendada com SHAP values e análise de features.' },
          { icon: <Shield size={24} />, title: 'Backtesting', desc: 'Simule estratégias com dados históricos e métricas de risco completas.' },
          { icon: <Zap size={24} />, title: 'Tempo Real', desc: 'Monitoramento contínuo de drift, qualidade de dados e performance do modelo.' },
        ].map((f, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 12,
            padding: '1.75rem', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 10, background: 'rgba(59,130,246,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6',
              marginBottom: '1rem',
            }}>
              {f.icon}
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#f1f5f9' }}>{f.title}</h3>
            <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Pricing */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '4rem 2rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.75rem' }}>Planos</h2>
        <p style={{ color: '#64748b', marginBottom: '2.5rem' }}>Comece grátis e escale conforme sua necessidade.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {[
            { name: 'Free', price: 'R$ 0', period: '/mês', features: ['Top 5 recomendações', 'Explicabilidade básica', 'Atualização diária'], cta: 'Começar Grátis', highlight: false },
            { name: 'Pro', price: 'R$ 49', period: '/mês', features: ['Top 50 recomendações', 'Explicabilidade completa', 'Backtesting', 'Alertas personalizados', 'Suporte prioritário'], cta: 'Assinar Pro', highlight: true },
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
                }}>
                  Popular
                </div>
              )}
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{plan.name}</h3>
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>{plan.price}</span>
                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{plan.period}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem', textAlign: 'left' }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                    <CheckCircle size={16} color="#10b981" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/register')}
                style={{
                  width: '100%', padding: '0.7rem',
                  background: plan.highlight ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : 'transparent',
                  border: plan.highlight ? 'none' : '1px solid #334155',
                  color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                  transition: 'all 0.2s',
                }}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #1e293b', padding: '2rem', textAlign: 'center',
        color: '#475569', fontSize: '0.85rem',
      }}>
        <p>© 2026 B3 Tactical Ranking. Todos os direitos reservados.</p>
        <p style={{ marginTop: '0.5rem' }}>
          Não é recomendação de investimento. Resultados passados não garantem resultados futuros.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
