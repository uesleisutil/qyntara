import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, TrendingUp, Activity, CheckCircle, AlertTriangle, Clock, Send } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';
import { SCORE_BUY_THRESHOLD, SCORE_SELL_THRESHOLD } from '../../constants';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  time: Date;
  read: boolean;
  icon: React.ReactNode;
  color: string;
}

interface NotificationCenterProps {
  darkMode: boolean;
}

const TYPE_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  auto_model_run: { icon: <Activity size={16} />, color: '#3b82f6' },
  auto_recommendations: { icon: <TrendingUp size={16} />, color: '#10b981' },
  auto_strong_signals: { icon: <AlertTriangle size={16} />, color: '#f59e0b' },
  auto_history: { icon: <Clock size={16} />, color: '#8b5cf6' },
  manual: { icon: <Send size={16} />, color: '#3b82f6' },
  system: { icon: <CheckCircle size={16} />, color: '#10b981' },
  recommendations: { icon: <TrendingUp size={16} />, color: '#10b981' },
  model_run: { icon: <Activity size={16} />, color: '#3b82f6' },
  alert: { icon: <AlertTriangle size={16} />, color: '#f59e0b' },
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({ darkMode }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const theme = {
    bg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    hover: darkMode ? '#334155' : '#f1f5f9',
  };

  const generateNotifications = useCallback(async () => {
    const notes: Notification[] = [];
    const now = new Date();
    const readIds = JSON.parse(localStorage.getItem('readNotifications') || '[]');

    // 1. Fetch backend notifications (from DynamoDB via /notifications endpoint)
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
      try {
        const backendRes = await fetch(`${API_BASE_URL}/notifications`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (backendRes.ok) {
          const data = await backendRes.json();
          (data.notifications || []).forEach((n: any) => {
            const typeInfo = TYPE_ICONS[n.type] || TYPE_ICONS.manual;
            notes.push({
              id: `backend-${n.id}`,
              type: n.type,
              title: n.title,
              message: n.message,
              time: new Date(n.created_at),
              read: readIds.includes(`backend-${n.id}`),
              icon: typeInfo.icon,
              color: typeInfo.color,
            });
          });
        }
      } catch { /* silent */ }
    }

    // 2. Fetch live data notifications (from API)
    try {
      const headers = { 'x-api-key': API_KEY };
      const [latestRes, histRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers }),
        fetch(`${API_BASE_URL}/api/recommendations/history`, { headers }),
      ]);

      if (latestRes.ok) {
        const latest = await latestRes.json();
        const recDate = latest.date;
        const recs = latest.recommendations || [];
        const buyCount = recs.filter((r: any) => r.score >= SCORE_BUY_THRESHOLD).length;
        const sellCount = recs.filter((r: any) => r.score <= SCORE_SELL_THRESHOLD).length;
        const topBuy = recs.filter((r: any) => r.score >= SCORE_BUY_THRESHOLD).sort((a: any, b: any) => b.score - a.score)[0];

        notes.push({
          id: `rec-${recDate}`, type: 'recommendations',
          title: 'Recomendações do dia prontas',
          message: `${recs.length} ações analisadas: ${buyCount} compra, ${sellCount} venda${topBuy ? `. Destaque: ${topBuy.ticker} (score ${topBuy.score.toFixed(1)})` : ''}`,
          time: new Date(recDate + 'T09:30:00'), read: readIds.includes(`rec-${recDate}`),
          icon: <TrendingUp size={16} />, color: '#10b981',
        });

        notes.push({
          id: `model-${recDate}`, type: 'model_run',
          title: 'Modelo executado com sucesso',
          message: `Pipeline ML concluído. ${recs.length} previsões geradas para os próximos 20 pregões.`,
          time: new Date(recDate + 'T08:00:00'), read: readIds.includes(`model-${recDate}`),
          icon: <Activity size={16} />, color: '#3b82f6',
        });

        const strongBuys = recs.filter((r: any) => r.score >= 4);
        if (strongBuys.length > 0) {
          notes.push({
            id: `strong-${recDate}`, type: 'alert',
            title: 'Sinais fortes detectados',
            message: `${strongBuys.length} ação(ões) com score acima de 4: ${strongBuys.map((r: any) => r.ticker).join(', ')}`,
            time: new Date(recDate + 'T09:35:00'), read: readIds.includes(`strong-${recDate}`),
            icon: <AlertTriangle size={16} />, color: '#f59e0b',
          });
        }
      }

      if (histRes.ok) {
        const hist = await histRes.json();
        const dates = new Set<string>();
        Object.values(hist.data as Record<string, any[]>).forEach((entries: any[]) =>
          entries.forEach((e: any) => dates.add(e.date))
        );
        const sortedDates = Array.from(dates).sort().reverse();
        if (sortedDates.length >= 2) {
          notes.push({
            id: `history-${sortedDates[0]}`, type: 'system',
            title: 'Dados históricos atualizados',
            message: `${sortedDates.length} dias de histórico disponíveis. Último: ${new Date(sortedDates[0] + 'T12:00:00').toLocaleDateString('pt-BR')}.`,
            time: new Date(sortedDates[0] + 'T07:00:00'), read: readIds.includes(`history-${sortedDates[0]}`),
            icon: <Clock size={16} />, color: '#8b5cf6',
          });
        }
      }
    } catch { /* silent */ }

    // Welcome
    notes.push({
      id: 'welcome', type: 'system',
      title: 'Bem-vindo ao Qyntara',
      message: 'Explore as recomendações, acompanhe safras e analise a explicabilidade do modelo.',
      time: new Date(now.getTime() - 86400000), read: readIds.includes('welcome'),
      icon: <CheckCircle size={16} />, color: '#10b981',
    });

    // Signal change notifications (compare last 2 days from history)
    try {
      const headers = { 'x-api-key': API_KEY };
      const histRes2 = await fetch(`${API_BASE_URL}/api/recommendations/history`, { headers });
      if (histRes2.ok) {
        const histData = await histRes2.json();
        const history: Record<string, { date: string; score: number }[]> = histData.data || {};
        const allDates2 = new Set<string>();
        Object.values(history).forEach(entries => entries.forEach(e => allDates2.add(e.date)));
        const sortedDates2 = Array.from(allDates2).sort();
        if (sortedDates2.length >= 2) {
          const todayD = sortedDates2[sortedDates2.length - 1];
          const yesterdayD = sortedDates2[sortedDates2.length - 2];
          const signalChanges: string[] = [];
          Object.entries(history).forEach(([ticker, entries]) => {
            const t = entries.find(e => e.date === todayD);
            const y = entries.find(e => e.date === yesterdayD);
            if (!t || !y) return;
            const tSig = t.score >= SCORE_BUY_THRESHOLD ? 'Compra' : t.score <= SCORE_SELL_THRESHOLD ? 'Venda' : 'Neutro';
            const ySig = y.score >= SCORE_BUY_THRESHOLD ? 'Compra' : y.score <= SCORE_SELL_THRESHOLD ? 'Venda' : 'Neutro';
            if (tSig !== ySig) signalChanges.push(`${ticker}: ${ySig} → ${tSig}`);
          });
          if (signalChanges.length > 0) {
            notes.push({
              id: `signal-change-${todayD}`, type: 'alert',
              title: `${signalChanges.length} mudança(s) de sinal`,
              message: signalChanges.slice(0, 5).join(', ') + (signalChanges.length > 5 ? ` e mais ${signalChanges.length - 5}` : ''),
              time: new Date(todayD + 'T09:40:00'), read: readIds.includes(`signal-change-${todayD}`),
              icon: <AlertTriangle size={16} />, color: '#f59e0b',
            });
          }
        }
      }
    } catch { /* silent */ }

    // Deduplicate by id
    const seen = new Set<string>();
    const unique = notes.filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; });
    unique.sort((a, b) => b.time.getTime() - a.time.getTime());
    setNotifications(unique);
  }, []);

  useEffect(() => { generateNotifications(); }, [generateNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    const ids = notifications.map(n => n.id);
    localStorage.setItem('readNotifications', JSON.stringify(ids));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    const readIds = JSON.parse(localStorage.getItem('readNotifications') || '[]');
    if (!readIds.includes(id)) { readIds.push(id); localStorage.setItem('readNotifications', JSON.stringify(readIds)); }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const timeAgo = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
        color: theme.textSecondary, padding: 6, borderRadius: 6, transition: 'color 0.15s',
        display: 'flex', alignItems: 'center',
      }}
        onMouseEnter={e => e.currentTarget.style.color = theme.text}
        onMouseLeave={e => e.currentTarget.style.color = theme.textSecondary}
        aria-label="Notificações"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%',
            background: '#ef4444', color: 'white', fontSize: '0.6rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 8999 }} onClick={() => setOpen(false)} />
          <div className="notif-dropdown" style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 8, width: 'min(360px, 90vw)',
            background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 9000, overflow: 'hidden',
          }}>
            <div style={{
              padding: '0.75rem 1rem', borderBottom: `1px solid ${theme.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text }}>Notificações</span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} style={{
                    background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer',
                    fontSize: '0.72rem', fontWeight: 500, padding: 0,
                  }}>Marcar todas como lidas</button>
                )}
                <button onClick={() => setOpen(false)} style={{
                  background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer', padding: 2,
                }}><X size={16} /></button>
              </div>
            </div>

            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: theme.textSecondary, fontSize: '0.85rem' }}>
                  Nenhuma notificação
                </div>
              ) : notifications.map(n => (
                <div key={n.id} onClick={() => markRead(n.id)} style={{
                  padding: '0.7rem 1rem', borderBottom: `1px solid ${theme.border}`,
                  display: 'flex', gap: '0.6rem', cursor: 'pointer',
                  background: n.read ? 'transparent' : (darkMode ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.03)'),
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = theme.hover}
                  onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : (darkMode ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.03)')}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${n.color}15`, color: n.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{n.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: n.read ? 400 : 600, color: theme.text }}>{n.title}</span>
                      {!n.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: 5 }} />}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.4, marginTop: 2 }}>{n.message}</div>
                    <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginTop: 3, opacity: 0.7 }}>{timeAgo(n.time)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;
