import React, { useState } from 'react';
import { useApi, apiFetch } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import { theme } from '../styles';
import {
  Briefcase, Plus, Trash2, TrendingUp, TrendingDown, Shield, Lock, X,
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

interface Props { dark?: boolean; onAuthRequired: () => void; }

export const PortfolioPage: React.FC<Props> = ({ onAuthRequired }) => {
  const user = useAuthStore(s => s.user);
  const tier = user?.tier || 'free';
  const { data, refresh } = useApi<{ positions: Position[]; risk: Risk }>('/portfolio', 15000);
  const { data: scenarios } = useApi<{ scenarios: any[] }>(
    user?.tier !== 'free' ? '/portfolio/scenarios' : '', 30000
  );
  const [showAdd, setShowAdd] = useState(false);

  if (!user) {
    return (
      <div style={{
        textAlign: 'center', padding: '4rem 2rem',
        background: theme.card, borderRadius: 20, border: `1px solid ${theme.border}`,
        animation: 'fadeIn 0.4s ease',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 1.25rem',
          background: theme.purpleBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Lock size={28} color={theme.purple} /></div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Portfólio</h3>
        <p style={{ color: theme.textSecondary, marginBottom: '1.5rem', fontSize: '0.85rem' }}>Entre para acompanhar seu portfólio</p>
        <button onClick={onAuthRequired} style={{
          padding: '0.7rem 1.8rem', borderRadius: 10, border: 'none',
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
          color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
          boxShadow: `0 4px 16px ${theme.accent}30`,
        }}>Entrar</button>
      </div>
    );
  }

  const positions = data?.positions || [];
  const risk = data?.risk;

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta posição?')) return;
    await apiFetch(`/portfolio/${id}`, { method: 'DELETE' });
    refresh();
  };

  const riskCards = risk && risk.positions_count > 0 ? [
    { label: 'Investido', value: `$${risk.total_invested.toFixed(2)}`, color: theme.accent },
    { label: 'Atual', value: `$${risk.total_current.toFixed(2)}`, color: theme.blue },
    { label: 'Lucro/Perda', value: `${risk.pnl >= 0 ? '+' : ''}$${risk.pnl.toFixed(2)}`, color: risk.pnl >= 0 ? theme.green : theme.red },
    { label: 'Retorno', value: `${risk.pnl_pct >= 0 ? '+' : ''}${risk.pnl_pct.toFixed(1)}%`, color: risk.pnl_pct >= 0 ? theme.green : theme.red },
    { label: 'Perda Máx.', value: `$${risk.max_loss.toFixed(2)}`, color: theme.red },
    { label: 'Concentração', value: `${risk.concentration.toFixed(0)}%`, color: risk.concentration > 50 ? theme.yellow : theme.green },
  ] : null;

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Briefcase size={20} color={theme.accent} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Portfólio</h2>
          </div>
          <p style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
            {positions.length}/{tier === 'quant' ? 500 : tier === 'pro' ? 50 : 5} posições
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem',
          borderRadius: 10, border: 'none',
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
          color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
          boxShadow: `0 4px 12px ${theme.accent}25`,
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
          <Plus size={14} /> Adicionar
        </button>
      </div>

      {/* Risk summary */}
      {riskCards && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 10, marginBottom: '1.5rem',
        }}>
          {riskCards.map((s, i) => (
            <div key={s.label} style={{
              background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12,
              padding: '0.75rem', borderLeft: `3px solid ${s.color}`,
              animation: `fadeIn 0.3s ease ${i * 0.06}s both`,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = theme.cardHover}
            onMouseLeave={e => e.currentTarget.style.background = theme.card}>
              <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Positions */}
      {positions.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '4rem 2rem', color: theme.textMuted,
          background: theme.card, borderRadius: 20, border: `1px solid ${theme.border}`,
        }}>
          <Briefcase size={36} color={theme.textMuted} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: '0.95rem', marginBottom: 6 }}>Nenhuma posição ainda</p>
          <p style={{ fontSize: '0.78rem', marginBottom: '1.5rem' }}>Adicione sua primeira posição para começar a acompanhar.</p>
          <button onClick={() => setShowAdd(true)} style={{
            padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none',
            background: theme.accent, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem',
          }}>Adicionar posição</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {positions.map((p, i) => {
            const pnl = p.current_price != null ? (p.current_price - p.avg_price) * p.shares : 0;
            return (
              <PositionCard key={p.id} position={p} pnl={pnl} index={i} onDelete={handleDelete} />
            );
          })}
        </div>
      )}

      {/* Scenarios */}
      {scenarios?.scenarios && scenarios.scenarios.length > 0 && (
        <div style={{
          background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14,
          padding: '1.25rem', marginTop: '1.5rem',
          animation: 'fadeIn 0.4s ease 0.3s both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <Shield size={18} color={theme.yellow} />
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Análise de Cenários</span>
          </div>
          {scenarios.scenarios.map((s: any, i: number) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0',
              borderTop: i > 0 ? `1px solid ${theme.border}` : 'none', fontSize: '0.82rem',
            }}>
              <span style={{ color: theme.textSecondary }}>{s.name}</span>
              <span style={{ fontWeight: 700, color: s.pnl >= 0 ? theme.green : theme.red }}>
                {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)} ({s.pnl_pct >= 0 ? '+' : ''}{s.pnl_pct.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add position modal */}
      {showAdd && <AddPositionModal onClose={() => { setShowAdd(false); refresh(); }} />}
    </div>
  );
};

const PositionCard: React.FC<{ position: Position; pnl: number; index: number; onDelete: (id: string) => void }> = ({ position: p, pnl, index, onDelete }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '0.85rem 1.1rem',
        background: hovered ? theme.cardHover : theme.card,
        border: `1px solid ${hovered ? theme.borderHover : theme.border}`,
        borderRadius: 14,
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        animation: `fadeIn 0.3s ease ${index * 0.05}s both`,
      }}
    >
      <span style={{
        fontSize: '0.65rem', padding: '3px 10px', borderRadius: 6, fontWeight: 700,
        background: p.side === 'YES' ? theme.greenBg : theme.redBg,
        color: p.side === 'YES' ? theme.green : theme.red,
      }}>{p.side}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.83rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.question || p.market_id}
        </div>
        <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginTop: 3 }}>
          {p.shares} shares @ {(p.avg_price * 100).toFixed(1)}¢ · {p.source}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {p.current_price != null && (
          <div style={{
            fontSize: '0.88rem', fontWeight: 700,
            color: pnl >= 0 ? theme.green : theme.red,
            display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end',
          }}>
            {pnl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
          </div>
        )}
        <div style={{ fontSize: '0.65rem', color: theme.textSecondary }}>
          {p.current_price != null ? `${(p.current_price * 100).toFixed(1)}¢` : '—'}
        </div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDelete(p.id); }} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: theme.red,
        opacity: hovered ? 0.8 : 0.3, transition: 'opacity 0.2s',
        padding: 4,
      }} aria-label="Remover posição"><Trash2 size={14} /></button>
    </div>
  );
};

const AddPositionModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [marketId, setMarketId] = useState('');
  const [question, setQuestion] = useState('');
  const [side, setSide] = useState<'YES' | 'NO'>('YES');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const inp: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.85rem', borderRadius: 10,
    border: `1px solid ${theme.border}`, background: theme.bg,
    color: theme.text, fontSize: '0.85rem', outline: 'none',
    fontFamily: 'inherit', transition: 'border-color 0.2s',
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
        throw new Error(data.detail || 'Falha ao adicionar');
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
      justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      animation: 'fadeIn 0.2s ease',
    }} onClick={onClose}>
      <div style={{
        background: theme.card, borderRadius: 20, padding: '1.75rem', width: '100%', maxWidth: 420,
        border: `1px solid ${theme.border}`,
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        animation: 'slideUp 0.3s ease',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Adicionar Posição</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 600, display: 'block', marginBottom: 5 }}>ID do Mercado *</label>
            <input placeholder="Market ID / Condition ID" value={marketId} onChange={e => setMarketId(e.target.value)} required style={inp} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 600, display: 'block', marginBottom: 5 }}>Pergunta (opcional)</label>
            <input placeholder="Ex: Trump vence 2028?" value={question} onChange={e => setQuestion(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 600, display: 'block', marginBottom: 5 }}>Lado</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['YES', 'NO'] as const).map(s => (
                <button key={s} type="button" onClick={() => setSide(s)} style={{
                  flex: 1, padding: '0.55rem', borderRadius: 10,
                  border: `1px solid ${side === s ? (s === 'YES' ? theme.green : theme.red) + '40' : theme.border}`,
                  background: side === s ? (s === 'YES' ? theme.greenBg : theme.redBg) : 'transparent',
                  color: side === s ? (s === 'YES' ? theme.green : theme.red) : theme.textSecondary,
                  cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                  transition: 'all 0.2s',
                }}>{s}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 600, display: 'block', marginBottom: 5 }}>Shares *</label>
              <input type="number" placeholder="100" value={shares} onChange={e => setShares(e.target.value)} required min="0.01" step="0.01" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 600, display: 'block', marginBottom: 5 }}>Preço médio (¢) *</label>
              <input type="number" placeholder="65" value={price} onChange={e => setPrice(e.target.value)} required min="1" max="99" step="0.1" style={inp} />
            </div>
          </div>
          {error && (
            <div style={{
              padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.78rem',
              background: theme.redBg, color: theme.red, border: `1px solid ${theme.red}20`,
            }}>{error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            padding: '0.7rem', borderRadius: 10, border: 'none',
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
            color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem',
            opacity: loading ? 0.7 : 1, marginTop: 4,
            boxShadow: `0 4px 16px ${theme.accent}25`,
          }}>{loading ? 'Adicionando...' : 'Adicionar posição'}</button>
        </form>
      </div>
    </div>
  );
};
