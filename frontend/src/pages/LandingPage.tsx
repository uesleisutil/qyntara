import React, { useEffect, useRef, useState } from 'react';
import { theme, badgeStyle } from '../styles';
import {
  TrendingUp, Zap, GitCompare, Brain, BarChart3,
  ArrowRight, Check, Globe, Briefcase, Activity, Star, Crown,
  Sparkles, Eye, Target, LineChart,
} from 'lucide-react';

interface Props { onGetStarted: () => void; }

/* ── Scroll reveal hook ── */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function RevealSection({ children, delay = 0, direction = 'up', style }: {
  children: React.ReactNode; delay?: number; direction?: 'up' | 'left' | 'right' | 'scale';
  style?: React.CSSProperties;
}) {
  const { ref, visible } = useReveal();
  const anims: Record<string, string> = {
    up: 'slideUp', left: 'slideInLeft', right: 'slideInRight', scale: 'scaleIn',
  };
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      animation: visible ? `${anims[direction]} 0.7s ease ${delay}s both` : undefined,
      ...style,
    }}>{children}</div>
  );
}

export const LandingPage: React.FC<Props> = ({ onGetStarted }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  const features = [
    { icon: <BarChart3 size={24} />, title: 'Scanner de Mercados', desc: 'Agregação em tempo real de Polymarket + Kalshi. Filtre, busque e ordene por volume — tudo em uma tela.', color: theme.blue, gradient: `linear-gradient(135deg, ${theme.blue}, ${theme.cyan})`, free: true },
    { icon: <Brain size={24} />, title: 'Detector de Edge com IA', desc: 'Modelo Transformer estima a probabilidade real e encontra mercados com preço errado. Sinais antes da multidão.', color: theme.accent, gradient: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})` },
    { icon: <GitCompare size={24} />, title: 'Motor de Arbitragem', desc: 'Detecta o mesmo evento com preços diferentes entre plataformas. Alertas instantâneos quando spread > 3%.', color: theme.green, gradient: `linear-gradient(135deg, ${theme.green}, #34d399)` },
    { icon: <Activity size={24} />, title: 'Alertas de Smart Money', desc: 'Autoencoder detecta picos incomuns de volume — saiba quando dinheiro inteligente está entrando.', color: theme.yellow, gradient: `linear-gradient(135deg, ${theme.yellow}, #fbbf24)` },
    { icon: <Briefcase size={24} />, title: 'Portfólio & Risco', desc: 'Acompanhe posições, calcule exposição e simule cenários. Gestão de risco feita para mercados de predição.', color: theme.purple, gradient: `linear-gradient(135deg, ${theme.purple}, #a78bfa)` },
    { icon: <Globe size={24} />, title: 'Sentimento de Notícias', desc: 'Análise NLP do Google News para cada mercado. Score de sentimento em tempo real para informar suas decisões.', color: theme.cyan, gradient: `linear-gradient(135deg, ${theme.cyan}, #22d3ee)`, free: true },
  ];

  const stats = [
    { value: '$33B+', label: 'Volume Polymarket 2025', color: theme.accent, icon: <LineChart size={18} /> },
    { value: '500+', label: 'Mercados monitorados', color: theme.green, icon: <Eye size={18} /> },
    { value: '3', label: 'Modelos DL rodando', color: theme.purple, icon: <Brain size={18} /> },
    { value: '<1s', label: 'Latência dos sinais', color: theme.yellow, icon: <Zap size={18} /> },
  ];

  const plans = [
    { name: 'Grátis', price: 'R$0', period: 'para sempre', color: theme.textSecondary, icon: <Star size={20} />,
      features: ['Scanner de mercados', '3 prévias de sinais/dia', '5 posições no portfólio', 'Sentimento básico'] },
    { name: 'Pro', price: '$29', period: '/mês', color: theme.accent, icon: <Zap size={20} />, popular: true,
      features: ['Sinais de IA ilimitados', 'Scanner de arbitragem', 'Sentimento + artigos completos', '50 posições', 'Análise de cenários', 'Alertas por email'] },
    { name: 'Quant', price: '$79', period: '/mês', color: theme.yellow, icon: <Crown size={20} />,
      features: ['Tudo do Pro', 'Alertas de Smart Money', 'Acesso à API', '500 posições', 'Simulações Monte Carlo', 'Suporte prioritário'] },
  ];

  const steps = [
    { num: '01', title: 'Crie sua conta grátis', desc: 'Sem cartão de crédito. Acesso instantâneo ao scanner de mercados.', icon: <Star size={20} /> },
    { num: '02', title: 'Explore os mercados', desc: 'Veja 500+ mercados de Polymarket e Kalshi em tempo real.', icon: <Eye size={20} /> },
    { num: '03', title: 'Receba sinais de IA', desc: 'Nossos modelos encontram mercados com preço errado automaticamente.', icon: <Target size={20} /> },
    { num: '04', title: 'Opere com vantagem', desc: 'Use edge detection, arbitragem e gestão de risco para lucrar.', icon: <Sparkles size={20} /> },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem', position: 'relative' }}>

      {/* ═══ Animated background orbs ═══ */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', width: 600, height: 600, borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.accent}08 0%, transparent 70%)`,
          top: '-10%', left: '-10%',
          transform: `translate(${mousePos.x * 30}px, ${mousePos.y * 30}px)`,
          animation: 'orbMove 20s ease-in-out infinite',
          transition: 'transform 0.3s ease-out',
        }} />
        <div style={{
          position: 'absolute', width: 500, height: 500, borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.purple}06 0%, transparent 70%)`,
          bottom: '10%', right: '-5%',
          transform: `translate(${-mousePos.x * 20}px, ${-mousePos.y * 20}px)`,
          animation: 'orbMove2 25s ease-in-out infinite',
          transition: 'transform 0.3s ease-out',
        }} />
        <div style={{
          position: 'absolute', width: 300, height: 300, borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.cyan}05 0%, transparent 70%)`,
          top: '50%', left: '50%',
          animation: 'orbMove 18s ease-in-out infinite reverse',
        }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ═══ HERO ═══ */}
        <section style={{ textAlign: 'center', padding: '6rem 0 5rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 24,
            background: `linear-gradient(135deg, ${theme.accentBg}, ${theme.purpleBg})`,
            border: `1px solid ${theme.accentBorder}`, marginBottom: '2rem',
            animation: 'fadeIn 0.6s ease, borderGlow 3s ease-in-out infinite',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: theme.green,
              boxShadow: `0 0 8px ${theme.green}60`,
              animation: 'pulse 2s infinite',
            }} />
            <span style={{ fontSize: '0.75rem', color: theme.accent, fontWeight: 600, letterSpacing: '0.02em' }}>
              Ao vivo — monitorando 500+ mercados em tempo real
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(2.4rem, 7vw, 4rem)', fontWeight: 800, lineHeight: 1.05,
            letterSpacing: '-0.04em', marginBottom: '1.5rem',
            animation: 'fadeIn 0.8s ease 0.1s both',
          }}>
            <span style={{
              background: `linear-gradient(135deg, ${theme.text} 0%, ${theme.accent} 40%, ${theme.purple} 70%, ${theme.cyan} 100%)`,
              backgroundSize: '300% 300%',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              animation: 'gradientShift 6s ease infinite',
            }}>
              Encontre sua vantagem
            </span>
            <br />
            <span style={{ color: theme.text }}>em mercados de predição</span>
          </h1>

          <p style={{
            fontSize: 'clamp(1rem, 2.2vw, 1.2rem)', color: theme.textSecondary, maxWidth: 620,
            margin: '0 auto 2.5rem', lineHeight: 1.75,
            animation: 'fadeIn 0.8s ease 0.3s both',
          }}>
            Modelos de deep learning analisam Polymarket e Kalshi em tempo real
            para encontrar mercados com preço errado, detectar smart money e
            gerenciar o risco do seu portfólio.
          </p>

          <div style={{
            display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap',
            animation: 'fadeIn 0.8s ease 0.5s both',
          }}>
            <button onClick={onGetStarted} className="landing-btn-primary" style={{
              padding: '0.95rem 2.2rem', borderRadius: 12, border: 'none',
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
              color: '#fff', fontSize: '1.05rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: `0 4px 24px rgba(99,102,241,0.35)`,
              transition: 'all 0.25s ease',
            }}>
              Começar grátis <ArrowRight size={18} />
            </button>
            <button onClick={onGetStarted} className="landing-btn-secondary" style={{
              padding: '0.95rem 2.2rem', borderRadius: 12,
              border: `1px solid ${theme.border}`,
              background: `${theme.card}80`, backdropFilter: 'blur(8px)',
              color: theme.textSecondary, fontSize: '1.05rem', fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}>
              Ver mercados ao vivo
            </button>
          </div>

          <p style={{
            fontSize: '0.75rem', color: theme.textMuted, marginTop: '1.25rem',
            animation: 'fadeIn 0.8s ease 0.7s both',
          }}>
            Sem cartão de crédito · Plano grátis para sempre · Cancele quando quiser
          </p>
        </section>

        {/* ═══ STATS ═══ */}
        <RevealSection>
          <section style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12,
            marginBottom: '6rem',
          }}>
            {stats.map((s, i) => (
              <div key={s.label} className="stat-card" style={{
                padding: '1.5rem', textAlign: 'center',
                background: theme.card, borderRadius: 16,
                border: `1px solid ${theme.border}`,
                transition: 'all 0.3s ease',
                animation: `countUp 0.5s ease ${0.1 * i}s both`,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, margin: '0 auto 12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${s.color}12`, color: s.color,
                }}>{s.icon}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, letterSpacing: '-0.03em' }}>{s.value}</div>
                <div style={{ fontSize: '0.72rem', color: theme.textMuted, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </section>
        </RevealSection>

        {/* ═══ FEATURES ═══ */}
        <RevealSection>
          <section style={{ marginBottom: '6rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <span style={{
                display: 'inline-block', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
                color: theme.accent, textTransform: 'uppercase', marginBottom: 12,
                padding: '4px 12px', borderRadius: 6, background: theme.accentBg,
              }}>PLATAFORMA</span>
              <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, marginBottom: '0.6rem', letterSpacing: '-0.02em' }}>
                Tudo que você precisa para operar melhor
              </h2>
              <p style={{ color: theme.textSecondary, fontSize: '1rem', maxWidth: 500, margin: '0 auto' }}>
                Seis produtos, uma plataforma. Alimentados por deep learning.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {features.map((f, i) => (
                <RevealSection key={f.title} delay={i * 0.08} direction={i % 2 === 0 ? 'left' : 'right'}>
                  <div className="landing-card" style={{
                    padding: '1.75rem', borderRadius: 16,
                    border: `1px solid ${theme.border}`,
                    background: theme.card,
                    transition: 'all 0.35s ease', cursor: 'default',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {/* Subtle gradient line at top */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                      background: f.gradient, opacity: 0.6,
                    }} />
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: '0.85rem' }}>
                      <div className="feature-icon-wrap" style={{
                        width: 44, height: 44, borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${f.color}10`, color: f.color,
                        transition: 'transform 0.3s ease', flexShrink: 0,
                      }}>{f.icon}</div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{f.title}</span>
                          {f.free && <span style={{
                            ...badgeStyle(theme.green, theme.greenBg),
                            animation: 'pulse 3s infinite',
                          }}>GRÁTIS</span>}
                        </div>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: theme.textSecondary, lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
                  </div>
                </RevealSection>
              ))}
            </div>
          </section>
        </RevealSection>

        {/* ═══ HOW IT WORKS ═══ */}
        <RevealSection>
          <section style={{ marginBottom: '6rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <span style={{
                display: 'inline-block', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
                color: theme.green, textTransform: 'uppercase', marginBottom: 12,
                padding: '4px 12px', borderRadius: 6, background: theme.greenBg,
              }}>COMO FUNCIONA</span>
              <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Da conta ao edge em 4 passos
              </h2>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 20, position: 'relative',
            }}>
              {steps.map((s, i) => (
                <RevealSection key={s.num} delay={i * 0.12} direction="scale">
                  <div style={{
                    textAlign: 'center', padding: '2rem 1.25rem',
                    borderRadius: 16, border: `1px solid ${theme.border}`,
                    background: theme.card, position: 'relative',
                    transition: 'all 0.3s ease',
                  }}>
                    <div style={{
                      fontSize: '0.65rem', fontWeight: 800, color: theme.accent,
                      letterSpacing: '0.1em', marginBottom: 16, opacity: 0.6,
                    }}>{s.num}</div>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14, margin: '0 auto 16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: theme.accentBg, color: theme.accent,
                      animation: `float 4s ease-in-out ${i * 0.5}s infinite`,
                    }}>{s.icon}</div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 8 }}>{s.title}</h4>
                    <p style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                </RevealSection>
              ))}
            </div>
          </section>
        </RevealSection>

        {/* ═══ PRICING ═══ */}
        <RevealSection>
          <section style={{ marginBottom: '6rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <span style={{
                display: 'inline-block', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
                color: theme.purple, textTransform: 'uppercase', marginBottom: 12,
                padding: '4px 12px', borderRadius: 6, background: theme.purpleBg,
              }}>PREÇOS</span>
              <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, marginBottom: '0.6rem', letterSpacing: '-0.02em' }}>
                Preços simples e transparentes
              </h2>
              <p style={{ color: theme.textSecondary, fontSize: '1rem' }}>
                Comece grátis. Faça upgrade quando precisar de mais vantagem.
              </p>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 20, maxWidth: 960, margin: '0 auto',
            }}>
              {plans.map((p, i) => (
                <RevealSection key={p.name} delay={i * 0.1} direction="scale">
                  <div className="plan-card" style={{
                    padding: '2rem', borderRadius: 20, position: 'relative',
                    border: `${p.popular ? '2' : '1'}px solid ${p.popular ? p.color : theme.border}`,
                    background: p.popular
                      ? `linear-gradient(180deg, ${theme.card} 0%, ${p.color}06 100%)`
                      : theme.card,
                    boxShadow: p.popular ? `0 0 40px ${p.color}12` : undefined,
                    transition: 'all 0.35s ease',
                  }}>
                    {p.popular && (
                      <div style={{
                        position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                        background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
                        color: '#fff', fontSize: '0.62rem', fontWeight: 700,
                        padding: '4px 16px', borderRadius: 12,
                        boxShadow: `0 4px 12px ${theme.accent}40`,
                      }}>MAIS POPULAR</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${p.color}12`, color: p.color,
                      }}>{p.icon}</div>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{p.name}</span>
                    </div>
                    <div style={{ marginBottom: '1.75rem' }}>
                      <span style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>{p.price}</span>
                      <span style={{ fontSize: '0.9rem', color: theme.textSecondary, marginLeft: 4 }}>{p.period}</span>
                    </div>
                    <div style={{
                      height: 1, background: `linear-gradient(90deg, transparent, ${theme.border}, transparent)`,
                      marginBottom: '1.5rem',
                    }} />
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.75rem' }}>
                      {p.features.map(f => (
                        <li key={f} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '6px 0', fontSize: '0.85rem', color: theme.textSecondary,
                        }}>
                          <Check size={15} color={p.color} style={{ flexShrink: 0 }} /> {f}
                        </li>
                      ))}
                    </ul>
                    <button onClick={onGetStarted} className={p.popular ? 'landing-btn-primary' : 'landing-btn-secondary'} style={{
                      width: '100%', padding: '0.8rem', borderRadius: 10, cursor: 'pointer',
                      fontSize: '0.9rem', fontWeight: 600, transition: 'all 0.25s ease',
                      ...(p.popular ? {
                        border: 'none',
                        background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
                        color: '#fff',
                        boxShadow: `0 4px 20px ${theme.accent}30`,
                      } : {
                        border: `1px solid ${theme.border}`,
                        background: 'transparent',
                        color: theme.textSecondary,
                      }),
                    }}>{p.name === 'Grátis' ? 'Começar grátis' : `Assinar ${p.name}`}</button>
                  </div>
                </RevealSection>
              ))}
            </div>
          </section>
        </RevealSection>

        {/* ═══ FINAL CTA ═══ */}
        <RevealSection direction="scale">
          <section style={{
            textAlign: 'center', padding: '4rem 2.5rem', marginBottom: '4rem',
            borderRadius: 24, position: 'relative', overflow: 'hidden',
            border: `1px solid ${theme.accentBorder}`,
          }}>
            {/* Animated gradient background */}
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(135deg, ${theme.accent}10, ${theme.purple}10, ${theme.cyan}08, ${theme.accent}10)`,
              backgroundSize: '400% 400%',
              animation: 'gradientShift 8s ease infinite',
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: '0 auto 1.5rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: theme.accentBg, color: theme.accent,
                animation: 'float 3s ease-in-out infinite',
              }}><Sparkles size={28} /></div>
              <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.8rem)', fontWeight: 800, marginBottom: '0.85rem', letterSpacing: '-0.02em' }}>
                Pronto para encontrar sua vantagem?
              </h2>
              <p style={{ color: theme.textSecondary, marginBottom: '2rem', fontSize: '1rem', maxWidth: 480, margin: '0 auto 2rem' }}>
                Junte-se a traders usando IA para fazer predições mais inteligentes.
              </p>
              <button onClick={onGetStarted} className="landing-btn-primary" style={{
                padding: '1rem 2.5rem', borderRadius: 12, border: 'none',
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
                color: '#fff', fontSize: '1.05rem', fontWeight: 600, cursor: 'pointer',
                boxShadow: `0 4px 24px ${theme.accent}35`,
                display: 'inline-flex', alignItems: 'center', gap: 10,
                transition: 'all 0.25s ease',
              }}>
                Começar grátis <ArrowRight size={18} />
              </button>
            </div>
          </section>
        </RevealSection>

        {/* ═══ FOOTER ═══ */}
        <footer style={{
          textAlign: 'center', padding: '2.5rem 0',
          borderTop: `1px solid ${theme.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            <TrendingUp size={18} color={theme.accent} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Qyntara</span>
          </div>
          <p style={{ fontSize: '0.72rem', color: theme.textMuted }}>
            © 2026 Qyntara · Inteligência para mercados de predição com deep learning
          </p>
        </footer>

      </div>
    </div>
  );
};
