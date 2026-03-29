import React from 'react';
import {
  TrendingUp, Zap, GitCompare, Brain, Shield, BarChart3,
  ArrowRight, Check, Globe, Clock, Lock,
} from 'lucide-react';

interface Props { dark: boolean; onGetStarted: () => void; }

export const LandingPage: React.FC<Props> = ({ dark, onGetStarted }) => {
  const accent = '#6366f1';
  const textSec = '#8892a4';
  const border = '#1e2130';

  const features = [
    { icon: <BarChart3 size={24} />, title: 'Market Scanner', desc: 'Real-time aggregation of Polymarket + Kalshi. Filter, search, sort by volume.', free: true },
    { icon: <Brain size={24} />, title: 'AI Edge Finder', desc: 'Deep learning model estimates true probability and finds mispriced markets.', free: false },
    { icon: <GitCompare size={24} />, title: 'Arbitrage Engine', desc: 'Detects same event priced differently across platforms. Instant alerts.', free: false },
    { icon: <Zap size={24} />, title: 'Smart Money Alerts', desc: 'Autoencoder detects unusual volume spikes — smart money entering.', free: false },
    { icon: <Shield size={24} />, title: 'Portfolio & Risk', desc: 'Track positions, calculate risk, simulate scenarios. All in one place.', free: false },
    { icon: <Globe size={24} />, title: 'News Sentiment', desc: 'NLP analysis of Google News for every market. Sentiment score in real-time.', free: true },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 1.5rem' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: '1.5rem' }}>
          <TrendingUp size={36} color={accent} />
          <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Predikt</span>
        </div>
        <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.2rem)', fontWeight: 700, lineHeight: 1.2, marginBottom: '1rem' }}>
          AI-powered intelligence for<br />prediction markets
        </h1>
        <p style={{ fontSize: '1rem', color: textSec, maxWidth: 500, margin: '0 auto 2rem', lineHeight: 1.6 }}>
          Find mispriced markets, detect smart money, and track your portfolio across Polymarket and Kalshi — all powered by deep learning.
        </p>
        <button onClick={onGetStarted} style={{
          padding: '0.8rem 2rem', borderRadius: 10, border: 'none',
          background: accent, color: '#fff', fontSize: '1rem', fontWeight: 600,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          Get started free <ArrowRight size={18} />
        </button>
        <p style={{ fontSize: '0.75rem', color: textSec, marginTop: '0.75rem' }}>
          No credit card required · Free tier forever
        </p>
      </div>

      {/* Features grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: '4rem' }}>
        {features.map(f => (
          <div key={f.title} style={{
            padding: '1.25rem', borderRadius: 12, border: `1px solid ${border}`,
            background: dark ? '#12141c' : '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
              <span style={{ color: accent }}>{f.icon}</span>
              <span style={{ fontWeight: 600 }}>{f.title}</span>
              {f.free && <span style={{ fontSize: '0.58rem', padding: '1px 6px', borderRadius: 4, background: '#10b98118', color: '#10b981', fontWeight: 600 }}>FREE</span>}
            </div>
            <p style={{ fontSize: '0.82rem', color: textSec, lineHeight: 1.5, margin: 0 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
        textAlign: 'center', marginBottom: '4rem',
        padding: '2rem', borderRadius: 14, border: `1px solid ${border}`,
        background: dark ? '#12141c' : '#fff',
      }}>
        {[
          { value: '$33B+', label: 'Polymarket 2025 volume' },
          { value: '2', label: 'Platforms aggregated' },
          { value: '3', label: 'DL models running' },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: accent }}>{s.value}</div>
            <div style={{ fontSize: '0.78rem', color: textSec }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Ready to find your edge?
        </h2>
        <button onClick={onGetStarted} style={{
          padding: '0.8rem 2rem', borderRadius: 10, border: 'none',
          background: accent, color: '#fff', fontSize: '1rem', fontWeight: 600,
          cursor: 'pointer',
        }}>
          Start for free
        </button>
      </div>
    </div>
  );
};
