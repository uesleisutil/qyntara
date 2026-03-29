import React, { useState } from 'react';
import { useApi, apiFetch } from '../../hooks/useApi';
import {
  Users, Search, Shield, Crown, Zap, UserCheck, UserX,
  ChevronLeft, ChevronRight, TrendingUp,
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

export const AdminUsersPage: React.FC<{ dark: boolean }> = ({ dark }) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);

  const params = new URLSearchParams({
    page: String(page), per_page: '20',
    ...(search && { search }), ...(tierFilter && { tier: tierFilter }),
  });
  const { data: usersData, refresh } = useApi<{ users: UserRow[]; total: number }>(
    `/admin/users?${params}`, 30000
  );
  const { data: stats } = useApi<UserStats>('/admin/users/stats', 60000);

  const card = dark ? '#12141c' : '#fff';
  const border = dark ? '#1e2130' : '#e2e8f0';
  const textSec = dark ? '#8892a4' : '#64748b';
  const text = dark ? '#e2e8f0' : '#1a202c';

  const users = usersData?.users || [];
  const total = usersData?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const tierColors: Record<string, string> = {
    free: '#6b7280', pro: '#6366f1', quant: '#f59e0b', enterprise: '#10b981',
  };

  const handleUpdateUser = async (userId: string, updates: Record<string, any>) => {
    await apiFetch(`/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(updates) });
    refresh();
    setEditingUser(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Stats cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {[
            { label: 'Total Users', value: stats.total_users, icon: <Users size={16} />, color: '#6366f1' },
            { label: 'Active', value: stats.active_users, icon: <UserCheck size={16} />, color: '#10b981' },
            { label: 'New (7d)', value: stats.new_7d, icon: <TrendingUp size={16} />, color: '#3b82f6' },
            { label: 'New (30d)', value: stats.new_30d, icon: <TrendingUp size={16} />, color: '#8b5cf6' },
            { label: 'Pro', value: stats.by_tier?.pro || 0, icon: <Zap size={16} />, color: '#6366f1' },
            { label: 'Quant', value: stats.by_tier?.quant || 0, icon: <Crown size={16} />, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{
              background: card, border: `1px solid ${border}`, borderRadius: 10,
              padding: '0.75rem', borderLeft: `3px solid ${s.color}`,
            }}>
              <div style={{ fontSize: '0.65rem', color: textSec, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                {s.icon} {s.label}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Signups chart */}
      {stats?.daily_signups && stats.daily_signups.length > 0 && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.75rem' }}>Daily Signups (30d)</div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={stats.daily_signups}>
              <CartesianGrid strokeDasharray="3 3" stroke={border} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: textSec }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: textSec }} width={30} />
              <Tooltip contentStyle={{ background: card, border: `1px solid ${border}`, borderRadius: 8, fontSize: '0.75rem' }} />
              <Area type="monotone" dataKey="count" stroke="#6366f1" fill="#6366f120" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200,
          padding: '0.5rem 0.75rem', borderRadius: 8, border: `1px solid ${border}`, background: card,
        }}>
          <Search size={14} color={textSec} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by email or name..."
            style={{ border: 'none', outline: 'none', background: 'transparent', color: text, fontSize: '0.82rem', width: '100%' }}
          />
        </div>
        {['', 'free', 'pro', 'quant'].map(t => (
          <button key={t} onClick={() => { setTierFilter(t); setPage(1); }} style={{
            padding: '0.5rem 0.75rem', borderRadius: 8, border: `1px solid ${border}`,
            background: tierFilter === t ? '#6366f118' : card, color: tierFilter === t ? '#6366f1' : textSec,
            cursor: 'pointer', fontSize: '0.78rem',
          }}>{t || 'All'}</button>
        ))}
      </div>

      {/* User table */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${border}` }}>
              {['Email', 'Name', 'Tier', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: textSec, fontWeight: 600, fontSize: '0.7rem' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${border}` }}>
                <td style={{ padding: '0.6rem 0.75rem' }}>{u.email}</td>
                <td style={{ padding: '0.6rem 0.75rem', color: textSec }}>{u.name || '—'}</td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <span style={{
                    fontSize: '0.65rem', padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                    background: `${tierColors[u.tier] || '#6b7280'}18`,
                    color: tierColors[u.tier] || '#6b7280',
                    textTransform: 'uppercase',
                  }}>{u.tier}</span>
                </td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                    background: u.is_active ? '#10b981' : '#ef4444',
                  }} />
                </td>
                <td style={{ padding: '0.6rem 0.75rem', color: textSec, fontSize: '0.72rem' }}>
                  {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {u.is_active ? (
                      <button onClick={() => handleUpdateUser(u.id, { is_active: 0 })}
                        style={{ padding: '2px 8px', borderRadius: 4, border: `1px solid #ef444440`, background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.68rem' }}>
                        Disable
                      </button>
                    ) : (
                      <button onClick={() => handleUpdateUser(u.id, { is_active: 1 })}
                        style={{ padding: '2px 8px', borderRadius: 4, border: `1px solid #10b98140`, background: 'transparent', color: '#10b981', cursor: 'pointer', fontSize: '0.68rem' }}>
                        Enable
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '0.75rem' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: page <= 1 ? border : textSec }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.75rem', color: textSec }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: page >= totalPages ? border : textSec }}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
