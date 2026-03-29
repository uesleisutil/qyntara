import React from 'react';
import { theme, badgeStyle } from '../styles';
import {
  TrendingUp, Zap, GitCompare, Brain, Shield, BarChart3,
  ArrowRight, Check, Globe, Briefcase, Bell, ChevronRight,
  Activity, Eye, Lock, Star, Crown, Layers,
} from 'lucide-react';

interface Props { onGetStarted: () => void; }

export const LandingPage: React.FC<Props> = ({ onGetStarted }) => {
  const features = [
    { icon: <BarChart3 size={22} />, title: 'Market Scanner', desc: 'Real-time aggregation of Polymarket + Kalshi markets. Filter, search, sort by volume — all in one view.', color: theme.blue, free: true },
    { icon: <Brain size={22} />, title: 'AI Edge Finder', desc: 'Transformer model estimates true probability and finds where markets are mispriced. Get signals before the crowd.', color: theme.accent },
    { icon: <GitCompare size={22} />, title: 'Arbitrage Engine', desc: 'Detects same event priced differently across platforms. Instant alerts when spread > 3%.', color: theme.green },
    { icon: <Activity size={22} />, title: 'Smart Money Alerts', desc: 'Autoencoder detects unusual volume spikes — know when smart money is entering a market.', color: theme.yellow },
    { icon: <Briefcase size={22} />, title: 'Portfolio & Risk', desc: 'Track positions, calculate exposure, simulate scenarios. Risk management built for prediction markets.', color: theme.purple },
    { icon: <Globe size={22} />, title: 'News Sentiment', desc: 'NLP analysis of Google News for every market. Real-time sentiment scoring to inform your trades.', color: theme.cyan, free: true },
  ];

  const stats = [
    { value: '$33B+', label: 'Polymarket 2025 volume', color: theme.accent },
    { value: '500+', label: 'Markets tracked', color: theme.green },
    { value: '3', label: 'DL models running', color: theme.purple },
    { value: '<1s', label: 'Signal latency', color: theme.yellow },
  ];

  const plans = [
    { name: 'Free', price: '$0', period: 'forever', color: theme.textSecondary, icon: <Star size={18} />,
      features: ['Market Scanner', '3 signal previews/day', '5 portfolio positions', 'Basic sentiment'] },
    { name: 'Pro', price: '$29', period: '/mo', color: theme.accent, icon: <Zap size={18} />, popular: true,
      features: ['Unlimited AI Signals', 'Arbitrage Scanner', 'Full sentiment + articles', '50 positions', 'Scenario analysis', 'Email alerts'] },
    { name: 'Quant', price: '$79', period: '/mo', color: theme.yellow, icon: <Crown size={18} />,
      features: ['Everything in Pro', 'Smart Money Alerts', 'API access', '500 positions', 'Monte Carlo sims', 'Priority support'] },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>
      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '5rem 0 4rem', animation: 'fadeIn 0.6s ease' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
          background: theme.accentBg, border: `1px solid ${theme.accentBorder}`, marginBottom: '1.5rem' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.green, animation: 'glow 2s infinite' }} />
          <span style={{ fontSize: '0.72rem', color: theme.accent, fontWeight: 600 }}>Live — tracking 500+ markets</span>
        </div>

        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.2rem)', fontWeight: 800, lineHeight: 1.1,
          letterSpacing: '-0.03em', marginBottom: '1.25rem',
          background: `linear-gradient(135deg, ${theme.text} 0%, ${theme.accent} 50%, ${theme.purple} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Find your edge in<br />prediction markets
        </h1>

        <p style={{ fontSize: 'clamp(0.95rem, 2vw, 1.15rem)', color: theme.textSecondary, maxWidth: 560,
          margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
          Deep learning models analyze Polymarket and Kalshi in real-time to find mispriced markets, detect smart money, and manage your portfolio risk.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onGetStarted} style={{
            padding: '0.85rem 2rem', borderRadius: 10, border: 'none',
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
            color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: `0 4px 20px rgba(99,102,241,0.3)`,
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(99,102,241,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.3)'; }}>
            Get started free <ArrowRight size={18} />
          </button>
          <button onClick={onGetStarted} style={{
            padding: '0.85rem 2rem', borderRadius: 10,
            border: `1px solid ${theme.border}`, background: 'transparent',
            color: theme.textSecondary, fontSize: '1rem', fontWeight: 500, cursor: 'pointer',
          }}>
            View markets
          </button>
        </div>

        <p style={{ fontSize: '0.72rem', color: theme.textMuted, marginTop: '1rem' }}>
          No credit card required · Free tier forever · Cancel anytime
        </p>
      </section>

      {/* Stats bar */}
      <section style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
        borderRadius: 14, overflow: 'hidden', marginBottom: '5rem',
        border: `1px solid ${theme.border}`, animation: 'slideUp 0.6s ease 0.2s both',
      }}>
        {stats.map(s => (
          <div key={s.label} style={{ padding: '1.5rem', textAlign: 'center', background: theme.card }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: theme.textMuted, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* Features */}
      <section style={{ marginBottom: '5rem', animation: 'slideUp 0.6s ease 0.3s both' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>Everything you need to trade smarter</h2>
          <p style={{ color: theme.textSecondary, fontSize: '0.92rem' }}>Six products, one platform. Powered by deep learning.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          {features.map(f => (
            <div key={f.title} style={{
              padding: '1.5rem', borderRadius: 14, border: `1px solid ${theme.border}`,
              background: theme.card, transition: 'all 0.2s',
              cursor: 'default',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${f.color}40`; e.currentTarget.style.background = theme.cardHover; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.background = theme.card; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${f.color}12`, color: f.color,
                }}>{f.icon}</div>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{f.title}</span>
                {f.free && <span style={badgeStyle(theme.green, theme.greenBg)}>FREE</span>}
              </div>
              <p style={{ fontSize: '0.82rem', color: theme.textSecondary, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ marginBottom: '5rem', animation: 'slideUp 0.6s ease 0.4s both' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>Simple, transparent pricing</h2>
          <p style={{ color: theme.textSecondary, fontSize: '0.92rem' }}>Start free. Upgrade when you need more edge.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
          {plans.map(p => (
            <div key={p.name} style={{
              padding: '1.75rem', borderRadius: 14, position: 'relative',
              border: `${p.popular ? '2' : '1'}px solid ${p.popular ? p.color : theme.border}`,
              background: theme.card,
              boxShadow: p.popular ? `0 0 30px ${p.color}10` : undefined,
            }}>
              {p.popular && (
                <div style={{
                  position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
                  color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '3px 14px', borderRadius: 10,
                }}>MOST POPULAR</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                <span style={{ color: p.color }}>{p.icon}</span>
                <span style={{ fontWeight: 700 }}>{p.name}</span>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{p.price}</span>
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
              }}>
                {p.name === 'Free' ? 'Get started' : `Start ${p.name}`}
              </button>
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
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem' }}>Ready to find your edge?</h2>
        <p style={{ color: theme.textSecondary, marginBottom: '1.5rem', fontSize: '0.92rem' }}>
          Join traders using AI to make smarter predictions.
        </p>
        <button onClick={onGetStarted} style={{
          padding: '0.85rem 2.5rem', borderRadius: 10, border: 'none',
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
          color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
          boxShadow: `0 4px 20px rgba(99,102,241,0.3)`,
        }}>
          Start for free <ArrowRight size={16} style={{ marginLeft: 6 }} />
        </button>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '2rem 0', borderTop: `1px solid ${theme.border}` }}>
        <p style={{ fontSize: '0.72rem', color: theme.textMuted }}>
          © 2026 Predikt by Qyntara · Prediction market intelligence powered by deep learning
        </p>
      </footer>
    </div>
  );
};
