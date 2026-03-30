import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { theme } from '../../styles';
import { Shield, LogIn, UserX, AlertTriangle, Key, Mail, CreditCard } from 'lucide-react';

interface AuditEvent {
  action: string; timestamp: string; user_id?: string;
  ip?: string; detail?: string;
}

const actionMeta: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  login_success: { icon: <LogIn size={12} />, color: theme.green, label: 'Login' },
  login_failed: { icon: <AlertTriangle size={12} />, color: theme.red, label: 'Login falhou' },
  login_blocked_brute_force: { icon: <UserX size={12} />, color: theme.red, label: 'Brute force bloqueado' },
  email_verified: { icon: <Mail size={12} />, color: theme.green, label: 'Email verificado' },
  password_changed: { icon: <Key size={12} />, color: theme.yellow, label: 'Senha alterada' },
  account_deleted: { icon: <UserX size={12} />, color: theme.red, label: 'Conta excluída' },
  tier_changed: { icon: <CreditCard size={12} />, color: theme.accent, label: 'Plano alterado' },
};

export const AdminAuditPage: React.FC<{ dark?: boolean }> = () => {
  const [limit, setLimit] = useState(100);
  const { data, loading } = useApi<{ events: AuditEvent[] }>(`/admin/audit?limit=${limit}`, 15000);
  const events = data?.events || [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Audit Log</h2>
          <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>{events.length} eventos · Últimas ações do sistema</p>
        </div>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={{
          padding: '0.35rem 0.6rem', borderRadius: 8, border: `1px solid ${theme.border}`,
          background: theme.card, color: theme.text, fontSize: '0.72rem',
        }}>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={250}>250</option>
          <option value={500}>500</option>
        </select>
      </div>

      {loading && !events.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ height: 44, borderRadius: 8, border: `1px solid ${theme.border}`, background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`, backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite ${i * 0.06}s` }} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: theme.textMuted }}>
          <Shield size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
          <p style={{ fontSize: '0.85rem' }}>Nenhum evento registrado.</p>
        </div>
      ) : (
        <div style={{ background: theme.card, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {['Ação', 'Detalhes', 'IP', 'User ID', 'Quando'].map(h => (
                  <th key={h} style={{ padding: '0.55rem 0.75rem', textAlign: 'left', color: theme.textMuted, fontWeight: 600, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => {
                const meta = actionMeta[e.action] || { icon: <Shield size={12} />, color: theme.textMuted, label: e.action };
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${theme.border}`, transition: 'background 0.1s' }}
                    onMouseEnter={ev => ev.currentTarget.style.background = theme.cardHover}
                    onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: meta.color, fontWeight: 600, fontSize: '0.72rem' }}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: theme.textSecondary, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.detail || '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: theme.textMuted, fontFamily: 'monospace', fontSize: '0.68rem' }}>
                      {e.ip || '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: theme.textMuted, fontFamily: 'monospace', fontSize: '0.65rem', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.user_id?.slice(0, 8) || '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: theme.textMuted, fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                      {new Date(e.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
