import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Users, Crown, RefreshCw, Search, Shield, Clock, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import InfoTooltip from '../../components/shared/InfoTooltip';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }
interface UserItem {
  email: string; name?: string; userId?: string; role?: string;
  plan?: string; planExpiresAt?: string; planSource?: string;
  createdAt?: string; lastLoginAt?: string; emailVerified?: boolean;
  stripeSubscriptionId?: string; enabled?: boolean; planExpired?: boolean;
}

const AdminUsersPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'pro' | 'free'>('all');

  // Set-plan modal state
  const [modalUser, setModalUser] = useState<UserItem | null>(null);
  const [modalPlan, setModalPlan] = useState<'pro' | 'free'>('pro');
  const [modalDuration, setModalDuration] = useState<string>('30');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMsg, setModalMsg] = useState('');
  const [roleLoading, setRoleLoading] = useState<string>(''); // email of user being toggled
  const [deleteLoading, setDeleteLoading] = useState<string>('');

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erro ao carregar usuários');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSetPlan = async () => {
    if (!modalUser) return;
    setModalLoading(true); setModalMsg('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/admin/users/set-plan`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: modalUser.email,
          plan: modalPlan,
          durationDays: modalPlan === 'pro' ? (modalDuration === '0' ? 0 : parseInt(modalDuration)) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro');
      setModalMsg(data.message);
      fetchUsers();
      setTimeout(() => setModalUser(null), 1500);
    } catch (err: any) {
      setModalMsg(err.message);
    } finally { setModalLoading(false); }
  };

  const handleSetRole = async (email: string, newRole: 'admin' | 'viewer') => {
    setRoleLoading(email);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/admin/users/set-role`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally { setRoleLoading(''); }
  };

  const handleDeleteUser = async (email: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário ${email}? Esta ação é irreversível.`)) return;
    setDeleteLoading(email);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/admin/users/delete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally { setDeleteLoading(''); }
  };

  const filtered = users
    .filter(u => !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase()))
    .filter(u => planFilter === 'all' || u.plan === planFilter);

  const totalPro = users.filter(u => u.plan === 'pro').length;
  const totalFree = users.filter(u => u.plan === 'free' || !u.plan).length;

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1836' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1rem',
  };
  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
    border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
    borderRadius: 8, transition: 'all 0.2s', WebkitAppearance: 'none' as any, padding: '0.45rem 0.75rem',
  };

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
    catch { return '—'; }
  };

  const fmtDateTime = (d?: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return '—'; }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={22} /> Usuários
          </h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
            Gerenciar planos e acessos
          </p>
        </div>
        <button onClick={fetchUsers} style={{ ...btnBase, background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', color: 'white' }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {error && <div style={{ ...cardStyle, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', marginBottom: '0.75rem', fontSize: '0.85rem' }}>{error}</div>}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {[
          { label: 'Total', value: users.length, color: '#8b5cf6' },
          { label: 'Pro', value: totalPro, color: '#f59e0b' },
          { label: 'Free', value: totalFree, color: '#9895b0' },
        ].map((k, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ fontSize: '0.65rem', color: theme.textSecondary }}>{k.label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: theme.textSecondary }} />
          <input type="text" placeholder="Buscar email ou nome..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.card || (darkMode ? '#1a1836' : '#fff'), color: theme.text, fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value as any)}
          style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.card || (darkMode ? '#1a1836' : '#fff'), color: theme.text, fontSize: '0.82rem', WebkitAppearance: 'none' as any }}>
          <option value="all">Todos</option>
          <option value="pro">Pro</option>
          <option value="free">Free</option>
        </select>
      </div>

      <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>{filtered.length} usuário{filtered.length !== 1 ? 's' : ''}</div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: theme.textSecondary }}>
          <Loader2 size={24} className="spin" /> <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Carregando...</div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="admin-users-table" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                  {[
                    { l: 'Email', t: '' }, { l: 'Nome', t: '' }, { l: 'Plano', t: 'Plano atual do usuário' },
                    { l: 'Expira', t: 'Data de expiração do plano Pro (se aplicável)' },
                    { l: 'Origem', t: 'Como o plano foi ativado: stripe, admin ou —' },
                    { l: 'Cadastro', t: '' }, { l: 'Último Login', t: '' }, { l: 'Ações', t: '' },
                  ].map(h => (
                    <th key={h.l} style={{ padding: '0.5rem 0.4rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: theme.textSecondary, whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        {h.l} {h.t && <InfoTooltip text={h.t} darkMode={darkMode} size={10} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const isPro = u.plan === 'pro' && !u.planExpired;
                  const isExpiring = isPro && u.planExpiresAt;
                  return (
                    <tr key={u.email} style={{ borderBottom: `1px solid ${theme.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '0.5rem 0.4rem', color: theme.text, fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                        {u.role === 'admin' && <span style={{ marginLeft: 4, fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: 4, background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 600 }}>admin</span>}
                      </td>
                      <td style={{ padding: '0.5rem 0.4rem', color: theme.textSecondary }}>{u.name || '—'}</td>
                      <td style={{ padding: '0.5rem 0.4rem' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '0.15rem 0.45rem', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600,
                          background: isPro ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.15)',
                          color: isPro ? '#f59e0b' : '#9895b0',
                        }}>
                          {isPro ? <Crown size={10} /> : null} {isPro ? 'Pro' : 'Free'}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.4rem', fontSize: '0.75rem', color: isExpiring ? '#f59e0b' : theme.textSecondary }}>
                        {isExpiring ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={10} /> {fmtDate(u.planExpiresAt)}
                          </span>
                        ) : isPro ? '∞' : '—'}
                      </td>
                      <td style={{ padding: '0.5rem 0.4rem', fontSize: '0.72rem', color: theme.textSecondary }}>
                        {u.planSource === 'admin' ? '🔧 Admin' : u.stripeSubscriptionId ? '💳 Stripe' : '—'}
                      </td>
                      <td style={{ padding: '0.5rem 0.4rem', fontSize: '0.72rem', color: theme.textSecondary }}>{fmtDate(u.createdAt)}</td>
                      <td style={{ padding: '0.5rem 0.4rem', fontSize: '0.72rem', color: theme.textSecondary }}>{fmtDateTime(u.lastLoginAt)}</td>
                      <td style={{ padding: '0.5rem 0.4rem' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button onClick={() => { setModalUser(u); setModalPlan(isPro ? 'free' : 'pro'); setModalDuration('30'); setModalMsg(''); }}
                            style={{ ...btnBase, padding: '0.3rem 0.6rem', fontSize: '0.72rem', background: isPro ? 'rgba(148,163,184,0.15)' : 'rgba(245,158,11,0.15)', color: isPro ? '#9895b0' : '#f59e0b' }}>
                            {isPro ? 'Rebaixar' : 'Tornar Pro'}
                          </button>
                          <button onClick={() => handleSetRole(u.email, u.role === 'admin' ? 'viewer' : 'admin')}
                            disabled={roleLoading === u.email}
                            style={{ ...btnBase, padding: '0.3rem 0.6rem', fontSize: '0.72rem', background: u.role === 'admin' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)', color: u.role === 'admin' ? '#ef4444' : '#8b5cf6', opacity: roleLoading === u.email ? 0.5 : 1 }}>
                            {roleLoading === u.email ? <Loader2 size={11} className="spin" /> : <Shield size={11} />}
                            {u.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
                          </button>
                          <button onClick={() => handleDeleteUser(u.email)}
                            disabled={deleteLoading === u.email}
                            style={{ ...btnBase, padding: '0.3rem 0.6rem', fontSize: '0.72rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', opacity: deleteLoading === u.email ? 0.5 : 1 }}>
                            {deleteLoading === u.email ? <Loader2 size={11} className="spin" /> : <Trash2 size={11} />}
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="admin-users-cards" style={{ display: 'none', flexDirection: 'column', gap: '0.5rem' }}>
            {filtered.map(u => {
              const isPro = u.plan === 'pro' && !u.planExpired;
              const isExpiring = isPro && u.planExpiresAt;
              return (
                <div key={u.email} style={{ ...cardStyle, padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', gap: '0.5rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                        {u.role === 'admin' && <span style={{ marginLeft: 4, fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: 4, background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 600 }}>admin</span>}
                      </div>
                      {u.name && <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{u.name}</div>}
                    </div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
                      padding: '0.15rem 0.45rem', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600,
                      background: isPro ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.15)',
                      color: isPro ? '#f59e0b' : '#9895b0',
                    }}>
                      {isPro ? <Crown size={10} /> : null} {isPro ? 'Pro' : 'Free'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', fontSize: '0.72rem', marginBottom: '0.5rem' }}>
                    <div><span style={{ color: theme.textSecondary }}>Expira:</span> <span style={{ color: isExpiring ? '#f59e0b' : theme.textSecondary }}>{isExpiring ? fmtDate(u.planExpiresAt) : isPro ? '∞' : '—'}</span></div>
                    <div><span style={{ color: theme.textSecondary }}>Origem:</span> {u.planSource === 'admin' ? '🔧 Admin' : u.stripeSubscriptionId ? '💳 Stripe' : '—'}</div>
                    <div><span style={{ color: theme.textSecondary }}>Cadastro:</span> {fmtDate(u.createdAt)}</div>
                    <div><span style={{ color: theme.textSecondary }}>Login:</span> {fmtDateTime(u.lastLoginAt)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button onClick={() => { setModalUser(u); setModalPlan(isPro ? 'free' : 'pro'); setModalDuration('30'); setModalMsg(''); }}
                      style={{ ...btnBase, flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.72rem', background: isPro ? 'rgba(148,163,184,0.15)' : 'rgba(245,158,11,0.15)', color: isPro ? '#9895b0' : '#f59e0b' }}>
                      {isPro ? 'Rebaixar' : 'Tornar Pro'}
                    </button>
                    <button onClick={() => handleSetRole(u.email, u.role === 'admin' ? 'viewer' : 'admin')}
                      disabled={roleLoading === u.email}
                      style={{ ...btnBase, flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.72rem', background: u.role === 'admin' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)', color: u.role === 'admin' ? '#ef4444' : '#8b5cf6', opacity: roleLoading === u.email ? 0.5 : 1 }}>
                      {roleLoading === u.email ? <Loader2 size={11} className="spin" /> : <Shield size={11} />}
                      {u.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
                    </button>
                    <button onClick={() => handleDeleteUser(u.email)}
                      disabled={deleteLoading === u.email}
                      style={{ ...btnBase, padding: '0.4rem 0.6rem', fontSize: '0.72rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', opacity: deleteLoading === u.email ? 0.5 : 1 }}>
                      {deleteLoading === u.email ? <Loader2 size={11} className="spin" /> : <Trash2 size={11} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Set Plan Modal */}
      {modalUser && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }} onClick={() => setModalUser(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: theme.card || (darkMode ? '#1a1836' : '#fff'), border: `1px solid ${theme.border}`,
            borderRadius: 16, padding: '1.5rem', zIndex: 1001, width: 'min(420px, 90vw)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: theme.text, margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Shield size={18} color="#f59e0b" /> Alterar Plano
            </h3>
            <div style={{ fontSize: '0.82rem', color: theme.textSecondary, marginBottom: '1rem' }}>
              Usuário: <strong style={{ color: theme.text }}>{modalUser.email}</strong>
              <br />Plano atual: <strong style={{ color: modalUser.plan === 'pro' ? '#f59e0b' : '#9895b0' }}>{modalUser.plan === 'pro' ? 'Pro' : 'Free'}</strong>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: theme.text, display: 'block', marginBottom: '0.3rem' }}>Novo plano</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['pro', 'free'] as const).map(p => (
                  <button key={p} onClick={() => setModalPlan(p)}
                    style={{
                      ...btnBase, flex: 1,
                      background: modalPlan === p ? (p === 'pro' ? 'rgba(245,158,11,0.2)' : 'rgba(148,163,184,0.2)') : 'transparent',
                      color: modalPlan === p ? (p === 'pro' ? '#f59e0b' : '#9895b0') : theme.textSecondary,
                      border: `1.5px solid ${modalPlan === p ? (p === 'pro' ? '#f59e0b' : '#9895b0') : theme.border}`,
                    }}>
                    {p === 'pro' ? <Crown size={14} /> : null} {p === 'pro' ? 'Pro' : 'Free'}
                  </button>
                ))}
              </div>
            </div>

            {modalPlan === 'pro' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: theme.text, display: 'block', marginBottom: '0.3rem' }}>
                  Duração <InfoTooltip text="Após o período, o plano volta automaticamente para Free." darkMode={darkMode} size={11} />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                  {[
                    { value: '30', label: '30 dias' },
                    { value: '60', label: '60 dias' },
                    { value: '90', label: '90 dias' },
                    { value: '0', label: 'Indefinido' },
                  ].map(d => (
                    <button key={d.value} onClick={() => setModalDuration(d.value)}
                      style={{
                        ...btnBase, fontSize: '0.72rem', padding: '0.4rem 0.3rem',
                        background: modalDuration === d.value ? 'rgba(59,130,246,0.15)' : 'transparent',
                        color: modalDuration === d.value ? '#8b5cf6' : theme.textSecondary,
                        border: `1.5px solid ${modalDuration === d.value ? '#8b5cf6' : theme.border}`,
                      }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {modalMsg && (
              <div style={{
                padding: '0.5rem 0.75rem', borderRadius: 8, marginBottom: '0.75rem', fontSize: '0.8rem',
                background: modalMsg.includes('Erro') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                color: modalMsg.includes('Erro') ? '#f87171' : '#10b981',
                border: `1px solid ${modalMsg.includes('Erro') ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
              }}>
                {modalMsg.includes('Erro') ? <XCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> : <CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
                {modalMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalUser(null)} style={{ ...btnBase, background: 'transparent', color: theme.textSecondary, border: `1px solid ${theme.border}` }}>
                Cancelar
              </button>
              <button onClick={handleSetPlan} disabled={modalLoading}
                style={{ ...btnBase, background: modalPlan === 'pro' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #64748b, #475569)', color: 'white', opacity: modalLoading ? 0.7 : 1 }}>
                {modalLoading ? <Loader2 size={14} className="spin" /> : <Shield size={14} />}
                {modalLoading ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
          <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
      )}
    </div>
  );
};

export default AdminUsersPage;
