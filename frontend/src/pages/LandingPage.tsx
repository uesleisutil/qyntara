import React from 'react';
import { theme, badgeStyle } from '../styles';
import {
  TrendingUp, Zap, GitCompare, Brain, Shield, BarChart3,
  ArrowRight, Check, Globe, Briefcase, Activity, Star, Crown,
} from 'lucide-react';

interface Props { onGetStarted: () => void; }

export const LandingPage: React.FC<Props> = ({ onGetStarted }) => {
  const features = [
    { icon: <BarChart3 size={22} />, title: 'Scanner de Mercados', desc: 'Agregação em tempo real de Polymarket + Kalshi. Filtre, busque e ordene por volume — tudo em uma tela.', color: theme.blue, free: true },
    { icon: <Brain size={22} />, title: 'Detector de Edge com IA', desc: 'Modelo Transformer estima a probabilidade real e encontra mercados com preço errado. Sinais antes da multidão.', color: theme.accent },
    { icon: <GitCompare size={22} />, title: 'Motor de Arbitragem', desc: 'Detecta o mesmo evento com preços diferentes entre plataformas. Alertas instantâneos quando spread > 3%.', color: theme.green },
    { icon: <Activity size={22} />, title: 'Alertas de Smart Money', desc: 'Autoencoder detecta picos incomuns de volume — saiba quando dinheiro inteligente está entrando.', color: theme.yellow },
    { icon: <Briefcase size={22} />, title: 'Portfólio & Risco', desc: 'Acompanhe posições, calcule exposição e simule cenários. Gestão de risco feita para mercados de predição.', color: theme.purple },
    { icon: <Globe size={22} />, title: 'Sentimento de Notícias', desc: 'Análise NLP do Google News para cada mercado. Score de sentimento em tempo real para informar suas decisões.', color: theme.cyan, free: true },
  ];

  const stats = [
    { value: '$33B+', label: 'Volume Polymarket 2025', color: theme.accent },
    { value: '500+', label: 'Mercados monitorados', color: theme.green },
    { value: '3', label: 'Modelos DL rodando', color: theme.purple },
    { value: '<1s', label: 'Latência dos sinais', color: theme.yellow },
  ];

  const plans = [
    { name: 'Grátis', price: 'R$0', period: 'para sempre', color: theme.textSecondary, icon: <Star size={18} />,
      features: ['Scanner de mercados', '3 prévias de sinais/dia', '5 posições no portfólio', 'Sentimento básico'] },
    { name: 'Pro', price: '$29', period: '/mês', color: theme.accent, icon: <Zap size={18} />, popular: true,
      features: ['Sinais de IA ilimitados', 'Scanner de arbitragem', 'Sentimento + artigos completos', '50 posições', 'Análise de cenários', 'Alertas por email'] },
    { name: 'Quant', price: '$79', period: '/mês', color: theme.yellow, icon: <Crown size={18} />,
      features: ['Tudo do Pro', 'Alertas de Smart Money', 'Acesso à API', '500 posições', 'Simulações Monte Carlo', 'Suporte prioritário'] },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>
      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '5rem 0 4rem', animation: 'fadeIn 0.6s ease' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
          background: theme.accentBg, border: `1px solid ${theme.accentBorder}`, marginBottom: '1.5rem' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.green, animation: 'glow 2s infinite' }} />
          <span style={{ fontSize: '0.72rem', color: theme.accent, fontWeight: 600 }}>Ao vivo — monitorando 500+ mercados</span>
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.2rem)', fontWeight: 800, lineHeight: 1.1,
          letterSpacing: '-0.03em', marginBottom: '1.25rem',
          background: `linear-gradient(135deg, ${theme.text} 0%, ${theme.accent} 50%, ${theme.purple} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Encontre sua vantagem em<br />mercados de predição
        </h1>
        <p style={{ fontSize: 'clamp(0.95rem, 2vw, 1.15rem)', color: theme.textSecondary, maxWidth: 580,
          margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
          Modelos de deep learning analisam Polymarket e Kalshi em tempo real para encontrar mercados com preço errado, detectar smart money e gerenciar o risco do seu portfólio.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onGetStarted} style={{
            padding: '0.85rem 2rem', borderRadius: 10, border: 'none',
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
            color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
          }}>Começar grátis <ArrowRight size={18} /></button>
          <button onClick={onGetStarted} style={{
            padding: '0.85rem 2rem', borderRadius: 10, border: `1px solid ${theme.border}`,
            background: 'transparent', color: theme.textSecondary, fontSize: '1rem', fontWeight: 500, cursor: 'pointer',
          }}>Ver mercados</button>
        </div>
        <p style={{ fontSize: '0.72rem', color: theme.textMuted, marginTop: '1rem' }}>
          Sem cartão de crédito · Plano grátis para sempre · Cancele quando quiser
        </p>
      </section>

      {/* Stats */}
      <section style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
        borderRadius: 14, overflow: 'hidden', marginBottom: '5rem',
        border: `1px solid ${theme.border}`, animation: 'slideUp 0.6s ease 0.2s both',
      }}>
        {stats.map(s => (
          <div key={s.label} style={{ padding: '1.5rem', textAlign: 'center', background: theme.card }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: theme.textMuted, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* Features */}
      <section style={{ marginBottom: '5rem', animation: 'slideUp 0.6s ease 0.3s both' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>Tudo que você precisa para operar melhor</h2>
          <p style={{ color: theme.textSecondary, fontSize: '0.92rem' }}>Seis produtos, uma plataforma. Alimentados por deep learning.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          {features.map(f => (
            <div key={f.title} style={{
              padding: '1.5rem', borderRadius: 14, border: `1px solid ${theme.border}`,
              background: theme.card, transition: 'all 0.2s', cursor: 'default',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${f.color}12`, color: f.color,
                }}>{f.icon}</div>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{f.title}</span>
                {f.free && <span style={badgeStyle(theme.green, theme.greenBg)}>GRÁTIS</span>}
              </div>
              <p style={{ fontSize: '0.82rem', color: theme.textSecondary, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ marginBottom: '5rem', animation: 'slideUp 0.6s ease 0.4s both' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>Preços simples e transparentes</h2>
          <p style={{ color: theme.textSecondary, fontSize: '0.92rem' }}>Comece grátis. Faça upgrade quando precisar de mais vantagem.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
          {plans.map(p => (
            <div key={p.name} style={{
              padding: '1.75rem', borderRadius: 14, position: 'relative',
              border: `${p.popular ? '2' : '1'}px solid ${p.popular ? p.color : theme.border}`,
              background: theme.card, boxShadow: p.popular ? `0 0 30px ${p.color}10` : undefined,
            }}>
              {p.popular && (
                <div style={{
                  position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
                  color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '3px 14px', borderRadius: 10,
                }}>MAIS POPULAR</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                <span style={{ color: p.color }}>{p.icon}</span>
                <span style={{ fontWeight: 700 }}>{p.name}</span>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 800 }}>{p.price}</span>
                <span style={{ fontSize: '0.85rem', color: theme.textSecondary }}>{p.period}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem' }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: '0.8rem', color: theme.textSecondary }}>
                    <Check size={14} color={p.color} style={{ flexShrink: 0 }} /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={onGetStarted} style={{
                width: '100%', padding: '0.7rem', borderRadius: 8, border: 'none',
                background: p.popular ? `linear-gradient(135deg, ${theme.accent}, ${theme.purple})` : 'transparent',
                borderWidth: p.popular ? 0 : 1, borderStyle: 'solid', borderColor: theme.border,
                color: p.popular ? '#fff' : theme.textSecondary, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              }}>{p.name === 'Grátis' ? 'Começar' : `Assinar ${p.name}`}</button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        textAlign: 'center', padding: '3rem 2rem', marginBottom: '3rem',
        borderRadius: 16, border: `1px solid ${theme.accentBorder}`,
        background: `linear-gradient(135deg, ${theme.accentBg}, ${theme.purpleBg})`,
      }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem' }}>Pronto para encontrar sua vantagem?</h2>
        <p style={{ color: theme.textSecondary, marginBottom: '1.5rem', fontSize: '0.92rem' }}>
          Junte-se a traders usando IA para fazer predições mais inteligentes.
        </p>
        <button onClick={onGetStarted} style={{
          padding: '0.85rem 2.5rem', borderRadius: 10, border: 'none',
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
          color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
        }}>Começar grátis <ArrowRight size={16} style={{ marginLeft: 6 }} /></button>
      </section>

      <footer style={{ textAlign: 'center', padding: '2rem 0', borderTop: `1px solid ${theme.border}` }}>
        <p style={{ fontSize: '0.72rem', color: theme.textMuted }}>
          © 2026 Predikt por Qyntara · Inteligência para mercados de predição com deep learning
        </p>
      </footer>
    </div>
  );
};
