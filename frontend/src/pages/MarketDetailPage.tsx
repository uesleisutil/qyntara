import React from 'react';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import { theme, badgeStyle } from '../styles';
import { ArrowLeft, Newspaper, BarChart3, ExternalLink, Clock, TrendingUp, Brain, Zap } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';

interface Signal {
  market_id: string; ai_estimated_price?: number; edge?: number;
  signal_score?: number; direction?: string; signal_type?: string;
  is_anomaly?: boolean; anomaly_score?: number;
}
interface Props { marketId: string; dark?: boolean; onBack: () => void; }

export const MarketDetailPage: React.FC<Props> = ({ marketId, onBack }) => {
  const user = useAuthStore(s => s.user);
  const tier = user?.tier || 'free';
  const isPro = tier === 'pro' || tier === 'quant' || tier === 'enterprise';
  const { data, loading } = useApi<any>(`/markets/${marketId}`, 15000);
  const { data: historyData } = useApi<{ history: { t: string; p: number }[] }>(`/markets/${marketId}/history?days=7`, 60000);
  const { data: signalsData } = useApi<{ signals: Signal[] }>(isPro ? '/signals?limit=30' : '', 30000);

  if (loading && !data) {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div style={{ height: 32, width: 160, borderRadius: 8, background: theme.card, marginBottom: 16 }} />
        <div style={{
          height: 200, borderRadius: 16, border: `1px solid ${theme.border}`,
          background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`,
          backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
        }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: theme.textMuted, animation: 'fadeIn 0.3s ease' }}>
        <BarChart3 size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
        <p>Mercado não encontrado</p>
      </div>
    );
  }

  const m = data;
  const pct = (m.yes_price * 100).toFixed(1);
  const priceColor = m.yes_price > 0.6 ? theme.green : m.yes_price < 0.4 ? theme.red : theme.yellow;
  const sent = m.sentiment || {};
  const daysLeft = m.end_date ? Math.max(0, Math.ceil((new Date(m.end_date).getTime() - Date.now()) / 86400000)) : null;

  // Find AI signal for this market
  const aiSignal = signalsData?.signals?.find(s => s.market_id === marketId);
  const hasAI = aiSignal && aiSignal.ai_estimated_price != null;
  const aiPricePct = hasAI ? (aiSignal.ai_estimated_price! * 100).toFixed(1) : null;
  const edgePct = hasAI && aiSignal.edge != null ? (aiSignal.edge * 100).toFixed(1) : null;

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
        color: theme.textSecondary, cursor: 'pointer', fontSize: '0.82rem', marginBottom: '1rem',
        transition: 'color 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.color = theme.accent}
      onMouseLeave={e => e.currentTarget.style.color = theme.textSecondary}>
        <ArrowLeft size={16} /> Voltar aos mercados
      </button>

      {/* Header card */}
      <div style={{
        background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16,
        padding: '1.5rem', marginBottom: '1rem',
        animation: 'slideUp 0.4s ease 0.1s both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={badgeStyle(
            m.source === 'polymarket' ? theme.purple : theme.blue,
            m.source === 'polymarket' ? theme.purpleBg : theme.blueBg,
          )}>{m.source?.toUpperCase()}</span>
          {m.category && <span style={badgeStyle(theme.textMuted, `${theme.textMuted}15`)}>{m.category}</span>}
          {daysLeft !== null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: daysLeft < 3 ? theme.red : theme.textMuted }}>
              <Clock size={11} /> {daysLeft}d restantes
            </span>
          )}
        </div>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.35, marginBottom: '1.25rem' }}>{m.question}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          {[
            { label: 'Preço YES', value: `${pct}%`, color: priceColor, big: true },
            { label: 'Volume Total', value: `$${fmtVol(m.volume || 0)}`, color: theme.text },
            { label: 'Volume 24h', value: `$${fmtVol(m.volume_24h || 0)}`, color: theme.text },
            { label: 'Liquidez', value: `$${fmtVol(m.liquidity || 0)}`, color: theme.text },
          ].map((s, i) => (
            <div key={s.label} style={{
              padding: '0.85rem', background: theme.bg, borderRadius: 12,
              textAlign: 'center', border: `1px solid ${theme.border}`,
              animation: `fadeIn 0.3s ease ${0.15 + i * 0.05}s both`,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = theme.borderHover}
            onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
              <div style={{
                fontSize: s.big ? '1.6rem' : '1.15rem', fontWeight: 800, color: s.color,
                letterSpacing: '-0.02em',
              }}>{s.value}</div>
              <div style={{ fontSize: '0.68rem', color: theme.textMuted, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Price bar */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: theme.textMuted, marginBottom: 4 }}>
            <span>NO {(100 - parseFloat(pct)).toFixed(1)}%</span>
            <span>YES {pct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: theme.border, overflow: 'hidden' }}>
            <div style={{
              width: `${m.yes_price * 100}%`, height: '100%', borderRadius: 4,
              background: `linear-gradient(90deg, ${priceColor}80, ${priceColor})`,
              transition: 'width 0.8s ease',
              boxShadow: `0 0 8px ${priceColor}30`,
            }} />
          </div>
        </div>
      </div>

      {/* Price history chart */}
      {historyData?.history && historyData.history.length > 1 && (
        <div style={{
          background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16,
          padding: '1.5rem', marginBottom: '1rem',
          animation: 'slideUp 0.4s ease 0.15s both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <TrendingUp size={18} color={theme.accent} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Evolução das Odds (7 dias)</span>
            <span style={{ fontSize: '0.68rem', color: theme.textMuted, marginLeft: 'auto' }}>
              {historyData.history.length} pontos
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={historyData.history.map(h => ({
              time: new Date(h.t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
              odds: Math.round(h.p * 1000) / 10,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: theme.textMuted }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: theme.textMuted }} domain={[0, 100]} unit="%" width={40} />
              <Tooltip
                contentStyle={{
                  background: theme.card, border: `1px solid ${theme.border}`,
                  borderRadius: 10, fontSize: '0.75rem', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: theme.textSecondary }}
                formatter={(value: any) => [`${value}%`, 'YES']}
              />
              <Area
                type="monotone" dataKey="odds" name="YES"
                stroke={priceColor} fill={`${priceColor}15`} strokeWidth={2}
                dot={false} activeDot={{ r: 4, fill: priceColor }}
              />
              {hasAI && (
                <ReferenceLine
                  y={parseFloat(aiPricePct!)} stroke={theme.cyan} strokeDasharray="6 3" strokeWidth={1.5}
                  label={{ value: `IA ${aiPricePct}%`, position: 'right', fill: theme.cyan, fontSize: 10 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI Edge Overlay */}
      {isPro && hasAI && (
        <div style={{
          background: theme.card, border: `1px solid ${theme.accentBorder}`, borderRadius: 16,
          padding: '1.5rem', marginBottom: '1rem',
          animation: 'slideUp 0.4s ease 0.18s both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <Brain size={18} color={theme.accent} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Estimativa da IA</span>
            <span style={{
              fontSize: '0.55rem', padding: '2px 6px', borderRadius: 4,
              background: theme.accentBg, color: theme.accent, fontWeight: 700, marginLeft: 'auto',
            }}>MODELO TREINADO</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, marginBottom: 14 }}>
            <div style={{ padding: '0.85rem', background: theme.bg, borderRadius: 12, textAlign: 'center', border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: priceColor }}>{pct}%</div>
              <div style={{ fontSize: '0.62rem', color: theme.textMuted, marginTop: 3 }}>Preço Mercado</div>
            </div>
            <div style={{ padding: '0.85rem', background: theme.bg, borderRadius: 12, textAlign: 'center', border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: theme.cyan }}>{aiPricePct}%</div>
              <div style={{ fontSize: '0.62rem', color: theme.textMuted, marginTop: 3 }}>Preço IA</div>
            </div>
            <div style={{ padding: '0.85rem', background: theme.bg, borderRadius: 12, textAlign: 'center', border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: aiSignal.edge! > 0 ? theme.green : theme.red }}>
                {aiSignal.edge! > 0 ? '+' : ''}{edgePct}%
              </div>
              <div style={{ fontSize: '0.62rem', color: theme.textMuted, marginTop: 3 }}>Edge</div>
            </div>
            {aiSignal.signal_score != null && (
              <div style={{ padding: '0.85rem', background: theme.bg, borderRadius: 12, textAlign: 'center', border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: theme.accent }}>{Math.round(aiSignal.signal_score * 100)}</div>
                <div style={{ fontSize: '0.62rem', color: theme.textMuted, marginTop: 3 }}>Score</div>
              </div>
            )}
          </div>

          {/* Edge visual bar */}
          <div style={{ position: 'relative', height: 8, borderRadius: 4, background: theme.border, overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 4,
              width: `${m.yes_price * 100}%`,
              background: `${priceColor}60`,
            }} />
            <div style={{
              position: 'absolute', top: -2, height: 12, width: 2, borderRadius: 1,
              left: `${(aiSignal.ai_estimated_price! * 100)}%`,
              background: theme.cyan,
              boxShadow: `0 0 6px ${theme.cyan}80`,
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: theme.textMuted, marginTop: 4 }}>
            <span>0%</span>
            <span style={{ color: theme.cyan }}>▲ IA</span>
            <span>100%</span>
          </div>

          {/* Direction recommendation */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 14,
            padding: '0.65rem 1rem', borderRadius: 10,
            background: aiSignal.edge! > 0 ? theme.greenBg : theme.redBg,
            border: `1px solid ${aiSignal.edge! > 0 ? `${theme.green}25` : `${theme.red}25`}`,
          }}>
            <Zap size={14} color={aiSignal.edge! > 0 ? theme.green : theme.red} />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: aiSignal.edge! > 0 ? theme.green : theme.red }}>
              {aiSignal.direction}
            </span>
            <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
              — IA estima que o mercado está {aiSignal.edge! > 0 ? 'subvalorizado' : 'sobrevalorizado'} em {Math.abs(parseFloat(edgePct!))}%
            </span>
          </div>

          {aiSignal.is_anomaly && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
              fontSize: '0.7rem', color: theme.yellow,
            }}>
              <Zap size={12} /> Anomalia detectada (score: {aiSignal.anomaly_score?.toFixed(4)}) — possível smart money
            </div>
          )}
        </div>
      )}

      {/* Sentiment */}
      {sent.article_count > 0 && (
        <div style={{
          background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16,
          padding: '1.5rem', marginBottom: '1rem',
          animation: 'slideUp 0.4s ease 0.2s both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <Newspaper size={18} color={theme.purple} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Sentimento de Notícias</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, marginBottom: '1.25rem' }}>
            {[
              {
                label: 'Pontuação',
                value: `${sent.sentiment_score > 0 ? '+' : ''}${(sent.sentiment_score * 100).toFixed(0)}`,
                color: sent.sentiment_score > 0.1 ? theme.green : sent.sentiment_score < -0.1 ? theme.red : theme.yellow,
              },
              { label: 'Artigos', value: sent.article_count, color: theme.text },
              { label: 'Positivo', value: `${(sent.positive_ratio * 100).toFixed(0)}%`, color: theme.green },
            ].map((s, i) => (
              <div key={s.label} style={{
                padding: '0.65rem', background: theme.bg, borderRadius: 10, textAlign: 'center',
                border: `1px solid ${theme.border}`,
                animation: `fadeIn 0.3s ease ${0.25 + i * 0.05}s both`,
              }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.62rem', color: theme.textMuted, marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Sentiment bar */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ height: 6, borderRadius: 3, background: theme.border, overflow: 'hidden' }}>
              <div style={{
                width: `${(sent.positive_ratio || 0) * 100}%`, height: '100%', borderRadius: 3,
                background: `linear-gradient(90deg, ${theme.green}80, ${theme.green})`,
                transition: 'width 0.8s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: theme.textMuted, marginTop: 3 }}>
              <span>Negativo</span>
              <span>Positivo</span>
            </div>
          </div>

          {/* Articles */}
          {sent.articles && sent.articles.map((a: any, i: number) => (
            <a key={i} href={a.link} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 0', borderTop: i > 0 ? `1px solid ${theme.border}` : 'none',
                textDecoration: 'none', transition: 'all 0.2s',
              }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: theme.accent, lineHeight: 1.4 }}>{a.title}</div>
                <div style={{ fontSize: '0.65rem', color: theme.textMuted, marginTop: 3 }}>{a.pub_date}</div>
              </div>
              <ExternalLink size={13} color={theme.textMuted} style={{ flexShrink: 0, marginLeft: 8 }} />
            </a>
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
