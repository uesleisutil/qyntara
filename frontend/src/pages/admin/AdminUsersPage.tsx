import React, { useState } from 'react';
import { useApi, apiFetch } from '../../hooks/useApi';
import { theme } from '../../styles';
import { Users, Search, Crown, Zap, UserCheck, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface UserRow {
  id: string; email: string; name: string; tier: string;
  is_active: number; created_at: string; is_admin?: boolean;
}
interface UserStats {
  total_users: number; active_users: number; new_7d: number; new_30d: number;
  by_tier: Record<string, number>; daily_signups: { date: string; count: number }[];
}

export const AdminUsersPage: React.FC<{ dark?: boolean }> = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const params = new URLSearchParams({ page: String(page), per_page: '20', ...(search && { search }), ...(tierFilter && { tier: tierFilter }) });
  const { data: usersData, refresh } = useApi<{ users: UserRow[]; total: number }>(`/admin/users?${params}`, 30000);
  const { data: stats } = useApi<UserStats>('/admin/users/stats', 60000);

  const users = usersData?.users || [];
  const total = usersData?.total || 0;
  const totalPages = Math.ceil(total / 20);
  const tierColors: Record<string, string> = { free: theme.textMuted, pro: theme.accent, quant: theme.yellow, enterprise: theme.green };

  const handleUpdate = async (userId: string, updates: Record<string, any>) => {
    await apiFetch(`/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(updates) });
    refresh();
  };

  const handleDeleteData = async (userId: string, email: string) => {
    if (!confirm(`Excluir TODOS os dados de ${email}? Irreversível.`)) return;
    await apiFetch(`/admin/users/${userId}/delete-data`, { method: 'DELETE' });
    refresh();
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Usuários</h2>
        <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>{total} cadastrados</p>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: '1.5rem' }}>
          {[
            { l: 'Total', v: stats.total_users, c: theme.accent, ic: <Users size={13} /> },
            { l: 'Ativos', v: stats.active_users, c: theme.green, ic: <UserCheck size={13} /> },
            { l: 'Novos 7d', v: stats.new_7d, c: theme.blue, ic: <TrendingUp size={13} /> },
            { l: 'Novos 30d', v: stats.new_30d, c: theme.purple, ic: <TrendingUp size={13} /> },
            { l: 'Pro', v: stats.by_tier?.pro || 0, c: theme.accent, ic: <Zap size={13} /> },
            { l: 'Quant', v: stats.by_tier?.quant || 0, c: theme.yellow, ic: <Crown size={13} /> },
          ].map((s, i) => (
            <div key={s.l} style={{
              padding: '0.75rem', borderRadius: 10, borderLeft: `3px solid ${s.c}`,
              background: theme.card, transition: 'background 0.15s',
              animation: `fadeIn 0.3s ease ${i * 0.04}s both`,
            }}
            onMouseEnter={e => e.currentTarget.style.background = theme.cardHover}
            onMouseLeave={e => e.currentTarget.style.background = theme.card}>
              <div style={{ fontSize: '0.6rem', color: theme.textMuted, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <span style={{ color: s.c }}>{s.ic}</span> {s.l}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{s.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {stats?.daily_signups && stats.daily_signups.length > 0 && (
        <div style={{ background: theme.card, borderRadius: 12, padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.75rem' }}>Cadastros diários</div>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={stats.daily_signups}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: theme.textMuted }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 9, fill: theme.textMuted }} width={25} />
              <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: '0.72rem' }} />
              <Area type="monotone" dataKey="count" name="Cadastros" stroke={theme.accent} fill={`${theme.accent}12`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 180,
          padding: '0.5rem 0.75rem', borderRadius: 10,
          border: `1px solid ${searchFocused ? theme.accentBorder : theme.border}`,
          background: theme.card, transition: 'border-color 0.2s',
        }}>
          <Search size={13} color={searchFocused ? theme.accent : theme.textMuted} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Buscar email ou nome..."
            style={{ border: 'none', outline: 'none', background: 'transparent', color: theme.text, fontSize: '0.78rem', width: '100%', fontFamily: 'inherit' }} />
        </div>
        {['', 'free', 'pro', 'quant'].map(t => (
          <button key={t} onClick={() => { setTierFilter(t); setPage(1); }} style={{
            padding: '0.5rem 0.8rem', borderRadius: 10, fontSize: '0.72rem',
            border: `1px solid ${tierFilter === t ? theme.accentBorder : theme.border}`,
            background: tierFilter === t ? theme.accentBg : 'transparent',
            color: tierFilter === t ? theme.accent : theme.textMuted,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>{t || 'Todos'}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: theme.card, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
              {['Email', 'Nome', 'Plano', 'Status', 'Criado', 'Ações'].map(h => (
                <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: theme.textMuted, fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${theme.border}`, transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = theme.cardHover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>{u.email}</td>
                <td style={{ padding: '0.6rem 0.75rem', color: theme.textSecondary }}>{u.name || '—'}</td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <span style={{
                    fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                    background: `${tierColors[u.tier] || theme.textMuted}12`,
                    color: tierColors[u.tier] || theme.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>{u.tier}</span>
                </td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block', background: u.is_active ? theme.green : theme.red }} />
                </td>
                <td style={{ padding: '0.6rem 0.75rem', color: theme.textMuted, fontSize: '0.7rem' }}>
                  {new Date(u.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {['free', 'pro', 'quant'].map(t => (
                      <button key={t} onClick={() => handleUpdate(u.id, { tier: t })} disabled={u.tier === t} style={{
                        padding: '1px 6px', borderRadius: 4, fontSize: '0.58rem', fontWeight: 700,
                        border: `1px solid ${u.tier === t ? (tierColors[t]) + '30' : theme.border}`,
                        background: u.tier === t ? `${tierColors[t]}12` : 'transparent',
                        color: u.tier === t ? tierColors[t] : theme.textMuted,
                        cursor: u.tier === t ? 'default' : 'pointer',
                        textTransform: 'uppercase', opacity: u.tier === t ? 1 : 0.5,
                      }}>{t}</button>
                    ))}
                    <button onClick={() => handleUpdate(u.id, { is_admin: !u.is_admin })} style={{
                      padding: '1px 6px', borderRadius: 4, fontSize: '0.58rem', fontWeight: 700,
                      border: `1px solid ${u.is_admin ? theme.red + '30' : theme.border}`,
                      background: u.is_admin ? `${theme.red}12` : 'transparent',
                      color: u.is_admin ? theme.red : theme.textMuted,
                      cursor: 'pointer', opacity: u.is_admin ? 1 : 0.5,
                    }}>{u.is_admin ? '✕ Admin' : '+ Admin'}</button>
                    <button onClick={() => handleUpdate(u.id, { is_active: u.is_active ? 0 : 1 })} style={{
                      padding: '1px 6px', borderRadius: 4, fontSize: '0.58rem', fontWeight: 600,
                      border: `1px solid ${u.is_active ? theme.red + '20' : theme.green + '20'}`,
                      background: 'transparent', color: u.is_active ? theme.red : theme.green,
                      cursor: 'pointer', opacity: 0.6,
                    }}>{u.is_active ? 'Desativar' : 'Ativar'}</button>
                    <button onClick={() => handleDeleteData(u.id, u.email)} style={{
                      padding: '1px 6px', borderRadius: 4, fontSize: '0.58rem', fontWeight: 600,
                      border: `1px solid ${theme.red}20`, background: 'transparent',
                      color: theme.red, cursor: 'pointer', opacity: 0.5,
                    }}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: theme.textMuted }}>Nenhum usuário.</td></tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '0.7rem', borderTop: `1px solid ${theme.border}` }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              style={{ background: 'none', border: 'none', cursor: page <= 1 ? 'default' : 'pointer', color: page <= 1 ? theme.border : theme.textMuted, padding: 4 }}>
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>Página {page} de {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              style={{ background: 'none', border: 'none', cursor: page >= totalPages ? 'default' : 'pointer', color: page >= totalPages ? theme.border : theme.textMuted, padding: 4 }}>
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
