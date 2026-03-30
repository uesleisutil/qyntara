import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import { theme } from '../styles';
import { GitCompare, X, Plus, Lock } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface Market {
  market_id: string; source: string; question: string; yes_price: number;
  volume_24h: number; category: string;
  history?: { t: string; p: number }[];
}
interface Props { dark?: boolean; onAuthRequired: () => void; }

const COLORS = [theme.accent, theme.green, theme.yellow, theme.purple, theme.cyan];

export const ComparePage: React.FC<Props> = ({ onAuthRequired }) => {
  const user = useAuthStore(s => s.user);
  const [ids, setIds] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const idsParam = ids.join(',');
  const { data, loading } = useApi<{ markets: Market[] }>(
    ids.length > 0 ? `/markets/compare?ids=${idsParam}` : '', 30000
  );

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <Lock size={24} color={theme.textMuted} style={{ marginBottom: 12 }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>Comparar Mercados</h3>
        <p style={{ color: theme.textMuted, marginBottom: '1.5rem', fontSize: '0.82rem' }}>Entre para acessar</p>
        <button onClick={onAuthRequired} style={{
          padding: '0.65rem 1.5rem', borderRadius: 8, border: 'none',
          background: theme.text, color: theme.bg, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
        }}>Entrar</button>
      </div>
    );
  }

  const markets = data?.markets || [];

  const addId = () => {
    const trimmed = input.trim();
    if (trimmed && !ids.includes(trimmed) && ids.length < 5) {
      setIds([...ids, trimmed]);
      setInput('');
    }
  };

  const removeId = (id: string) => setIds(ids.filter(i => i !== id));

  // Merge histories for chart
  const chartData: Record<string, any>[] = [];
  if (markets.length > 0) {
    const timeMap: Record<string, Record<string, number>> = {};
    markets.forEach((m, idx) => {
      (m.history || []).forEach(h => {
        const key = h.t;
        if (!timeMap[key]) timeMap[key] = {};
        timeMap[key][`m${idx}`] = Math.round(h.p * 1000) / 10;
      });
    });
    Object.entries(timeMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([t, vals]) => {
      chartData.push({
        time: new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        ...vals,
      });
    });
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <GitCompare size={20} color={theme.accent} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em' }}>Comparar Mercados</h2>
        </div>
        <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>Compare até 5 mercados side-by-side</p>
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addId(); }}
          placeholder="Cole o Market ID e pressione Enter"
          style={{
            flex: 1, padding: '0.6rem 0.85rem', borderRadius: 10,
            border: `1px solid ${theme.border}`, background: theme.card,
            color: theme.text, fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit',
          }} />
        <button onClick={addId} disabled={ids.length >= 5} style={{
          padding: '0.6rem 1rem', borderRadius: 10, border: 'none',
          background: theme.accent, color: '#fff', fontWeight: 600, fontSize: '0.8rem',
          cursor: ids.length >= 5 ? 'default' : 'pointer', opacity: ids.length >= 5 ? 0.5 : 1,
          display: 'flex', alignItems: 'center', gap: 4,
        }}><Plus size={14} /> Adicionar</button>
      </div>

      {/* Selected IDs */}
      {ids.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {ids.map((id, i) => (
            <span key={id} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
              borderRadius: 6, background: `${COLORS[i]}12`, color: COLORS[i],
              fontSize: '0.68rem', fontWeight: 600,
            }}>
              {id.slice(0, 12)}...
              <button onClick={() => removeId(id)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: COLORS[i], padding: 0,
              }}><X size={11} /></button>
            </span>
          ))}
        </div>
      )}

      {ids.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: theme.textMuted, background: theme.card, borderRadius: 16, border: `1px solid ${theme.border}` }}>
          <GitCompare size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: '0.85rem', marginBottom: 6 }}>Adicione Market IDs para comparar</p>
          <p style={{ fontSize: '0.72rem' }}>Copie o ID de qualquer mercado na página de detalhe.</p>
        </div>
      ) : loading ? (
        <div style={{ height: 200, borderRadius: 16, border: `1px solid ${theme.border}`, background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
      ) : (
        <>
          {/* Chart */}
          {chartData.length > 1 && (
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '1.5rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Evolução Comparada (7 dias)</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: theme.textMuted }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: theme.textMuted }} domain={[0, 100]} unit="%" width={35} />
                  <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: '0.72rem' }} />
                  {markets.map((m, i) => (
                    <Area key={m.market_id} type="monotone" dataKey={`m${i}`} name={m.question?.slice(0, 30) || m.market_id}
                      stroke={COLORS[i]} fill={`${COLORS[i]}10`} strokeWidth={2} dot={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Side by side cards */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`, gap: 10 }}>
            {markets.map((m, i) => {
              const pct = (m.yes_price * 100).toFixed(1);
              const priceColor = m.yes_price > 0.6 ? theme.green : m.yes_price < 0.4 ? theme.red : theme.yellow;
              return (
                <div key={m.market_id} style={{
                  background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14,
                  padding: '1.25rem', borderTop: `3px solid ${COLORS[i]}`,
                  animation: `fadeIn 0.3s ease ${i * 0.08}s both`,
                }}>
                  <div style={{ fontSize: '0.58rem', color: COLORS[i], fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>
                    {m.source?.toUpperCase()} {m.category && `· ${m.category}`}
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.35, marginBottom: 12, minHeight: 40 }}>{m.question}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: priceColor, letterSpacing: '-0.02em' }}>{pct}%</div>
                  <div style={{ fontSize: '0.65rem', color: theme.textMuted, marginTop: 4 }}>Vol 24h: {fmtVol(m.volume_24h)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

function fmtVol(v: number): string {
  if (!v) return '$0';
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${v.toFixed(0)}`;
}
