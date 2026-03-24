import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Trash2, Edit3, Check, X, TrendingUp, TrendingDown,
  Palette, Crown, Lock, Search, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import { useIsPro } from '../shared/ProGate';

/* ── Types ── */
interface Carteira {
  carteiraId: string;
  name: string;
  color: string;
  icon: string;
  tickers: string[];
  createdAt: string;
}

interface TickerQuote {
  ticker: string;
  last_close: number;
  change_pct: number;
}

interface CarteirasTabProps { darkMode?: boolean; }

const ICONS = ['💼', '🎯', '🚀', '💎', '🏦', '📈', '🌟', '⚡', '🔥', '🛡️', '🎲', '🏆'];
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];
const MAX_FREE = 1;

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const authHeaders = () => {
  const token = localStorage.getItem('authToken');
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
};

const CarteirasTab: React.FC<CarteirasTabProps> = ({ darkMode = false }) => {
  const isPro = useIsPro();
  const [carteiras, setCarteiras] = useState<Carteira[]>([]);
  const [quotes, setQuotes] = useState<Record<string, TickerQuote>>({});
  const [allTickers, setAllTickers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [newIcon, setNewIcon] = useState(ICONS[0]);
  const [tickerSearch, setTickerSearch] = useState('');
  const [addingTickerTo, setAddingTickerTo] = useState<string | null>(null);

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    green: '#10b981', red: '#ef4444', yellow: '#f59e0b', blue: '#3b82f6', purple: '#8b5cf6',
  };

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg, border: `1px solid ${theme.border}`,
    borderRadius: 12, padding: 'clamp(0.75rem, 3vw, 1.25rem)',
  };

  // Fetch quotes + carteiras on mount
  useEffect(() => {
    (async () => {
      try {
        const [recsRes, cartRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers: { 'x-api-key': API_KEY } }),
          fetch(`${API_BASE_URL}/carteiras`, { headers: authHeaders() }),
        ]);

        if (recsRes.ok) {
          const data = await recsRes.json();
          const recs = data.recommendations || [];
          setAllTickers(recs.map((r: any) => r.ticker).sort());
          const quoteMap: Record<string, TickerQuote> = {};
          recs.forEach((r: any) => {
            quoteMap[r.ticker] = {
              ticker: r.ticker,
              last_close: r.last_close,
              change_pct: r.exp_return_20 ? (r.exp_return_20 / 20) * 100 : 0,
            };
          });
          setQuotes(quoteMap);
        }

        if (cartRes.ok) {
          const cartData = await cartRes.json();
          setCarteiras(cartData.carteiras || []);
        }
      } catch (err: any) {
        const msg = err.message === 'Load failed' || err.message === 'Failed to fetch'
          ? 'Falha de conexão. Verifique sua internet.' : err.message;
        setError(msg);
      } finally { setLoading(false); }
    })();
  }, []);

  const canCreate = isPro || carteiras.length < MAX_FREE;

  const handleCreate = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/carteiras`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ name: newName.trim(), color: newColor, icon: newIcon, tickers: [] }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Erro ao criar'); return; }
      setCarteiras(prev => [...prev, data.carteira]);
      setNewName(''); setNewColor(COLORS[0]); setNewIcon(ICONS[0]); setCreating(false);
    } catch { setError('Erro de conexão'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      await fetch(`${API_BASE_URL}/carteiras`, {
        method: 'DELETE', headers: authHeaders(),
        body: JSON.stringify({ carteiraId: id }),
      });
      setCarteiras(prev => prev.filter(c => c.carteiraId !== id));
      if (expandedId === id) setExpandedId(null);
    } catch { setError('Erro ao excluir'); }
    finally { setSaving(false); }
  };

  const handleRename = async (id: string, name: string) => {
    setEditingId(null);
    try {
      await fetch(`${API_BASE_URL}/carteiras`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ carteiraId: id, name }),
      });
      setCarteiras(prev => prev.map(c => c.carteiraId === id ? { ...c, name } : c));
    } catch { setError('Erro ao renomear'); }
  };

  const handleUpdateStyle = async (id: string, color: string, icon: string) => {
    setCarteiras(prev => prev.map(c => c.carteiraId === id ? { ...c, color, icon } : c));
    try {
      await fetch(`${API_BASE_URL}/carteiras`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ carteiraId: id, color, icon }),
      });
    } catch { /* optimistic update, ignore */ }
  };

  const handleAddTicker = async (carteiraId: string, ticker: string) => {
    const carteira = carteiras.find(c => c.carteiraId === carteiraId);
    if (!carteira || carteira.tickers.includes(ticker)) return;
    const newTickers = [...carteira.tickers, ticker];
    setCarteiras(prev => prev.map(c => c.carteiraId === carteiraId ? { ...c, tickers: newTickers } : c));
    setTickerSearch('');
    try {
      await fetch(`${API_BASE_URL}/carteiras`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ carteiraId, tickers: newTickers }),
      });
    } catch { /* optimistic */ }
  };

  const handleRemoveTicker = async (carteiraId: string, ticker: string) => {
    const carteira = carteiras.find(c => c.carteiraId === carteiraId);
    if (!carteira) return;
    const newTickers = carteira.tickers.filter(t => t !== ticker);
    setCarteiras(prev => prev.map(c => c.carteiraId === carteiraId ? { ...c, tickers: newTickers } : c));
    try {
      await fetch(`${API_BASE_URL}/carteiras`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ carteiraId, tickers: newTickers }),
      });
    } catch { /* optimistic */ }
  };

  const getCarteiraStats = useCallback((c: Carteira) => {
    const tickerQuotes = c.tickers.map(t => quotes[t]).filter(Boolean);
    if (!tickerQuotes.length) return { total: 0, avgChange: 0, positive: 0, negative: 0 };
    const avgChange = tickerQuotes.reduce((s, q) => s + q.change_pct, 0) / tickerQuotes.length;
    const positive = tickerQuotes.filter(q => q.change_pct > 0).length;
    const negative = tickerQuotes.filter(q => q.change_pct < 0).length;
    return { total: tickerQuotes.length, avgChange, positive, negative };
  }, [quotes]);

  const filteredTickers = useMemo(() => {
    if (!tickerSearch.trim()) return allTickers.slice(0, 20);
    const q = tickerSearch.toUpperCase();
    return allTickers.filter(t => t.includes(q)).slice(0, 20);
  }, [tickerSearch, allTickers]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: theme.textSecondary }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💼</div>
        Carregando carteiras...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: theme.red }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
        {error}
        <div style={{ marginTop: '0.75rem' }}>
          <button onClick={() => { setError(null); setLoading(true); window.location.reload(); }} style={{
            padding: '0.4rem 0.8rem', borderRadius: 6, border: `1px solid ${theme.border}`,
            background: 'transparent', color: theme.textSecondary, cursor: 'pointer', fontSize: '0.78rem',
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          }}><RefreshCw size={12} /> Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', color: theme.text, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            💼 Minhas Carteiras
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: theme.textSecondary }}>
            Monte carteiras personalizadas e acompanhe a evolução das suas ações.
            {!isPro && <span style={{ color: theme.yellow, marginLeft: '0.5rem' }}>
              <Lock size={11} style={{ verticalAlign: 'middle' }} /> Free: {MAX_FREE} carteira
            </span>}
          </p>
        </div>
        <button
          onClick={() => canCreate ? setCreating(true) : undefined}
          disabled={!canCreate || saving}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.5rem 1rem', borderRadius: 8, border: 'none', cursor: canCreate ? 'pointer' : 'not-allowed',
            background: canCreate ? theme.blue : theme.border,
            color: canCreate ? 'white' : theme.textSecondary,
            fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.2s',
            opacity: canCreate ? 1 : 0.6,
          }}
        >
          {canCreate ? <Plus size={16} /> : <Lock size={14} />}
          {canCreate ? 'Nova Carteira' : 'Limite atingido (Pro)'}
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div style={{ ...cardStyle, marginBottom: '1rem', borderColor: theme.blue, borderWidth: 2 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem' }}>
            Criar nova carteira
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ fontSize: '0.7rem', color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>Nome</label>
              <input
                value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Ex: Dividendos, Tech, Longo Prazo..."
                maxLength={30}
                style={{
                  width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8,
                  border: `1px solid ${theme.border}`, background: theme.bg,
                  color: theme.text, fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
                }}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>Ícone</label>
              <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => setNewIcon(ic)} style={{
                    width: 30, height: 30, borderRadius: 6, border: newIcon === ic ? `2px solid ${theme.blue}` : `1px solid ${theme.border}`,
                    background: newIcon === ic ? 'rgba(59,130,246,0.1)' : 'transparent',
                    cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{ic}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.7rem', color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>Cor</label>
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setNewColor(c)} style={{
                  width: 24, height: 24, borderRadius: '50%', border: newColor === c ? '3px solid white' : '2px solid transparent',
                  background: c, cursor: 'pointer', boxShadow: newColor === c ? `0 0 0 2px ${c}` : 'none',
                }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
            <button onClick={() => setCreating(false)} style={{
              padding: '0.4rem 0.8rem', borderRadius: 6, border: `1px solid ${theme.border}`,
              background: 'transparent', color: theme.textSecondary, cursor: 'pointer', fontSize: '0.78rem',
            }}>Cancelar</button>
            <button onClick={handleCreate} disabled={!newName.trim() || saving} style={{
              padding: '0.4rem 0.8rem', borderRadius: 6, border: 'none',
              background: newName.trim() ? theme.blue : theme.border,
              color: newName.trim() ? 'white' : theme.textSecondary,
              cursor: newName.trim() ? 'pointer' : 'not-allowed', fontSize: '0.78rem', fontWeight: 600,
            }}>{saving ? 'Criando...' : 'Criar'}</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {carteiras.length === 0 && !creating && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem 1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>💼</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '0.35rem' }}>
            Nenhuma carteira criada
          </div>
          <div style={{ fontSize: '0.82rem', color: theme.textSecondary, marginBottom: '1rem' }}>
            Crie sua primeira carteira para acompanhar suas ações favoritas.
          </div>
          <button onClick={() => setCreating(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.6rem 1.2rem', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: theme.blue, color: 'white', fontSize: '0.85rem', fontWeight: 600,
          }}>
            <Plus size={16} /> Criar Carteira
          </button>
        </div>
      )}

      {/* Carteiras list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {carteiras.map(c => {
          const stats = getCarteiraStats(c);
          const isExpanded = expandedId === c.carteiraId;
          const isEditing = editingId === c.carteiraId;

          return (
            <div key={c.carteiraId} style={{ ...cardStyle, borderLeft: `4px solid ${c.color}`, transition: 'all 0.2s' }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : c.carteiraId)}>
                <span style={{ fontSize: '1.4rem' }}>{c.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isEditing ? (
                    <EditNameInline
                      value={c.name} theme={theme}
                      onSave={name => handleRename(c.carteiraId, name)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>{c.name}</div>
                  )}
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
                    {c.tickers.length} {c.tickers.length === 1 ? 'ação' : 'ações'}
                    {stats.total > 0 && (
                      <span style={{ marginLeft: '0.5rem', color: stats.avgChange >= 0 ? theme.green : theme.red, fontWeight: 600 }}>
                        {stats.avgChange >= 0 ? '▲' : '▼'} {fmt(Math.abs(stats.avgChange))}%
                      </span>
                    )}
                  </div>
                </div>
                {stats.total > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem' }}>
                    <span style={{ color: theme.green }}>↑{stats.positive}</span>
                    <span style={{ color: theme.red }}>↓{stats.negative}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.25rem' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setEditingId(c.carteiraId)} title="Renomear" style={{
                    padding: 4, borderRadius: 4, border: 'none', background: 'transparent',
                    color: theme.textSecondary, cursor: 'pointer',
                  }}><Edit3 size={14} /></button>
                  <button onClick={() => handleDelete(c.carteiraId)} title="Excluir" style={{
                    padding: 4, borderRadius: 4, border: 'none', background: 'transparent',
                    color: theme.red, cursor: 'pointer', opacity: 0.7,
                  }}><Trash2 size={14} /></button>
                </div>
                {isExpanded ? <ChevronUp size={16} color={theme.textSecondary} /> : <ChevronDown size={16} color={theme.textSecondary} />}
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ marginTop: '0.75rem', borderTop: `1px solid ${theme.border}`, paddingTop: '0.75rem' }}>
                  {/* Customization row */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
                    <Palette size={13} color={theme.textSecondary} />
                    <span style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Cor:</span>
                    {COLORS.map(col => (
                      <button key={col} onClick={() => handleUpdateStyle(c.carteiraId, col, c.icon)} style={{
                        width: 18, height: 18, borderRadius: '50%', border: c.color === col ? '2px solid white' : '1px solid transparent',
                        background: col, cursor: 'pointer', boxShadow: c.color === col ? `0 0 0 1px ${col}` : 'none',
                      }} />
                    ))}
                    <span style={{ fontSize: '0.7rem', color: theme.textSecondary, marginLeft: '0.5rem' }}>Ícone:</span>
                    {ICONS.slice(0, 6).map(ic => (
                      <button key={ic} onClick={() => handleUpdateStyle(c.carteiraId, c.color, ic)} style={{
                        width: 24, height: 24, borderRadius: 4, border: c.icon === ic ? `1px solid ${theme.blue}` : `1px solid transparent`,
                        background: c.icon === ic ? 'rgba(59,130,246,0.1)' : 'transparent',
                        cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{ic}</button>
                    ))}
                  </div>

                  {/* Add ticker */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: theme.textSecondary }} />
                      <input
                        value={addingTickerTo === c.carteiraId ? tickerSearch : ''}
                        onChange={e => { setAddingTickerTo(c.carteiraId); setTickerSearch(e.target.value); }}
                        onFocus={() => setAddingTickerTo(c.carteiraId)}
                        placeholder="Buscar ação para adicionar..."
                        style={{
                          width: '100%', padding: '0.45rem 0.75rem 0.45rem 2rem', borderRadius: 8,
                          border: `1px solid ${theme.border}`, background: theme.bg,
                          color: theme.text, fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    {addingTickerTo === c.carteiraId && tickerSearch && (
                      <div style={{
                        marginTop: '0.25rem', background: theme.cardBg, border: `1px solid ${theme.border}`,
                        borderRadius: 8, maxHeight: 160, overflowY: 'auto',
                      }}>
                        {filteredTickers.filter(t => !c.tickers.includes(t)).map(t => (
                          <button key={t} onClick={() => { handleAddTicker(c.carteiraId, t); setAddingTickerTo(null); }} style={{
                            width: '100%', padding: '0.4rem 0.75rem', border: 'none', background: 'transparent',
                            color: theme.text, cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}
                            onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#334155' : '#f1f5f9'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <span>{t}</span>
                            {quotes[t] && (
                              <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
                                R$ {fmt(quotes[t].last_close)}
                              </span>
                            )}
                          </button>
                        ))}
                        {filteredTickers.filter(t => !c.tickers.includes(t)).length === 0 && (
                          <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: theme.textSecondary }}>
                            Nenhuma ação encontrada
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tickers table */}
                  {c.tickers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: theme.textSecondary, fontSize: '0.8rem' }}>
                      Nenhuma ação adicionada. Use a busca acima para adicionar.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                            <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: theme.textSecondary, fontWeight: 500, fontSize: '0.72rem' }}>Ação</th>
                            <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: theme.textSecondary, fontWeight: 500, fontSize: '0.72rem' }}>Preço</th>
                            <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: theme.textSecondary, fontWeight: 500, fontSize: '0.72rem' }}>Variação</th>
                            <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem', color: theme.textSecondary, fontWeight: 500, fontSize: '0.72rem', width: 40 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.tickers.map(ticker => {
                            const q = quotes[ticker];
                            return (
                              <tr key={ticker} style={{ borderBottom: `1px solid ${theme.border}` }}>
                                <td style={{ padding: '0.5rem', color: theme.text, fontWeight: 600 }}>{ticker}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: theme.text }}>
                                  {q ? `R$ ${fmt(q.last_close)}` : '—'}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                  {q ? (
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                      color: q.change_pct >= 0 ? theme.green : theme.red, fontWeight: 600,
                                    }}>
                                      {q.change_pct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                      {fmt(Math.abs(q.change_pct))}%
                                    </span>
                                  ) : '—'}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                  <button onClick={() => handleRemoveTicker(c.carteiraId, ticker)} title="Remover" style={{
                                    padding: 2, borderRadius: 4, border: 'none', background: 'transparent',
                                    color: theme.red, cursor: 'pointer', opacity: 0.6,
                                  }}><X size={14} /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pro upsell */}
      {!isPro && carteiras.length >= MAX_FREE && (
        <div style={{
          ...cardStyle, marginTop: '1rem', textAlign: 'center',
          background: darkMode ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.03)',
          border: '1px solid rgba(245,158,11,0.2)',
        }}>
          <Crown size={24} color={theme.yellow} style={{ marginBottom: '0.5rem' }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, marginBottom: '0.25rem' }}>
            Crie carteiras ilimitadas com o Pro
          </div>
          <div style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '0.75rem' }}>
            No plano gratuito você pode criar {MAX_FREE} carteira. Faça upgrade para criar quantas quiser.
          </div>
          <a href="#/dashboard/upgrade" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
            background: theme.yellow, color: '#0f172a', fontSize: '0.82rem',
            fontWeight: 600, textDecoration: 'none',
          }}>
            <Crown size={14} /> Fazer Upgrade
          </a>
        </div>
      )}
    </div>
  );
};

/* ── Inline edit helper ── */
const EditNameInline: React.FC<{
  value: string; theme: Record<string, string>;
  onSave: (v: string) => void; onCancel: () => void;
}> = ({ value, theme, onSave, onCancel }) => {
  const [v, setV] = useState(value);
  return (
    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
      <input value={v} onChange={e => setV(e.target.value)} maxLength={30} autoFocus
        onKeyDown={e => { if (e.key === 'Enter') onSave(v); if (e.key === 'Escape') onCancel(); }}
        style={{
          padding: '0.25rem 0.5rem', borderRadius: 6, border: `1px solid ${theme.border}`,
          background: theme.bg, color: theme.text, fontSize: '0.85rem', outline: 'none', width: 160,
        }}
      />
      <button onClick={() => onSave(v)} style={{ padding: 2, border: 'none', background: 'transparent', color: '#10b981', cursor: 'pointer' }}>
        <Check size={14} />
      </button>
      <button onClick={onCancel} style={{ padding: 2, border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
        <X size={14} />
      </button>
    </div>
  );
};

export default CarteirasTab;
