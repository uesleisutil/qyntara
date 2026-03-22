import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Send, Settings, Users, RefreshCw, Edit2, X } from 'lucide-react';
import { API_BASE_URL } from '../../config';

interface Notification {
  id: string; title: string; message: string;
  type: string; target: string; enabled: boolean;
  created_at: string; created_by: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  manual: { label: 'Manual', color: '#3b82f6', icon: '✉️' },
  auto_model_run: { label: 'Modelo Executado', color: '#10b981', icon: '🤖' },
  auto_recommendations: { label: 'Recomendações Prontas', color: '#f59e0b', icon: '📊' },
  auto_strong_signals: { label: 'Sinais Fortes', color: '#ef4444', icon: '🔔' },
  auto_history: { label: 'Histórico Atualizado', color: '#8b5cf6', icon: '📈' },
};

const TARGET_LABELS: Record<string, string> = { all: 'Todos', free: 'Free', pro: 'Pro' };

const AdminNotificationsPage: React.FC = () => {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', message: '', type: 'manual', target: 'all', enabled: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    hover: darkMode ? '#334155' : '#f1f5f9',
  };

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg, border: `1px solid ${theme.border}`,
    borderRadius: 12, padding: 'clamp(0.75rem, 3vw, 1.25rem)',
  };

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
  }), []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/notifications`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      setError('Título e mensagem são obrigatórios');
      return;
    }
    setSaving(true); setError('');
    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { ...form, id: editingId } : form;
      const res = await fetch(`${API_BASE_URL}/admin/notifications`, {
        method, headers: headers(), body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowForm(false); setEditingId(null);
        setForm({ title: '', message: '', type: 'manual', target: 'all', enabled: true });
        fetchNotifications();
      } else {
        const data = await res.json();
        setError(data.message || 'Erro ao salvar');
      }
    } catch { setError('Erro de conexão'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (notif: Notification) => {
    try {
      await fetch(`${API_BASE_URL}/admin/notifications`, {
        method: 'PUT', headers: headers(),
        body: JSON.stringify({ id: notif.id, enabled: !notif.enabled }),
      });
      fetchNotifications();
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remover esta notificação?')) return;
    try {
      await fetch(`${API_BASE_URL}/admin/notifications`, {
        method: 'DELETE', headers: headers(),
        body: JSON.stringify({ id }),
      });
      fetchNotifications();
    } catch { /* silent */ }
  };

  const handleEdit = (notif: Notification) => {
    setForm({ title: notif.title, message: notif.message, type: notif.type, target: notif.target, enabled: notif.enabled });
    setEditingId(notif.id);
    setShowForm(true);
  };

  const autoNotifs = notifications.filter(n => n.type.startsWith('auto_'));
  const manualNotifs = notifications.filter(n => n.type === 'manual');

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.75rem', backgroundColor: theme.bg,
    border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text,
    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bell size={22} color="#3b82f6" />
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, margin: 0 }}>
            Gerenciar Notificações
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={fetchNotifications} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.75rem',
            borderRadius: 8, border: `1px solid ${theme.border}`, background: 'transparent',
            color: theme.textSecondary, cursor: 'pointer', fontSize: '0.8rem',
          }}><RefreshCw size={14} /> Atualizar</button>
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ title: '', message: '', type: 'manual', target: 'all', enabled: true }); }} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.75rem',
            borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            color: 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
          }}><Plus size={14} /> Nova Notificação</button>
        </div>
      </div>

      <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
        Gerencie notificações automáticas e manuais. Notificações automáticas são exibidas quando eventos ocorrem. Manuais são enviadas uma vez para os usuários selecionados.
      </p>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div style={{ ...cardStyle, marginBottom: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: theme.text }}>
              {editingId ? 'Editar Notificação' : 'Nova Notificação'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{
              background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer',
            }}><X size={18} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: theme.text, marginBottom: '0.3rem' }}>Tipo</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
                <option value="manual">✉️ Manual (envio único)</option>
                <option value="auto_model_run">🤖 Auto: Modelo Executado</option>
                <option value="auto_recommendations">📊 Auto: Recomendações Prontas</option>
                <option value="auto_strong_signals">🔔 Auto: Sinais Fortes</option>
                <option value="auto_history">📈 Auto: Histórico Atualizado</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: theme.text, marginBottom: '0.3rem' }}>Público-alvo</label>
              <select value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} style={inputStyle}>
                <option value="all">👥 Todos os usuários</option>
                <option value="free">🆓 Apenas Free</option>
                <option value="pro">👑 Apenas Pro</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: theme.text, marginBottom: '0.3rem' }}>Título</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Recomendações do dia prontas" style={inputStyle} />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: theme.text, marginBottom: '0.3rem' }}>Mensagem</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Descrição da notificação..." rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {error && <div style={{ padding: '0.5rem', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleSave} disabled={saving} style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.6rem 1.25rem',
              borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600,
            }}>
              {saving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
              {editingId ? 'Salvar' : 'Criar'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{
              padding: '0.6rem 1rem', borderRadius: 8, border: `1px solid ${theme.border}`,
              background: 'transparent', color: theme.textSecondary, cursor: 'pointer', fontSize: '0.85rem',
            }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: theme.textSecondary }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> Carregando...
        </div>
      ) : (
        <>
          {/* Automated Notifications */}
          <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Settings size={18} color="#10b981" />
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: theme.text }}>Notificações Automáticas</h2>
              <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 10, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600 }}>
                {autoNotifs.filter(n => n.enabled).length}/{autoNotifs.length} ativas
              </span>
            </div>
            {autoNotifs.length === 0 ? (
              <p style={{ color: theme.textSecondary, fontSize: '0.85rem', margin: 0 }}>
                Nenhuma notificação automática configurada. Crie uma para que os usuários sejam notificados automaticamente quando eventos ocorrerem.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {autoNotifs.map(n => {
                  const typeInfo = TYPE_LABELS[n.type] || TYPE_LABELS.manual;
                  return (
                    <div key={n.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem',
                      borderRadius: 8, border: `1px solid ${theme.border}`,
                      opacity: n.enabled ? 1 : 0.5, flexWrap: 'wrap',
                    }}>
                      <span style={{ fontSize: '1.2rem' }}>{typeInfo.icon}</span>
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>{n.title}</div>
                        <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: 2 }}>{n.message}</div>
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 4, background: `${typeInfo.color}15`, color: typeInfo.color }}>{typeInfo.label}</span>
                          <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 4, background: darkMode ? '#334155' : '#f1f5f9', color: theme.textSecondary }}>
                            <Users size={9} style={{ verticalAlign: 'middle', marginRight: 2 }} />{TARGET_LABELS[n.target]}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <button onClick={() => handleToggle(n)} title={n.enabled ? 'Desativar' : 'Ativar'} style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: n.enabled ? '#10b981' : theme.textSecondary, padding: 4,
                        }}>
                          {n.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                        </button>
                        <button onClick={() => handleEdit(n)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary, padding: 4 }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manual Notifications */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Send size={18} color="#3b82f6" />
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: theme.text }}>Notificações Manuais</h2>
              <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 10, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: 600 }}>
                {manualNotifs.length}
              </span>
            </div>
            {manualNotifs.length === 0 ? (
              <p style={{ color: theme.textSecondary, fontSize: '0.85rem', margin: 0 }}>
                Nenhuma notificação manual enviada. Use o botão "Nova Notificação" para criar uma.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {manualNotifs.map(n => (
                  <div key={n.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem',
                    borderRadius: 8, border: `1px solid ${theme.border}`,
                    opacity: n.enabled ? 1 : 0.5, flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>✉️</span>
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>{n.title}</div>
                      <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: 2 }}>{n.message}</div>
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 4, background: darkMode ? '#334155' : '#f1f5f9', color: theme.textSecondary }}>
                          <Users size={9} style={{ verticalAlign: 'middle', marginRight: 2 }} />{TARGET_LABELS[n.target]}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>
                          {new Date(n.created_at).toLocaleDateString('pt-BR')} por {n.created_by}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <button onClick={() => handleToggle(n)} title={n.enabled ? 'Desativar' : 'Ativar'} style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: n.enabled ? '#10b981' : theme.textSecondary, padding: 4,
                      }}>
                        {n.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                      <button onClick={() => handleEdit(n)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary, padding: 4 }}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminNotificationsPage;
