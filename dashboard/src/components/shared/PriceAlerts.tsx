import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, X, CheckCircle } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';

const ALERTS_KEY = 'b3tr_price_alerts';
interface PriceAlert { id: string; ticker: string; type: 'above' | 'below'; targetPrice: number; createdAt: string; triggered: boolean; }
function getAlerts(): PriceAlert[] { try { return JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]'); } catch { return []; } }
function saveAlerts(a: PriceAlert[]) { localStorage.setItem(ALERTS_KEY, JSON.stringify(a)); }

interface Props { darkMode: boolean; theme: Record<string, string>; }
const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

const PriceAlerts: React.FC<Props> = ({ darkMode, theme }) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [tickers, setTickers] = useState<{ ticker: string; last_close: number }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ticker: '', type: 'above' as 'above' | 'below', targetPrice: '' });
  const [triggered, setTriggered] = useState<PriceAlert[]>([]);

  useEffect(() => { setAlerts(getAlerts()); }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers: { 'x-api-key': API_KEY } });
        if (res.ok) {
          const data = await res.json();
          setTickers((data.recommendations || []).map((r: any) => ({ ticker: r.ticker, last_close: r.last_close })));
        }
      } catch {}
    })();
  }, []);

  const checkAlerts = useCallback(() => {
    const cur = getAlerts();
    const fired: PriceAlert[] = [];
    let changed = false;
    cur.forEach(a => {
      if (a.triggered) return;
      const price = tickers.find(t => t.ticker === a.ticker)?.last_close;
      if (!price) return;
      if ((a.type === 'above' && price >= a.targetPrice) || (a.type === 'below' && price <= a.targetPrice)) {
        a.triggered = true; fired.push(a); changed = true;
      }
    });
    if (changed) { saveAlerts(cur); setAlerts([...cur]); }
    if (fired.length) setTriggered(p => [...p, ...fired]);
  }, [tickers]);

  useEffect(() => { if (tickers.length) checkAlerts(); }, [tickers, checkAlerts]);

  const add = () => {
    if (!form.ticker || !form.targetPrice) return;
    const n: PriceAlert = { id: Date.now().toString(36), ticker: form.ticker, type: form.type, targetPrice: parseFloat(form.targetPrice), createdAt: new Date().toISOString(), triggered: false };
    const u = [...alerts, n]; saveAlerts(u); setAlerts(u);
    setForm({ ticker: '', type: 'above', targetPrice: '' }); setShowForm(false);
  };

  const remove = (id: string) => { const u = alerts.filter(a => a.id !== id); saveAlerts(u); setAlerts(u); };

  const active = alerts.filter(a => !a.triggered);
  const done = alerts.filter(a => a.triggered);
  const inputS: React.CSSProperties = {
    padding: '0.4rem 0.5rem', borderRadius: 6, border: `1px solid ${theme.border}`,
    background: darkMode ? '#0c0a1a' : '#f8fafc', color: theme.text, fontSize: '0.8rem', outline: 'none',
  };

  return (
    <div>
      {/* Triggered toasts */}
      {triggered.map(t => (
        <div key={t.id} style={{
          marginBottom: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 8,
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
          display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem',
        }}>
          <CheckCircle size={14} color="#10b981" />
          <span style={{ color: theme.text, fontWeight: 600 }}>{t.ticker}</span>
          <span style={{ color: theme.textSecondary }}>atingiu R$ {fmt(t.targetPrice)}</span>
          <button onClick={() => setTriggered(p => p.filter(x => x.id !== t.id))} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer', padding: 2 }}>
            <X size={13} />
          </button>
        </div>
      ))}

      {/* Add button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <button onClick={() => setShowForm(!showForm)} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '0.35rem 0.65rem',
          borderRadius: 6, border: 'none', background: '#8b5cf6', color: 'white',
          cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
        }}>
          <Plus size={13} /> Novo
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem', alignItems: 'flex-end' }}>
          <select value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
            style={{ ...inputS, flex: '1 1 100px' }}>
            <option value="">Ação</option>
            {tickers.map(t => <option key={t.ticker} value={t.ticker}>{t.ticker}</option>)}
          </select>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
            style={{ ...inputS, flex: '0 0 90px' }}>
            <option value="above">↑ Acima</option>
            <option value="below">↓ Abaixo</option>
          </select>
          <input type="number" step="0.01" value={form.targetPrice}
            onChange={e => setForm(f => ({ ...f, targetPrice: e.target.value }))}
            placeholder="R$" style={{ ...inputS, flex: '1 1 70px' }} />
          <button onClick={add} disabled={!form.ticker || !form.targetPrice} style={{
            padding: '0.4rem 0.7rem', borderRadius: 6, border: 'none',
            background: form.ticker && form.targetPrice ? '#10b981' : (darkMode ? '#2a2745' : '#e2e8f0'),
            color: form.ticker && form.targetPrice ? 'white' : theme.textSecondary,
            cursor: form.ticker && form.targetPrice ? 'pointer' : 'not-allowed',
            fontSize: '0.78rem', fontWeight: 600,
          }}>OK</button>
        </div>
      )}

      {/* List */}
      {active.length === 0 && done.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '0.75rem', color: theme.textSecondary, fontSize: '0.78rem' }}>
          Nenhum alerta configurado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {active.map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.25rem',
              borderRadius: 6, fontSize: '0.8rem',
            }}>
              {a.type === 'above' ? <ArrowUp size={12} color="#10b981" /> : <ArrowDown size={12} color="#ef4444" />}
              <span style={{ fontWeight: 700, color: theme.text }}>{a.ticker}</span>
              <span style={{ color: theme.textSecondary, fontSize: '0.75rem' }}>R$ {fmt(a.targetPrice)}</span>
              <button onClick={() => remove(a.id)} style={{
                marginLeft: 'auto', background: 'none', border: 'none', color: theme.textSecondary,
                cursor: 'pointer', padding: 2, opacity: 0.4,
              }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.color = theme.textSecondary; }}
              ><Trash2 size={12} /></button>
            </div>
          ))}
          {done.map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.25rem',
              borderRadius: 6, fontSize: '0.78rem', opacity: 0.5,
            }}>
              <CheckCircle size={12} color="#10b981" />
              <span style={{ fontWeight: 600, color: theme.text }}>{a.ticker}</span>
              <span style={{ color: '#10b981' }}>R$ {fmt(a.targetPrice)}</span>
              <button onClick={() => remove(a.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer', padding: 2 }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PriceAlerts;
