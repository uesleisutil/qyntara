import React, { useState, useRef, useEffect } from 'react';
import { useApi, apiFetch } from '../hooks/useApi';
import { theme } from '../styles';
import { Bell, CheckCheck, Zap, AlertTriangle, TrendingUp, Info, X } from 'lucide-react';

interface Notification {
  id: string; type: string; title: string; body: string;
  read: boolean; created_at: string; data?: any;
}

interface Props { onNavigate?: (tab: string, data?: any) => void; }

const typeIcons: Record<string, { icon: React.ReactNode; color: string }> = {
  signal: { icon: <Zap size={13} />, color: theme.accent },
  anomaly: { icon: <AlertTriangle size={13} />, color: theme.yellow },
  arbitrage: { icon: <TrendingUp size={13} />, color: theme.green },
  system: { icon: <Info size={13} />, color: theme.blue },
};

export const NotificationCenter: React.FC<Props> = ({ }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, refresh } = useApi<{ notifications: Notification[]; unread_count: number }>(
    '/notifications?limit=20', 15000
  );

  const unread = data?.unread_count || 0;
  const notifs = data?.notifications || [];

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const markRead = async (id: string) => {
    await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
    refresh();
  };

  const markAllRead = async () => {
    await apiFetch('/notifications/read-all', { method: 'POST' });
    refresh();
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
        padding: 4, display: 'flex', alignItems: 'center',
      }} aria-label={`Notificações${unread > 0 ? `, ${unread} não lidas` : ''}`}>
        <Bell size={16} color={open ? theme.accent : theme.textMuted} style={{ transition: 'color 0.15s' }} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0, width: 15, height: 15, borderRadius: '50%',
            background: theme.red, color: '#fff', fontSize: '0.5rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${theme.bg}`,
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: -8, width: 340,
          background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14,
          boxShadow: '0 12px 48px rgba(0,0,0,0.4)', animation: 'fadeIn 0.15s ease',
          zIndex: 300, maxHeight: 440, display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.75rem 1rem', borderBottom: `1px solid ${theme.border}`,
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Notificações</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {unread > 0 && (
                <button onClick={markAllRead} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.65rem', color: theme.accent, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 3,
                }}><CheckCheck size={12} /> Ler todas</button>
              )}
              <button onClick={() => setOpen(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, padding: 2,
              }}><X size={14} /></button>
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: theme.textMuted, fontSize: '0.78rem' }}>
                Nenhuma notificação
              </div>
            ) : (
              notifs.map(n => {
                const t = typeIcons[n.type] || typeIcons.system;
                return (
                  <div key={n.id} onClick={() => { if (!n.read) markRead(n.id); }}
                    style={{
                      display: 'flex', gap: 10, padding: '0.7rem 1rem',
                      borderBottom: `1px solid ${theme.border}`,
                      background: n.read ? 'transparent' : `${theme.accent}05`,
                      cursor: n.read ? 'default' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!n.read) e.currentTarget.style.background = theme.cardHover; }}
                    onMouseLeave={e => { e.currentTarget.style.background = n.read ? 'transparent' : `${theme.accent}05`; }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${t.color}12`, color: t.color,
                    }}>{t.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.78rem', fontWeight: n.read ? 400 : 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{n.title}</div>
                      {n.body && (
                        <div style={{ fontSize: '0.68rem', color: theme.textSecondary, marginTop: 2, lineHeight: 1.4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{n.body}</div>
                      )}
                      <div style={{ fontSize: '0.58rem', color: theme.textMuted, marginTop: 3 }}>
                        {formatTimeAgo(n.created_at)}
                      </div>
                    </div>
                    {!n.read && (
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: theme.accent, flexShrink: 0, marginTop: 6 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
