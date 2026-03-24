import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Trash2, Edit3, Check, X, TrendingUp, TrendingDown,
  Palette, Crown, Lock, Search, ChevronDown, ChevronUp, RefreshCw,
  ArrowUpRight, ArrowDownRight,
  Briefcase, Target, Rocket, Gem, Landmark, BarChart3,
  Star, Zap, Flame, Shield, Dice5, Trophy,
  type LucideIcon,
} from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import { useIsPro } from '../shared/ProGate';
import { getSignal, getSignalColor } from '../../constants';

/* ── Types ── */
interface Carteira {
  carteiraId: string;
  name: string;
  color: string;
  icon: string;
  tickers: string[];
  createdAt: string;
}

interface TickerData {
  ticker: string;
  last_close: number;
  score: number;
  exp_return_20: number;
  pred_price_t_plus_20: number;
  vol_20d: number;
}

interface CarteirasTabProps { darkMode?: boolean; }

const ICON_MAP: Record<string, LucideIcon> = {
  briefcase: Briefcase, target: Target, rocket: Rocket, gem: Gem,
  landmark: Landmark, chart: BarChart3, star: Star, zap: Zap,
  flame: Flame, shield: Shield, dice: Dice5, trophy: Trophy,
};
const ICONS = Object.keys(ICON_MAP);

const renderIcon = (key: string, size: number, color?: string) => {
  const Icon = ICON_MAP[key] || Briefcase;
  return <Icon size={size} color={color} />;
};

const COLORS = ['#5a9e87', '#2d7d9a', '#d4a84b', '#8b7eb8', '#4ead8a', '#e07070', '#4da8c4', '#6daa5a', '#d4944b', '#a99dd0'];
const MAX_FREE = 1;

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const authHeaders = () => {
  const token = localStorage.getItem('authToken');
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
};

const CarteirasTab: React.FC<CarteirasTabProps> = ({ darkMode = false }) => {
  const isPro = useIsPro();
  const [carteiras, setCarteiras] = useState<Carteira[]>([]);
  const [tickerData, setTickerData] = useState<Record<string, TickerData>>({});
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
    bg: darkMode ? '#121a1a' : '#f6faf8',
    cardBg: darkMode ? '#1a2626' : 'white',
    text: darkMode ? '#e8f0ed' : '#121a1a',
    textSecondary: darkMode ? '#8fa89c' : '#5a7268',
    border: darkMode ? '#2a3d36' : '#d4e5dc',
    green: '#4ead8a', red: '#e07070', yellow: '#d4a84b', blue: darkMode ? '#4da8c4' : '#2d7d9a', purple: darkMode ? '#a99dd0' : '#8b7eb8',
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
          const dataMap: Record<string, TickerData> = {};
          recs.forEach((r: any) => {
            dataMap[r.ticker] = {
              ticker: r.ticker,
              last_close: r.last_close,
              score: r.confidence_score || r.score || 0,
              exp_return_20: r.exp_return_20 || 0,
              pred_price_t_plus_20: r.pred_price_t_plus_20 || 0,
              vol_20d: r.vol_20d || 0,
            };
          });
          setTickerData(dataMap);
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

  // Sort carteiras: first by creation date so the oldest (first created) is always index 0
  const sortedCarteiras = useMemo(() =>
    [...carteiras].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
  [carteiras]);

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
    } catch { /* optimistic update */ }
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
    const tds = c.tickers.map(t => tickerData[t]).filter(Boolean);
    if (!tds.length) return { total: 0, avgReturn: 0, positive: 0, negative: 0, avgScore: 0 };
    const avgReturn = tds.reduce((s, q) => s + q.exp_return_20, 0) / tds.length * 100;
    const avgScore = tds.reduce((s, q) => s + q.score, 0) / tds.length;
    const positive = tds.filter(q => q.exp_return_20 > 0).length;
    const negative = tds.filter(q => q.exp_return_20 < 0).length;
    return { total: tds.length, avgReturn, positive, negative, avgScore };
  }, [tickerData]);

  const filteredTickers = useMemo(() => {
    if (!tickerSearch.trim()) return allTickers.slice(0, 20);
    const q = tickerSearch.toUpperCase();
    return allTickers.filter(t => t.includes(q)).slice(0, 20);
  }, [tickerSearch, allTickers]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: theme.textSecondary }}>
        <Briefcase size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
        <div>Carregando carteiras...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: theme.red }}>
        <Shield size={32} style={{ marginBottom: '0.5rem', opacity: 0.7 }} />
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
            <Briefcase size={20} /> Minhas Carteiras
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
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => setNewIcon(ic)} style={{
                    width: 32, height: 32, borderRadius: 6, border: newIcon === ic ? `2px solid ${theme.blue}` : `1px solid ${theme.border}`,
                    background: newIcon === ic ? 'rgba(59,130,246,0.1)' : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0, color: newIcon === ic ? theme.blue : theme.textSecondary,
                  }}>{renderIcon(ic, 16)}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.7rem', color: theme.textSecondary, display: 'block', marginBottom: '0.25rem' }}>Cor</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setNewColor(c)} style={{
                  width: 26, height: 26, minWidth: 26, minHeight: 26, borderRadius: '50%',
                  border: newColor === c ? '3px solid white' : '2px solid transparent',
                  background: c, cursor: 'pointer', padding: 0,
                  boxShadow: newColor === c ? `0 0 0 2px ${c}` : 'none',
                  flexShrink: 0,
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
          <Briefcase size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} color={theme.textSecondary} />
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
        {sortedCarteiras.map((c, idx) => {
          const stats = getCarteiraStats(c);
          const isExpanded = expandedId === c.carteiraId;
          const isEditing = editingId === c.carteiraId;
          // Pro→Free downgrade: only the first carteira (oldest) stays unlocked
          const isLocked = !isPro && idx >= MAX_FREE;

          return (
            <div key={c.carteiraId} style={{
              ...cardStyle,
              borderLeft: `4px solid ${isLocked ? theme.border : c.color}`,
              transition: 'all 0.2s',
              opacity: isLocked ? 0.55 : 1,
              position: 'relative',
            }}>
              {/* Lock overlay for downgraded carteiras */}
              {isLocked && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 12, zIndex: 2,
                  background: darkMode ? 'rgba(15,23,42,0.6)' : 'rgba(248,250,252,0.6)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(2px)',
                }}>
                  <Lock size={22} color={theme.yellow} />
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: theme.text, marginTop: '0.4rem' }}>
                    Carteira bloqueada
                  </div>
                  <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginTop: '0.15rem' }}>
                    Faça upgrade para Pro para desbloquear
                  </div>
                  <a href="#/dashboard/upgrade" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem',
                    padding: '0.35rem 0.75rem', borderRadius: 6, border: 'none',
                    background: theme.yellow, color: '#121a1a', fontSize: '0.72rem',
                    fontWeight: 600, textDecoration: 'none',
                  }}>
                    <Crown size={12} /> Upgrade
                  </a>
                </div>
              )}

              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: isLocked ? 'default' : 'pointer' }}
                onClick={() => !isLocked && setExpandedId(isExpanded ? null : c.carteiraId)}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: `${c.color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {renderIcon(c.icon, 18, c.color)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isEditing && !isLocked ? (
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
                      <span style={{ marginLeft: '0.5rem', color: stats.avgReturn >= 0 ? theme.green : theme.red, fontWeight: 600 }}>
                        {stats.avgReturn >= 0 ? '▲' : '▼'} {fmt(Math.abs(stats.avgReturn), 1)}% ret. esperado
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
                {!isLocked && (
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
                )}
                {!isLocked && (isExpanded ? <ChevronUp size={16} color={theme.textSecondary} /> : <ChevronDown size={16} color={theme.textSecondary} />)}
              </div>

              {/* Expanded content */}
              {isExpanded && !isLocked && (
                <div style={{ marginTop: '0.75rem', borderTop: `1px solid ${theme.border}`, paddingTop: '0.75rem' }}>
                  {/* Customization row */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
                    <Palette size={13} color={theme.textSecondary} />
                    <span style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Cor:</span>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {COLORS.map(col => (
                        <button key={col} onClick={() => handleUpdateStyle(c.carteiraId, col, c.icon)} style={{
                          width: 20, height: 20, minWidth: 20, minHeight: 20, borderRadius: '50%',
                          border: c.color === col ? '2px solid white' : '2px solid transparent',
                          background: col, cursor: 'pointer', padding: 0, flexShrink: 0,
                          boxShadow: c.color === col ? `0 0 0 1.5px ${col}` : 'none',
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: theme.textSecondary, marginLeft: '0.5rem' }}>Ícone:</span>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {ICONS.map(ic => (
                        <button key={ic} onClick={() => handleUpdateStyle(c.carteiraId, c.color, ic)} style={{
                          width: 28, height: 28, minWidth: 28, borderRadius: 6,
                          border: c.icon === ic ? `1.5px solid ${theme.blue}` : '1.5px solid transparent',
                          background: c.icon === ic ? 'rgba(59,130,246,0.1)' : 'transparent',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: 0, color: c.icon === ic ? theme.blue : theme.textSecondary,
                        }}>{renderIcon(ic, 14)}</button>
                      ))}
                    </div>
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
                        {filteredTickers.filter(t => !c.tickers.includes(t)).map(t => {
                          const td = tickerData[t];
                          const sig = td ? getSignal(td.score) : null;
                          const sc = sig ? getSignalColor(sig) : null;
                          return (
                            <button key={t} onClick={() => { handleAddTicker(c.carteiraId, t); setAddingTickerTo(null); }} style={{
                              width: '100%', padding: '0.4rem 0.75rem', border: 'none', background: 'transparent',
                              color: theme.text, cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}
                              onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#2a3d36' : '#e8f0ed'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <span style={{ fontWeight: 600 }}>{t}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {td && <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>R$ {fmt(td.last_close)}</span>}
                                {sc && sig && (
                                  <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: 4, background: sc.bg, color: sc.text, fontWeight: 600 }}>{sig}</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                        {filteredTickers.filter(t => !c.tickers.includes(t)).length === 0 && (
                          <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: theme.textSecondary }}>
                            Nenhuma ação encontrada
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tickers tracking table */}
                  {c.tickers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: theme.textSecondary, fontSize: '0.8rem' }}>
                      Nenhuma ação adicionada. Use a busca acima para adicionar.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                            <th style={{ textAlign: 'left', padding: '0.5rem', color: theme.textSecondary, fontWeight: 500, fontSize: '0.7rem' }}>Ação</th>
                            <th style={{ textAlign: 'center', padding: '0.5rem', color: theme.textSecondary, fontWeight: 500, fontSize: '0.7rem' }}>Sinal</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem', color: theme.textSecondary, fontWeight: 500, fontSize: '0.7rem' }}>Score</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem', color: theme.textSecondary, fontWeight: 500, fontSize: '0.7rem' }}>Preço Atual</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem', color: theme.textSecondary, fontWeight: 500, fontSize: '0.7rem' }}>Preço Previsto</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem', color: theme.textSecondary, fontWeight: 500, fontSize: '0.7rem' }}>Ret. Esperado</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem', color: theme.textSecondary, fontWeight: 500, fontSize: '0.7rem' }}>Vol. 20d</th>
                            <th style={{ textAlign: 'center', padding: '0.5rem', width: 32 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.tickers.map(ticker => {
                            const td = tickerData[ticker];
                            const signal = td ? getSignal(td.score) : null;
                            const sc = signal ? getSignalColor(signal) : null;
                            const expRet = td ? td.exp_return_20 * 100 : 0;
                            return (
                              <tr key={ticker} style={{ borderBottom: `1px solid ${theme.border}` }}>
                                <td style={{ padding: '0.5rem', color: theme.text, fontWeight: 600 }}>{ticker}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                  {sc && signal ? (
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '0.15rem',
                                      padding: '0.15rem 0.4rem', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600,
                                      background: sc.bg, color: sc.text,
                                    }}>
                                      {signal === 'Compra' ? <ArrowUpRight size={10} /> : signal === 'Venda' ? <ArrowDownRight size={10} /> : null}
                                      {signal}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: sc?.text || theme.text }}>
                                  {td ? fmt(td.score) : '—'}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: theme.text }}>
                                  {td ? `R$ ${fmt(td.last_close)}` : '—'}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: theme.text }}>
                                  {td && td.pred_price_t_plus_20 ? `R$ ${fmt(td.pred_price_t_plus_20)}` : '—'}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                  {td ? (
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '0.15rem',
                                      color: expRet >= 0 ? theme.green : theme.red, fontWeight: 600,
                                    }}>
                                      {expRet >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                      {expRet >= 0 ? '+' : ''}{fmt(expRet, 1)}%
                                    </span>
                                  ) : '—'}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: theme.textSecondary }}>
                                  {td && td.vol_20d ? `${fmt(td.vol_20d * 100, 1)}%` : '—'}
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

                      {/* Summary row */}
                      {stats.total > 0 && (
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.6rem 0.5rem', borderTop: `1px solid ${theme.border}`,
                          fontSize: '0.72rem', color: theme.textSecondary, flexWrap: 'wrap', gap: '0.5rem',
                        }}>
                          <span>{stats.total} ações · Score médio: <span style={{ fontWeight: 600, color: theme.text }}>{fmt(stats.avgScore)}</span></span>
                          <span>
                            Retorno médio esperado:{' '}
                            <span style={{ fontWeight: 600, color: stats.avgReturn >= 0 ? theme.green : theme.red }}>
                              {stats.avgReturn >= 0 ? '+' : ''}{fmt(stats.avgReturn, 1)}%
                            </span>
                          </span>
                        </div>
                      )}
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
          background: darkMode ? 'rgba(212,168,75,0.05)' : 'rgba(212,168,75,0.03)',
          border: '1px solid rgba(212,168,75,0.2)',
        }}>
          <Crown size={24} color={theme.yellow} style={{ marginBottom: '0.5rem' }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, marginBottom: '0.25rem' }}>
            Crie carteiras ilimitadas com o Pro
          </div>
          <div style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '0.75rem' }}>
            No plano gratuito você pode usar {MAX_FREE} carteira. Faça upgrade para desbloquear todas.
          </div>
          <a href="#/dashboard/upgrade" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
            background: theme.yellow, color: '#121a1a', fontSize: '0.82rem',
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
      <button onClick={() => onSave(v)} style={{ padding: 2, border: 'none', background: 'transparent', color: '#4ead8a', cursor: 'pointer' }}>
        <Check size={14} />
      </button>
      <button onClick={onCancel} style={{ padding: 2, border: 'none', background: 'transparent', color: '#e07070', cursor: 'pointer' }}>
        <X size={14} />
      </button>
    </div>
  );
};

export default CarteirasTab;
