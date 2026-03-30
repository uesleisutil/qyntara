import React, { useEffect, useRef, useState } from 'react';
import { theme } from '../styles';
import {
  ArrowRight, Check, Zap, Crown, Star,
  BarChart3, Brain, GitCompare, Activity, Briefcase, Globe,
} from 'lucide-react';

interface Props { onGetStarted: () => void; }

/* ── Reveal on scroll ── */
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, vis };
}
const Reveal: React.FC<{ children: React.ReactNode; delay?: number; style?: React.CSSProperties }> = ({ children, delay = 0, style }) => {
  const { ref, vis } = useReveal();
  return <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(32px)', transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s`, ...style }}>{children}</div>;
};

/* ── Ticker ── */
const Ticker: React.FC = () => {
  const items = ['Polymarket', 'Kalshi', 'Edge Detection', 'Arbitragem', 'Smart Money', 'Sentimento', 'Deep Learning', 'Portfólio'];
  return (
    <div style={{ overflow: 'hidden', padding: '1rem 0', borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, margin: '4rem 0' }}>
      <div style={{ display: 'flex', gap: 48, animation: 'tickerScroll 25s linear infinite', width: 'max-content' }}>
        {[...items, ...items].map((t, i) => (
          <span key={i} style={{ fontSize: '0.82rem', color: theme.textMuted, fontWeight: 500, whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {t} <span style={{ color: theme.accent, margin: '0 8px' }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
};

export const LandingPage: React.FC<Props> = ({ onGetStarted }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => { n += 7; if (n >= 500) { setCount(500); clearInterval(id); } else setCount(n); }, 20);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>

      {/* ── Grain texture overlay ── */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      {/* ── Accent glow ── */}
      <div style={{
        position: 'absolute', top: -200, right: -200, width: 600, height: 600,
        background: `radial-gradient(circle, ${theme.accent}0a 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 clamp(1.25rem, 4vw, 2rem)', position: 'relative', zIndex: 1 }}>

        {/* ═══════════ HERO ═══════════ */}
        <section style={{ padding: 'clamp(4rem, 10vw, 8rem) 0 3rem' }}>
          {/* Eyebrow */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 14px', borderRadius: 100, marginBottom: '1.5rem',
            border: `1px solid ${theme.border}`, background: theme.card,
            animation: 'fadeIn 0.6s ease',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.green, boxShadow: `0 0 8px ${theme.green}` }} />
            <span style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 500 }}>
              {count}+ mercados ao vivo agora
            </span>
          </div>

          {/* Headline — asymmetric, not centered */}
          <h1 style={{
            fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', fontWeight: 800, lineHeight: 0.95,
            letterSpacing: '-0.05em', marginBottom: '1.75rem', maxWidth: 700,
            animation: 'fadeIn 0.8s ease 0.15s both',
          }}>
            <span style={{ color: theme.text }}>Sua vantagem</span>
            <br />
            <span style={{ color: theme.text }}>em mercados</span>
            <br />
            <span style={{
              background: `linear-gradient(90deg, ${theme.accent}, ${theme.purple})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>de predição.</span>
          </h1>

          {/* Subheadline */}
          <p style={{
            fontSize: 'clamp(0.95rem, 2vw, 1.15rem)', color: theme.textSecondary,
            maxWidth: 480, lineHeight: 1.7, marginBottom: '2.5rem',
            animation: 'fadeIn 0.8s ease 0.3s both',
          }}>
            IA analisa Polymarket e Kalshi pra encontrar odds erradas,
            detectar dinheiro inteligente e gerenciar seu risco.
          </p>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', animation: 'fadeIn 0.8s ease 0.45s both' }}>
            <button onClick={onGetStarted} style={{
              padding: '0.85rem 1.75rem', borderRadius: 10, border: 'none',
              background: theme.text, color: theme.bg,
              fontSize: '0.92rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = theme.accent; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = theme.text; e.currentTarget.style.color = theme.bg; }}>
              Começar grátis <ArrowRight size={16} />
            </button>
            <button onClick={onGetStarted} style={{
              padding: '0.85rem 1.75rem', borderRadius: 10,
              border: `1px solid ${theme.border}`, background: 'transparent',
              color: theme.textSecondary, fontSize: '0.92rem', fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = theme.textMuted}
            onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
              Ver mercados
            </button>
          </div>

          <p style={{ fontSize: '0.68rem', color: theme.textMuted, marginTop: '1rem', animation: 'fadeIn 0.8s ease 0.6s both' }}>
            Sem cartão · Grátis pra sempre · Cancele quando quiser
          </p>
        </section>

        <Ticker />

        {/* ═══════════ WHAT WE DO — bento grid ═══════════ */}
        <Reveal>
          <section style={{ marginBottom: '6rem' }}>
            <div style={{ marginBottom: '2.5rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, color: theme.accent, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>O que fazemos</p>
              <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, letterSpacing: '-0.03em', maxWidth: 500 }}>
                Seis ferramentas.<br />Uma plataforma.
              </h2>
            </div>

            {/* Bento grid — asymmetric */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'auto auto', gap: 12 }}>
              {/* Big card — scanner */}
              <Reveal delay={0.05} style={{ gridColumn: '1 / 3', gridRow: '1' }}>
                <div style={{ padding: '2rem', borderRadius: 16, border: `1px solid ${theme.border}`, background: theme.card, height: '100%', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${theme.blue}, ${theme.cyan})` }} />
                  <BarChart3 size={28} color={theme.blue} style={{ marginBottom: 16 }} />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>Scanner de Mercados</h3>
                  <p style={{ fontSize: '0.85rem', color: theme.textSecondary, lineHeight: 1.7, maxWidth: 400 }}>
                    Polymarket + Kalshi agregados em tempo real. Filtre por categoria, volume, preço. Tudo numa tela.
                  </p>
                  <span style={{ display: 'inline-block', marginTop: 12, fontSize: '0.62rem', fontWeight: 700, color: theme.green, background: `${theme.green}12`, padding: '3px 10px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grátis</span>
                </div>
              </Reveal>

              {/* Edge detection */}
              <Reveal delay={0.1} style={{ gridColumn: '3', gridRow: '1 / 3' }}>
                <div style={{ padding: '2rem', borderRadius: 16, border: `1px solid ${theme.border}`, background: theme.card, height: '100%', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${theme.accent}, ${theme.purple})` }} />
                  <Brain size={28} color={theme.accent} style={{ marginBottom: 16 }} />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>Edge Detection</h3>
                  <p style={{ fontSize: '0.85rem', color: theme.textSecondary, lineHeight: 1.7 }}>
                    Transformer estima a probabilidade real e compara com o preço de mercado. Quando diverge, você tem edge.
                  </p>
                  <div style={{ marginTop: 24, padding: '1rem', borderRadius: 10, background: theme.bg, border: `1px solid ${theme.border}` }}>
                    <div style={{ fontSize: '0.65rem', color: theme.textMuted, marginBottom: 6 }}>Exemplo de sinal</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Trump vence 2028?</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: theme.green }}>YES ↑</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: theme.textMuted, marginTop: 4 }}>
                      <span>Mercado: 32¢</span>
                      <span>IA estima: 41¢</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: theme.border, marginTop: 8, overflow: 'hidden' }}>
                      <div style={{ width: '78%', height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${theme.green}80, ${theme.green})` }} />
                    </div>
                    <div style={{ fontSize: '0.6rem', color: theme.green, marginTop: 4, fontWeight: 600 }}>Score: 78</div>
                  </div>
                </div>
              </Reveal>

              {/* Bottom row — 2 cards */}
              <Reveal delay={0.15}>
                <div style={{ padding: '1.5rem', borderRadius: 16, border: `1px solid ${theme.border}`, background: theme.card, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${theme.green}, #34d399)` }} />
                  <GitCompare size={22} color={theme.green} style={{ marginBottom: 12 }} />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 6 }}>Arbitragem</h3>
                  <p style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>Mesmo evento, preços diferentes entre plataformas.</p>
                </div>
              </Reveal>
              <Reveal delay={0.2}>
                <div style={{ padding: '1.5rem', borderRadius: 16, border: `1px solid ${theme.border}`, background: theme.card, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${theme.yellow}, #fbbf24)` }} />
                  <Activity size={22} color={theme.yellow} style={{ marginBottom: 12 }} />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 6 }}>Smart Money</h3>
                  <p style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>Detecta quando dinheiro inteligente entra no mercado.</p>
                </div>
              </Reveal>
            </div>

            {/* Extra row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <Reveal delay={0.25}>
                <div style={{ padding: '1.5rem', borderRadius: 16, border: `1px solid ${theme.border}`, background: theme.card, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${theme.purple}, #a78bfa)` }} />
                  <Briefcase size={22} color={theme.purple} style={{ marginBottom: 12 }} />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 6 }}>Portfólio & Risco</h3>
                  <p style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>Posições, exposição, cenários. Gestão de risco real.</p>
                </div>
              </Reveal>
              <Reveal delay={0.3}>
                <div style={{ padding: '1.5rem', borderRadius: 16, border: `1px solid ${theme.border}`, background: theme.card, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${theme.cyan}, #22d3ee)` }} />
                  <Globe size={22} color={theme.cyan} style={{ marginBottom: 12 }} />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 6 }}>Sentimento</h3>
                  <p style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>NLP analisa notícias pra cada mercado em tempo real.</p>
                  <span style={{ display: 'inline-block', marginTop: 8, fontSize: '0.62rem', fontWeight: 700, color: theme.green, background: `${theme.green}12`, padding: '3px 10px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grátis</span>
                </div>
              </Reveal>
            </div>
          </section>
        </Reveal>

        {/* ═══════════ NUMBERS ═══════════ */}
        <Reveal>
          <section style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
            borderRadius: 16, overflow: 'hidden', marginBottom: '6rem',
            border: `1px solid ${theme.border}`,
          }}>
            {[
              { n: '$33B+', l: 'Volume Polymarket 2025' },
              { n: '500+', l: 'Mercados monitorados' },
              { n: '3', l: 'Modelos de deep learning' },
              { n: '<1s', l: 'Latência dos sinais' },
            ].map((s, i) => (
              <Reveal key={s.l} delay={i * 0.08}>
                <div style={{
                  padding: 'clamp(1rem, 3vw, 1.75rem)', textAlign: 'center',
                  background: theme.card,
                }}>
                  <div style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, letterSpacing: '-0.03em', color: theme.text }}>{s.n}</div>
                  <div style={{ fontSize: '0.68rem', color: theme.textMuted, marginTop: 4 }}>{s.l}</div>
                </div>
              </Reveal>
            ))}
          </section>
        </Reveal>

        {/* ═══════════ PRICING ═══════════ */}
        <Reveal>
          <section style={{ marginBottom: '6rem' }}>
            <div style={{ marginBottom: '2.5rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, color: theme.purple, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Preços</p>
              <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, letterSpacing: '-0.03em', maxWidth: 400 }}>
                Simples.<br />Transparente.
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, maxWidth: 900 }}>
              {[
                { name: 'Grátis', price: 'R$0', period: '/sempre', color: theme.textMuted, icon: <Star size={18} />,
                  items: ['Scanner de mercados', '3 sinais/dia', '5 posições', 'Sentimento básico'] },
                { name: 'Pro', price: '$29', period: '/mês', color: theme.accent, icon: <Zap size={18} />, pop: true,
                  items: ['Sinais ilimitados', 'Arbitragem', 'Sentimento completo', '50 posições', 'Cenários', 'Alertas email'] },
                { name: 'Quant', price: '$79', period: '/mês', color: theme.yellow, icon: <Crown size={18} />,
                  items: ['Tudo do Pro', 'Smart Money', 'API', '500 posições', 'Monte Carlo', 'Suporte prioritário'] },
              ].map((p, i) => (
                <Reveal key={p.name} delay={i * 0.1}>
                  <div style={{
                    padding: '1.75rem', borderRadius: 16, position: 'relative',
                    border: `1px solid ${p.pop ? p.color : theme.border}`,
                    background: theme.card,
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 16px 48px rgba(0,0,0,0.2)`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                    {p.pop && (
                      <div style={{
                        position: 'absolute', top: -10, left: 16,
                        background: p.color, color: '#fff', fontSize: '0.58rem', fontWeight: 700,
                        padding: '3px 10px', borderRadius: 6, letterSpacing: '0.05em',
                      }}>POPULAR</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
                      <span style={{ color: p.color }}>{p.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: '1rem' }}>{p.name}</span>
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <span style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>{p.price}</span>
                      <span style={{ fontSize: '0.82rem', color: theme.textMuted }}>{p.period}</span>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem' }}>
                      {p.items.map(f => (
                        <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: '0.8rem', color: theme.textSecondary }}>
                          <Check size={14} color={p.color} style={{ flexShrink: 0 }} /> {f}
                        </li>
                      ))}
                    </ul>
                    <button onClick={onGetStarted} style={{
                      width: '100%', padding: '0.7rem', borderRadius: 8, cursor: 'pointer',
                      fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s',
                      border: p.pop ? 'none' : `1px solid ${theme.border}`,
                      background: p.pop ? p.color : 'transparent',
                      color: p.pop ? '#fff' : theme.textSecondary,
                    }}>{p.name === 'Grátis' ? 'Começar' : `Assinar ${p.name}`}</button>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ═══════════ FINAL CTA ═══════════ */}
        <Reveal>
          <section style={{
            padding: 'clamp(3rem, 6vw, 5rem) 0', marginBottom: '3rem',
            textAlign: 'center',
          }}>
            <h2 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '1rem' }}>
              Pare de adivinhar.
            </h2>
            <p style={{ fontSize: '1rem', color: theme.textSecondary, maxWidth: 400, margin: '0 auto 2rem', lineHeight: 1.7 }}>
              Deixa a IA encontrar as oportunidades. Você decide quando agir.
            </p>
            <button onClick={onGetStarted} style={{
              padding: '1rem 2.5rem', borderRadius: 10, border: 'none',
              background: theme.text, color: theme.bg,
              fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 10,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = theme.accent; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = theme.text; e.currentTarget.style.color = theme.bg; }}>
              Começar grátis <ArrowRight size={16} />
            </button>
          </section>
        </Reveal>

        {/* ═══════════ FOOTER ═══════════ */}
        <footer style={{
          padding: '2rem 0', borderTop: `1px solid ${theme.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Qyntara</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/termos" onClick={e => { e.preventDefault(); window.location.hash = 'terms'; }} style={{ fontSize: '0.62rem', color: theme.textMuted, textDecoration: 'none' }}>Termos de Uso</a>
            <a href="/privacidade" onClick={e => { e.preventDefault(); window.location.hash = 'privacy'; }} style={{ fontSize: '0.62rem', color: theme.textMuted, textDecoration: 'none' }}>Privacidade</a>
            <span style={{ fontSize: '0.62rem', color: theme.textMuted }}>© 2026</span>
          </div>
        </footer>

      </div>
    </div>
  );
};
