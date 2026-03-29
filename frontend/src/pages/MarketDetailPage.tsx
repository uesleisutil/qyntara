import React from 'react';
import { useApi } from '../hooks/useApi';
import { ArrowLeft, TrendingUp, TrendingDown, Newspaper, BarChart3 } from 'lucide-react';

interface Props { marketId: string; dark: boolean; onBack: () => void; }

export const MarketDetailPage: React.FC<Props> = ({ marketId, dark, onBack }) => {
  const { data, loading } = useApi<any>(`/markets/${marketId}`, 15000);

  const card = dark ? '#12141c' : '#fff';
  const border = dark ? '#1e2130' : '#e2e8f0';
  const textSec = dark ? '#8892a4' : '#64748b';

  if (loading && !data) return <div style={{ textAlign: 'center', padding: '3rem', color: textSec }}>Carregando...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: '3rem', color: textSec }}>Mercado não encontrado</div>;

  const m = data;
  const pct = (m.yes_price * 100).toFixed(1);
  const priceColor = m.yes_price > 0.6 ? '#10b981' : m.yes_price < 0.4 ? '#ef4444' : '#f59e0b';
  const sent = m.sentiment || {};

  return (
    <div>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
        color: textSec, cursor: 'pointer', fontSize: '0.82rem', marginBottom: '1rem',
      }}><ArrowLeft size={16} /> Voltar aos mercados</button>

      {/* Header */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4, fontWeight: 600,
            background: m.source === 'polymarket' ? '#8b5cf615' : '#3b82f615',
            color: m.source === 'polymarket' ? '#8b5cf6' : '#3b82f6',
          }}>{m.source?.toUpperCase()}</span>
          <span style={{ fontSize: '0.72rem', color: textSec }}>{m.category}</span>
        </div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.3, marginBottom: '1rem' }}>{m.question}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
          <div style={{ padding: '0.75rem', background: dark ? '#0a0b0f' : '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: priceColor }}>{pct}%</div>
            <div style={{ fontSize: '0.68rem', color: textSec }}>Preço YES</div>
          </div>
          <div style={{ padding: '0.75rem', background: dark ? '#0a0b0f' : '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>${fmtVol(m.volume || 0)}</div>
            <div style={{ fontSize: '0.68rem', color: textSec }}>Volume Total</div>
          </div>
          <div style={{ padding: '0.75rem', background: dark ? '#0a0b0f' : '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>${fmtVol(m.volume_24h || 0)}</div>
            <div style={{ fontSize: '0.68rem', color: textSec }}>Volume 24h</div>
          </div>
          <div style={{ padding: '0.75rem', background: dark ? '#0a0b0f' : '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>${fmtVol(m.liquidity || 0)}</div>
            <div style={{ fontSize: '0.68rem', color: textSec }}>Liquidez</div>
          </div>
        </div>
      </div>

      {/* Sentiment */}
      {sent.article_count > 0 && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
            <Newspaper size={16} color="#a855f7" />
            <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Sentimento de Notícias</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: '1rem' }}>
            <div style={{ padding: '0.5rem', background: dark ? '#0a0b0f' : '#f8fafc', borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: sent.sentiment_score > 0.1 ? '#10b981' : sent.sentiment_score < -0.1 ? '#ef4444' : '#f59e0b' }}>
                {sent.sentiment_score > 0 ? '+' : ''}{(sent.sentiment_score * 100).toFixed(0)}
              </div>
              <div style={{ fontSize: '0.62rem', color: textSec }}>Pontuação</div>
            </div>
            <div style={{ padding: '0.5rem', background: dark ? '#0a0b0f' : '#f8fafc', borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>{sent.article_count}</div>
              <div style={{ fontSize: '0.62rem', color: textSec }}>Artigos</div>
            </div>
            <div style={{ padding: '0.5rem', background: dark ? '#0a0b0f' : '#f8fafc', borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>{(sent.positive_ratio * 100).toFixed(0)}%</div>
              <div style={{ fontSize: '0.62rem', color: textSec }}>Positivo</div>
            </div>
          </div>
          {/* Articles */}
          {sent.articles && sent.articles.map((a: any, i: number) => (
            <div key={i} style={{ padding: '0.5rem 0', borderTop: i > 0 ? `1px solid ${border}` : 'none' }}>
              <a href={a.link} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '0.78rem', color: '#6366f1', textDecoration: 'none' }}>
                {a.title}
              </a>
              <div style={{ fontSize: '0.68rem', color: textSec, marginTop: 2 }}>{a.pub_date}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function fmtVol(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}
