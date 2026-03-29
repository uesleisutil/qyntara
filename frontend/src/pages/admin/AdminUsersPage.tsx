import React, { useState } from 'react';
import { useApi, apiFetch } from '../../hooks/useApi';
import { theme } from '../../styles';
import {
  Users, Search, Crown, Zap, UserCheck,
  ChevronLeft, ChevronRight, TrendingUp, Star,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

interface UserRow {
  id: string; email: string; name: string; tier: string;
  is_active: number; created_at: string; active_sessions?: number;
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

  const params = new URLSearchParams({
    page: String(page), per_page: '20',
    ...(search && { search }), ...(tierFilter && { tier: tierFilter }),
  });
  const { data: usersData, refresh } = useApi<{ users: UserRow[]; total: number }>(
    `/admin/users?${params}`, 30000
  );
  const { data: stats } = useApi<UserStats>('/admin/users/stats', 60000);

  const users = usersData?.users || [];
  const total = usersData?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const tierColors: Record<string, string> = {
    free: theme.textMuted, pro: theme.accent, quant: theme.yellow, enterprise: theme.green,
  };
  const tierIcons: Record<string, React.ReactNode> = {
    free: <Star size={10} />, pro: <Zap size={10} />, quant: <Crown size={10} />,
  };

  const handleUpdateUser = async (userId: string, updates: Record<string, any>) => {
    await apiFetch(`/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(updates) });
    refresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.4s ease' }}>

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Users size={20} color={theme.accent} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Usuários</h2>
        </div>
        <p style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
          {total} usuário{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {[
            { label: 'Total', value: stats.total_users, icon: <Users size={15} />, color: theme.accent },
            { label: 'Ativos', value: stats.active_users, icon: <UserCheck size={15} />, color: theme.green },
            { label: 'Novos (7d)', value: stats.new_7d, icon: <TrendingUp size={15} />, color: theme.blue },
            { label: 'Novos (30d)', value: stats.new_30d, icon: <TrendingUp size={15} />, color: theme.purple },
            { label: 'Pro', value: stats.by_tier?.pro || 0, icon: <Zap size={15} />, color: theme.accent },
            { label: 'Quant', value: stats.by_tier?.quant || 0, icon: <Crown size={15} />, color: theme.yellow },
          ].map((s, i) => (
            <div key={s.label} style={{
              background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12,
              padding: '0.85rem', borderLeft: `3px solid ${s.color}`,
              animation: `fadeIn 0.3s ease ${i * 0.05}s both`,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = theme.cardHover}
            onMouseLeave={e => e.currentTarget.style.background = theme.card}>
              <div style={{ fontSize: '0.65rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <span style={{ color: s.color }}>{s.icon}</span> {s.label}
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Signups chart */}
      {stats?.daily_signups && stats.daily_signups.length > 0 && (
        <div style={{
          background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14,
          padding: '1.25rem', animation: 'fadeIn 0.4s ease 0.2s both',
        }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '1rem' }}>Cadastros diários (30d)</div>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={stats.daily_signups}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: theme.textMuted }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: theme.textMuted }} width={30} />
              <Tooltip
                contentStyle={{
                  background: theme.card, border: `1px solid ${theme.border}`,
                  borderRadius: 10, fontSize: '0.75rem', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: theme.textSecondary }}
              />
              <Area type="monotone" dataKey="count" name="Cadastros" stroke={theme.accent} fill={`${theme.accent}15`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200,
          padding: '0.6rem 0.85rem', borderRadius: 12,
          border: `1px solid ${searchFocused ? theme.accentBorder : theme.border}`,
          background: theme.card,
          transition: 'all 0.3s ease',
          boxShadow: searchFocused ? `0 0 0 3px ${theme.accent}12` : 'none',
        }}>
          <Search size={14} color={searchFocused ? theme.accent : theme.textMuted} style={{ transition: 'color 0.2s' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar por email ou nome..."
            style={{ border: 'none', outline: 'none', background: 'transparent', color: theme.text, fontSize: '0.82rem', width: '100%', fontFamily: 'inherit' }}
          />
        </div>
        {[
          { key: '', label: 'Todos' },
          { key: 'free', label: 'Free' },
          { key: 'pro', label: 'Pro' },
          { key: 'quant', label: 'Quant' },
        ].map(t => (
          <button key={t.key} onClick={() => { setTierFilter(t.key); setPage(1); }} style={{
            padding: '0.6rem 1rem', borderRadius: 12,
            border: `1px solid ${tierFilter === t.key ? theme.accentBorder : theme.border}`,
            background: tierFilter === t.key ? theme.accentBg : theme.card,
            color: tierFilter === t.key ? theme.accent : theme.textSecondary,
            cursor: 'pointer', fontSize: '0.8rem', fontWeight: tierFilter === t.key ? 600 : 400,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { if (tierFilter !== t.key) e.currentTarget.style.borderColor = theme.borderHover; }}
          onMouseLeave={e => { if (tierFilter !== t.key) e.currentTarget.style.borderColor = theme.border; }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* User table */}
      <div style={{
        background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14,
        overflow: 'hidden', animation: 'fadeIn 0.4s ease 0.1s both',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
              {['Email', 'Nome', 'Plano', 'Status', 'Criado em', 'Ações'].map(h => (
                <th key={h} style={{
                  padding: '0.7rem 0.85rem', textAlign: 'left', color: theme.textMuted,
                  fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{
                borderBottom: `1px solid ${theme.border}`,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = theme.cardHover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '0.7rem 0.85rem', fontWeight: 500 }}>{u.email}</td>
                <td style={{ padding: '0.7rem 0.85rem', color: theme.textSecondary }}>{u.name || '—'}</td>
                <td style={{ padding: '0.7rem 0.85rem' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: '0.65rem', padding: '2px 8px', borderRadius: 6, fontWeight: 700,
                    background: `${tierColors[u.tier] || theme.textMuted}15`,
                    color: tierColors[u.tier] || theme.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.03em',
                  }}>
                    {tierIcons[u.tier]} {u.tier}
                  </span>
                </td>
                <td style={{ padding: '0.7rem 0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: u.is_active ? theme.green : theme.red,
                      boxShadow: u.is_active ? `0 0 6px ${theme.green}40` : undefined,
                    }} />
                    <span style={{ fontSize: '0.7rem', color: u.is_active ? theme.green : theme.red }}>
                      {u.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '0.7rem 0.85rem', color: theme.textSecondary, fontSize: '0.75rem' }}>
                  {new Date(u.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ padding: '0.7rem 0.85rem' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {/* Tier buttons */}
                    {['free', 'pro', 'quant'].map(t => (
                      <button key={t} onClick={() => handleUpdateUser(u.id, { tier: t })}
                        disabled={u.tier === t}
                        style={{
                          padding: '2px 8px', borderRadius: 5, fontSize: '0.62rem', fontWeight: 700,
                          border: `1px solid ${u.tier === t ? (tierColors[t] || theme.textMuted) + '40' : theme.border}`,
                          background: u.tier === t ? `${tierColors[t] || theme.textMuted}15` : 'transparent',
                          color: u.tier === t ? (tierColors[t] || theme.textMuted) : theme.textMuted,
                          cursor: u.tier === t ? 'default' : 'pointer',
                          textTransform: 'uppercase', transition: 'all 0.15s', letterSpacing: '0.03em',
                          opacity: u.tier === t ? 1 : 0.6,
                        }}>{t}</button>
                    ))}
                    {/* Admin toggle */}
                    <button onClick={() => handleUpdateUser(u.id, { is_admin: u.is_active && !(u as any).is_admin ? true : false })}
                      style={{
                        padding: '2px 8px', borderRadius: 5, fontSize: '0.62rem', fontWeight: 700,
                        border: `1px solid ${(u as any).is_admin ? theme.red + '40' : theme.border}`,
                        background: (u as any).is_admin ? theme.redBg : 'transparent',
                        color: (u as any).is_admin ? theme.red : theme.textMuted,
                        cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.15s',
                        opacity: (u as any).is_admin ? 1 : 0.6,
                      }}>{(u as any).is_admin ? '✕ Admin' : '+ Admin'}</button>
                    {/* Active toggle */}
                    {u.is_active ? (
                      <button onClick={() => handleUpdateUser(u.id, { is_active: 0 })} style={{
                        padding: '2px 8px', borderRadius: 5, border: `1px solid ${theme.red}30`,
                        background: 'transparent', color: theme.red, cursor: 'pointer',
                        fontSize: '0.62rem', fontWeight: 600, transition: 'all 0.15s',
                      }}>Desativar</button>
                    ) : (
                      <button onClick={() => handleUpdateUser(u.id, { is_active: 1 })} style={{
                        padding: '2px 8px', borderRadius: 5, border: `1px solid ${theme.green}30`,
                        background: 'transparent', color: theme.green, cursor: 'pointer',
                        fontSize: '0.62rem', fontWeight: 600, transition: 'all 0.15s',
                      }}>Ativar</button>
                    )}
                    {/* Delete user data (LGPD) */}
                    <button onClick={async () => {
                      if (!confirm(`Excluir TODOS os dados de ${u.email}? Esta ação é irreversível.`)) return;
                      await apiFetch(`/admin/users/${u.id}/delete-data`, { method: 'DELETE' });
                      refresh();
                    }} style={{
                      padding: '2px 8px', borderRadius: 5, border: `1px solid ${theme.red}30`,
                      background: 'transparent', color: theme.red, cursor: 'pointer',
                      fontSize: '0.62rem', fontWeight: 600, transition: 'all 0.15s',
                    }}>🗑️ Excluir dados</button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: theme.textMuted }}>
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14,
            padding: '0.85rem', borderTop: `1px solid ${theme.border}`,
          }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              style={{
                background: 'none', border: 'none', cursor: page <= 1 ? 'default' : 'pointer',
                color: page <= 1 ? theme.border : theme.textSecondary,
                transition: 'color 0.2s', padding: 4,
              }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.78rem', color: theme.textSecondary }}>
              Página {page} de {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              style={{
                background: 'none', border: 'none', cursor: page >= totalPages ? 'default' : 'pointer',
                color: page >= totalPages ? theme.border : theme.textSecondary,
                transition: 'color 0.2s', padding: 4,
              }}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
