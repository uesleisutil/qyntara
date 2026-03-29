import React, { useState } from 'react';
import { useApi, apiFetch } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import {
  Briefcase, Plus, Trash2, TrendingUp, TrendingDown, Shield, AlertTriangle, Lock,
} from 'lucide-react';

interface Position {
  id: string; market_id: string; source: string; question: string;
  side: string; shares: number; avg_price: number; current_price: number | null;
  created_at: string;
}
interface Risk {
  total_invested: number; total_current: number; pnl: number; pnl_pct: number;
  max_loss: number; max_gain: number; concentration: number; positions_count: number;
}

interface Props { dark: boolean; onAuthRequired: () => void; }

export const PortfolioPage: React.FC<Props> = ({ dark, onAuthRequired }) => {
  const user = useAuthStore(s => s.user);
  const { data, refresh } = useApi<{ positions: Position[]; risk: Risk }>('/portfolio', 15000);
  const { data: scenarios } = useApi<{ scenarios: any[] }>(
    user?.tier !== 'free' ? '/portfolio/scenarios' : '', 30000
  );
  const [showAdd, setShowAdd] = useState(false);

  const card = dark ? '#12141c' : '#fff';
  const border = dark ? '#1e2130' : '#e2e8f0';
  const textSec = dark ? '#8892a4' : '#64748b';

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Lock size={32} color={textSec} style={{ marginBottom: '1rem' }} />
        <p style={{ color: textSec, marginBottom: '1rem' }}>Entre para acompanhar seu portfólio</p>
        <button onClick={onAuthRequired} style={{
          padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none',
          background: '#6366f1', color: '#fff', fontWeight: 600, cursor: 'pointer',
        }}>Entrar</button>
      </div>
    );
  }

  const positions = data?.positions || [];
  const risk = data?.risk;

  const handleDelete = async (id: string) => {
    await apiFetch(`/portfolio/${id}`, { method: 'DELETE' });
    refresh();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Briefcase size={18} color="#6366f1" />
          <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Portfolio Tracker</span>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.8rem',
          borderRadius: 6, border: `1px solid ${border}`, background: '#6366f1',
          color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500,
        }}><Plus size={14} /> Add Position</button>
      </div>

      {/* Risk summary */}
      {risk && risk.positions_count > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: '1rem' }}>
          {[
            { label: 'Invested', value: `$${risk.total_invested.toFixed(2)}`, color: '#6366f1' },
            { label: 'Current', value: `$${risk.total_current.toFixed(2)}`, color: '#3b82f6' },
            { label: 'P&L', value: `${risk.pnl >= 0 ? '+' : ''}$${risk.pnl.toFixed(2)}`, color: risk.pnl >= 0 ? '#10b981' : '#ef4444' },
            { label: 'P&L %', value: `${risk.pnl_pct >= 0 ? '+' : ''}${risk.pnl_pct.toFixed(1)}%`, color: risk.pnl_pct >= 0 ? '#10b981' : '#ef4444' },
            { label: 'Max Loss', value: `$${risk.max_loss.toFixed(2)}`, color: '#ef4444' },
            { label: 'Concentration', value: `${risk.concentration.toFixed(0)}%`, color: risk.concentration > 50 ? '#f59e0b' : '#10b981' },
          ].map(s => (
            <div key={s.label} style={{
              background: card, border: `1px solid ${border}`, borderRadius: 8,
              padding: '0.6rem', borderLeft: `3px solid ${s.color}`,
            }}>
              <div style={{ fontSize: '0.62rem', color: textSec }}>{s.label}</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Positions */}
      {positions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: textSec,
          background: card, borderRadius: 12, border: `1px solid ${border}` }}>
          Nenhuma posição ainda. Adicione sua primeira posição para começar a acompanhar.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {positions.map(p => {
            const pnl = p.current_price != null ? (p.current_price - p.avg_price) * p.shares : 0;
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1rem',
                background: card, border: `1px solid ${border}`, borderRadius: 10,
              }}>
                <span style={{
                  fontSize: '0.65rem', padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                  background: p.side === 'YES' ? '#10b98118' : '#ef444418',
                  color: p.side === 'YES' ? '#10b981' : '#ef4444',
                }}>{p.side}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.question || p.market_id}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: textSec }}>
                    {p.shares} shares @ {(p.avg_price * 100).toFixed(1)}¢ · {p.source}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {p.current_price != null && (
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: pnl >= 0 ? '#10b981' : '#ef4444' }}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                    </div>
                  )}
                  <div style={{ fontSize: '0.65rem', color: textSec }}>
                    {p.current_price != null ? `${(p.current_price * 100).toFixed(1)}¢` : '—'}
                  </div>
                </div>
                <button onClick={() => handleDelete(p.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.5,
                }} aria-label="Delete position"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      )}

      {/* Scenarios */}
      {scenarios?.scenarios && scenarios.scenarios.length > 0 && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
            <Shield size={16} color="#f59e0b" />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Scenario Analysis</span>
          </div>
          {scenarios.scenarios.map((s: any, i: number) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0',
              borderTop: i > 0 ? `1px solid ${border}` : 'none', fontSize: '0.78rem',
            }}>
              <span style={{ color: textSec }}>{s.name}</span>
              <span style={{ fontWeight: 600, color: s.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)} ({s.pnl_pct >= 0 ? '+' : ''}{s.pnl_pct.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add position modal */}
      {showAdd && <AddPositionModal dark={dark} onClose={() => { setShowAdd(false); refresh(); }} />}
    </div>
  );
};

const AddPositionModal: React.FC<{ dark: boolean; onClose: () => void }> = ({ dark, onClose }) => {
  const [marketId, setMarketId] = useState('');
  const [question, setQuestion] = useState('');
  const [side, setSide] = useState<'YES' | 'NO'>('YES');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const bg = dark ? '#12141c' : '#fff';
  const border = dark ? '#1e2130' : '#e2e8f0';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8,
    border: `1px solid ${border}`, background: dark ? '#0a0b0f' : '#f8fafc',
    color: dark ? '#e2e8f0' : '#1a202c', fontSize: '0.82rem', outline: 'none',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/portfolio', {
        method: 'POST',
        body: JSON.stringify({
          market_id: marketId, question, side,
          shares: parseFloat(shares), avg_price: parseFloat(price) / 100,
          source: 'polymarket',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed');
      }
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background: bg, borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 400,
        border: `1px solid ${border}`,
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Add Position</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input placeholder="Market ID / Condition ID" value={marketId} onChange={e => setMarketId(e.target.value)} required style={inputStyle} />
          <input placeholder="Question (optional)" value={question} onChange={e => setQuestion(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', gap: 8 }}>
            {(['YES', 'NO'] as const).map(s => (
              <button key={s} type="button" onClick={() => setSide(s)} style={{
                flex: 1, padding: '0.5rem', borderRadius: 8, border: `1px solid ${border}`,
                background: side === s ? (s === 'YES' ? '#10b98120' : '#ef444420') : 'transparent',
                color: side === s ? (s === 'YES' ? '#10b981' : '#ef4444') : dark ? '#8892a4' : '#64748b',
                cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
              }}>{s}</button>
            ))}
          </div>
          <input type="number" placeholder="Shares" value={shares} onChange={e => setShares(e.target.value)} required min="0.01" step="0.01" style={inputStyle} />
          <input type="number" placeholder="Avg price (cents, e.g. 65)" value={price} onChange={e => setPrice(e.target.value)} required min="1" max="99" step="0.1" style={inputStyle} />
          {error && <div style={{ fontSize: '0.78rem', color: '#ef4444' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            padding: '0.6rem', borderRadius: 8, border: 'none', background: '#6366f1',
            color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1,
          }}>{loading ? 'Adding...' : 'Add Position'}</button>
        </form>
      </div>
    </div>
  );
};
