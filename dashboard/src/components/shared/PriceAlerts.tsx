import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Plus, Trash2, ArrowUp, ArrowDown, X, CheckCircle } from 'lucide-react';
import InfoTooltip from './InfoTooltip';
import { API_BASE_URL, API_KEY } from '../../config';

const ALERTS_KEY = 'b3tr_price_alerts';

interface PriceAlert {
  id: string;
  ticker: string;
  type: 'above' | 'below';
  targetPrice: number;
  createdAt: string;
  triggered: boolean;
}

function getAlerts(): PriceAlert[] {
  try { return JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]'); } catch { return []; }
}
function saveAlerts(alerts: PriceAlert[]) { localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)); }

interface PriceAlertsProps {
  darkMode: boolean;
  theme: Record<string, string>;
}

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const PriceAlerts: React.FC<PriceAlertsProps> = ({ darkMode, theme }) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [tickers, setTickers] = useState<{ ticker: string; last_close: number }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ticker: '', type: 'above' as 'above' | 'below', targetPrice: '' });
  const [triggered, setTriggered] = useState<PriceAlert[]>([]);

  useEffect(() => { setAlerts(getAlerts()); }, []);

  // Fetch current prices
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, {
          headers: { 'x-api-key': API_KEY },
        });
        if (res.ok) {
          const data = await res.json();
          setTickers((data.recommendations || []).map((r: any) => ({ ticker: r.ticker, last_close: r.last_close })));
        }
      } catch { /* silent */ }
    })();
  }, []);

  // Check alerts against current prices
  const checkAlerts = useCallback(() => {
    const current = getAlerts();
    const newTriggered: PriceAlert[] = [];
    let changed = false;
    current.forEach(a => {
      if (a.triggered) return;
      const price = tickers.find(t => t.ticker === a.ticker)?.last_close;
      if (!price) return;
      if ((a.type === 'above' && price >= a.targetPrice) || (a.type === 'below' && price <= a.targetPrice)) {
        a.triggered = true;
        newTriggered.push(a);
        changed = true;
      }
    });
    if (changed) { saveAlerts(current); setAlerts([...current]); }
    if (newTriggered.length) setTriggered(prev => [...prev, ...newTriggered]);
  }, [tickers]);

  useEffect(() => { if (tickers.length) checkAlerts(); }, [tickers, checkAlerts]);

  const addAlert = () => {
    if (!form.ticker || !form.targetPrice) return;
    const newAlert: PriceAlert = {
      id: Date.now().toString(36),
      ticker: form.ticker,
      type: form.type,
      targetPrice: parseFloat(form.targetPrice),
      createdAt: new Date().toISOString(),
      triggered: false,
    };
    const updated = [...alerts, newAlert];
    saveAlerts(updated); setAlerts(updated);
    setForm({ ticker: '', type: 'above', targetPrice: '' });
    setShowForm(false);
  };

  const removeAlert = (id: string) => {
    const updated = alerts.filter(a => a.id !== id);
    saveAlerts(updated); setAlerts(updated);
  };

  const dismissTriggered = (id: string) => {
    setTriggered(prev => prev.filter(t => t.id !== id));
  };

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1rem',
  };
  const inputStyle: React.CSSProperties = {
    padding: '0.5rem 0.65rem', borderRadius: 8, border: `1px solid ${theme.border}`,
    background: darkMode ? '#0f172a' : '#f8fafc', color: theme.text, fontSize: '0.85rem',
    outline: 'none', boxSizing: 'border-box' as const,
  };
  const activeAlerts = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  return (
    <div>
      {/* Triggered alerts toast */}
      {triggered.map(t => (
        <div key={t.id} style={{
          ...cardStyle, marginBottom: '0.75rem', padding: '0.75rem 1rem',
          background: darkMode ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <CheckCircle size={18} color="#10b981" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>
              🔔 {t.ticker} atingiu R$ {fmt(t.targetPrice)}
            </div>
            <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
              Alerta: preço {t.type === 'above' ? 'acima' : 'abaixo'} de R$ {fmt(t.targetPrice)}
            </div>
          </div>
          <button onClick={() => dismissTriggered(t.id)} style={{
            background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer', padding: 4,
            WebkitAppearance: 'none' as any,
          }}><X size={16} /></button>
        </div>
      ))}

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={18} color="#f59e0b" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: theme.text }}>Alertas de Preço</h3>
            {activeAlerts.length > 0 && (
              <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 10, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 600 }}>
                {activeAlerts.length} ativo{activeAlerts.length !== 1 ? 's' : ''}
              </span>
            )}
            <InfoTooltip text="Crie alertas para ser notificado quando uma ação atingir um preço específico. Os alertas são verificados quando você acessa o dashboard." darkMode={darkMode} size={12} />
          </div>
          <button onClick={() => setShowForm(!showForm)} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem',
            borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
            WebkitAppearance: 'none' as any,
          }}>
            <Plus size={14} /> Novo Alerta
          </button>
        </div>

        {/* Info */}
        <div style={{
          padding: '0.6rem 0.75rem', marginBottom: '0.75rem', borderRadius: 8,
          background: darkMode ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.03)',
          border: `1px solid ${darkMode ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)'}`,
          fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.6,
        }}>
          💡 Defina alertas de preço para suas ações. Quando o preço atingir o valor definido, você será notificado ao acessar o dashboard. Ideal para monitorar stop-loss e take-profit.
        </div>

        {/* New alert form */}
        {showForm && (
          <div style={{
            padding: '0.75rem', marginBottom: '0.75rem', borderRadius: 8,
            border: `1px solid ${theme.border}`, background: darkMode ? '#0f172a' : '#f8fafc',
          }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: theme.text, marginBottom: '0.2rem' }}>Ação</label>
                <select value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
                  style={{ ...inputStyle, width: '100%', WebkitAppearance: 'none' as any, cursor: 'pointer' }}>
                  <option value="">Selecione...</option>
                  {tickers.map(t => (
                    <option key={t.ticker} value={t.ticker}>{t.ticker} (R$ {fmt(t.last_close)})</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '0 0 120px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: theme.text, marginBottom: '0.2rem' }}>Condição</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                  style={{ ...inputStyle, width: '100%', WebkitAppearance: 'none' as any, cursor: 'pointer' }}>
                  <option value="above">↑ Acima de</option>
                  <option value="below">↓ Abaixo de</option>
                </select>
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: theme.text, marginBottom: '0.2rem' }}>Preço (R$)</label>
                <input type="number" step="0.01" value={form.targetPrice}
                  onChange={e => setForm(f => ({ ...f, targetPrice: e.target.value }))}
                  placeholder="0.00" style={{ ...inputStyle, width: '100%' }} />
              </div>
              <button onClick={addAlert} disabled={!form.ticker || !form.targetPrice}
                style={{
                  padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
                  background: form.ticker && form.targetPrice ? '#10b981' : (darkMode ? '#334155' : '#e2e8f0'),
                  color: form.ticker && form.targetPrice ? 'white' : theme.textSecondary,
                  cursor: form.ticker && form.targetPrice ? 'pointer' : 'not-allowed',
                  fontSize: '0.82rem', fontWeight: 600, WebkitAppearance: 'none' as any,
                }}>
                Criar
              </button>
            </div>
          </div>
        )}

        {/* Active alerts */}
        {activeAlerts.length === 0 && triggeredAlerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: theme.textSecondary, fontSize: '0.82rem' }}>
            Nenhum alerta configurado. Clique em "Novo Alerta" para começar.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {activeAlerts.map(a => {
              const current = tickers.find(t => t.ticker === a.ticker)?.last_close;
              const distance = current ? ((a.targetPrice - current) / current * 100) : null;
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.65rem',
                  borderRadius: 8, border: `1px solid ${theme.border}`, flexWrap: 'wrap',
                }}>
                  {a.type === 'above' ? <ArrowUp size={14} color="#10b981" /> : <ArrowDown size={14} color="#ef4444" />}
                  <span style={{ fontWeight: 700, color: theme.text, fontSize: '0.85rem' }}>{a.ticker}</span>
                  <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
                    {a.type === 'above' ? 'acima' : 'abaixo'} de R$ {fmt(a.targetPrice)}
                  </span>
                  {current && distance !== null && (
                    <span style={{
                      fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: 4,
                      background: darkMode ? '#0f172a' : '#f8fafc', color: theme.textSecondary,
                    }}>
                      Atual: R$ {fmt(current)} ({distance >= 0 ? '+' : ''}{fmt(distance, 1)}%)
                    </span>
                  )}
                  <button onClick={() => removeAlert(a.id)} style={{
                    marginLeft: 'auto', background: 'none', border: 'none', color: theme.textSecondary,
                    cursor: 'pointer', padding: 2, opacity: 0.5, WebkitAppearance: 'none' as any,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = theme.textSecondary; }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
            {triggeredAlerts.length > 0 && (
              <>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: theme.textSecondary, marginTop: '0.5rem', textTransform: 'uppercase' }}>
                  Disparados
                </div>
                {triggeredAlerts.map(a => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.65rem',
                    borderRadius: 8, border: `1px solid rgba(16,185,129,0.2)`, opacity: 0.6,
                    background: darkMode ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.02)',
                  }}>
                    <CheckCircle size={14} color="#10b981" />
                    <span style={{ fontWeight: 600, color: theme.text, fontSize: '0.82rem' }}>{a.ticker}</span>
                    <span style={{ fontSize: '0.75rem', color: '#10b981' }}>
                      atingiu R$ {fmt(a.targetPrice)}
                    </span>
                    <button onClick={() => removeAlert(a.id)} style={{
                      marginLeft: 'auto', background: 'none', border: 'none', color: theme.textSecondary,
                      cursor: 'pointer', padding: 2, WebkitAppearance: 'none' as any,
                    }}><Trash2 size={13} /></button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceAlerts;
