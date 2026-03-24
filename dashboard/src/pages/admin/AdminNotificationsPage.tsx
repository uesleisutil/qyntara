import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, ToggleLeft, ToggleRight, Send, Settings, Users, RefreshCw, Edit2, X, MessageCircle, Phone, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import InfoTooltip from '../../components/shared/ui/InfoTooltip';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

interface Notification {
  id: string; title: string; message: string;
  type: string; target: string; enabled: boolean;
  created_at: string; created_by: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  manual: { label: 'Manual', color: '#8b5cf6', icon: '✉️' },
  auto_model_run: { label: 'Modelo Executado', color: '#10b981', icon: '🤖' },
  auto_recommendations: { label: 'Recomendações Prontas', color: '#f59e0b', icon: '📊' },
  auto_strong_signals: { label: 'Sinais Fortes', color: '#ef4444', icon: '🔔' },
  auto_history: { label: 'Histórico Atualizado', color: '#8b5cf6', icon: '📈' },
};

const TARGET_LABELS: Record<string, string> = { all: 'Todos', free: 'Free', pro: 'Pro' };

const AdminNotificationsPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', message: '', type: 'manual', target: 'all', enabled: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [whatsappMsg, setWhatsappMsg] = useState('');
  const [whatsappTarget, setWhatsappTarget] = useState('pro');
  const [whatsappSending, setWhatsappSending] = useState(false);
  const [whatsappResult, setWhatsappResult] = useState<{ phones: string[]; message: string } | null>(null);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e1b40' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12,
    padding: 'clamp(0.75rem, 3vw, 1.25rem)',
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
    width: '100%', padding: '0.6rem 0.75rem', backgroundColor: darkMode ? '#0e0c1e' : '#f8fafc',
    border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text,
    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' as const,
  };

  if (loading) {
    const sk: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1e1b40' : '#e2e8f0'} 25%, ${darkMode ? '#363258' : '#f1f5f9'} 50%, ${darkMode ? '#1e1b40' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ ...sk, height: 28, width: 240, marginBottom: 8 }} />
          <div style={{ ...sk, height: 16, width: 360 }} />
        </div>
        <div style={{ ...sk, height: 52, marginBottom: '1rem', borderRadius: 12 }} />
        {[1,2,3].map(i => (
          <div key={i} style={{ ...sk, height: 72, marginBottom: 8, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  const renderNotifCard = (n: Notification) => {
    const typeInfo = TYPE_LABELS[n.type] || TYPE_LABELS.manual;
    return (
      <div key={n.id} style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem',
        borderRadius: 8, border: `1px solid ${theme.border}`,
        opacity: n.enabled ? 1 : 0.5, flexWrap: 'wrap',
        transition: 'background 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.03)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ fontSize: '1.2rem' }}>{typeInfo.icon}</span>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>{n.title}</div>
          <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: 2 }}>{n.message}</div>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 4, background: `${typeInfo.color}15`, color: typeInfo.color }}>{typeInfo.label}</span>
            <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 4, background: darkMode ? '#363258' : '#f1f5f9', color: theme.textSecondary }}>
              <Users size={9} style={{ verticalAlign: 'middle', marginRight: 2 }} />{TARGET_LABELS[n.target]}
            </span>
            {n.created_at && (
              <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>
                {new Date(n.created_at).toLocaleDateString('pt-BR')} {n.created_by ? `por ${n.created_by}` : ''}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <button onClick={() => handleToggle(n)} title={n.enabled ? 'Desativar' : 'Ativar'} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: n.enabled ? '#10b981' : theme.textSecondary, padding: 4, WebkitAppearance: 'none' as any,
          }}>
            {n.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          </button>
          <button onClick={() => handleEdit(n)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary, padding: 4, WebkitAppearance: 'none' as any }}>
            <Edit2 size={14} />
          </button>
          <button onClick={() => handleDelete(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, WebkitAppearance: 'none' as any }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🔔 Gerenciar Notificações
          </h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0 }}>
            Gerencie notificações automáticas e manuais para os usuários
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={fetchNotifications} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.75rem',
            borderRadius: 8, border: `1px solid ${theme.border}`, background: 'transparent',
            color: theme.textSecondary, cursor: 'pointer', fontSize: '0.8rem', WebkitAppearance: 'none' as any,
          }}><RefreshCw size={14} /> Atualizar</button>
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ title: '', message: '', type: 'manual', target: 'all', enabled: true }); }} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.75rem',
            borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
            color: 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
            boxShadow: '0 2px 8px rgba(124,58,237,0.25)', WebkitAppearance: 'none' as any,
          }}><Plus size={14} /> Nova Notificação</button>
        </div>
      </div>

      {/* How it works */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem',
        background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
        borderColor: darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
      }}>
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
          💡 <strong style={{ color: theme.text }}>Como funciona:</strong> Notificações <strong style={{ color: theme.text }}>automáticas</strong> são exibidas quando eventos ocorrem (modelo executado, recomendações prontas, etc.). Notificações <strong style={{ color: theme.text }}>manuais</strong> são enviadas uma vez para os usuários selecionados. Use o toggle para ativar/desativar sem excluir.
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div style={{ ...cardStyle, marginBottom: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: theme.text }}>
              {editingId ? 'Editar Notificação' : 'Nova Notificação'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{
              background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer', WebkitAppearance: 'none' as any,
            }}><X size={18} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: theme.text, marginBottom: '0.3rem' }}>
                Tipo <InfoTooltip text="Manual = envio único. Auto = exibida automaticamente quando o evento ocorre." darkMode={darkMode} size={11} />
              </label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ ...inputStyle, WebkitAppearance: 'none' as any, cursor: 'pointer' }}>
                <option value="manual">✉️ Manual (envio único)</option>
                <option value="auto_model_run">🤖 Auto: Modelo Executado</option>
                <option value="auto_recommendations">📊 Auto: Recomendações Prontas</option>
                <option value="auto_strong_signals">🔔 Auto: Sinais Fortes</option>
                <option value="auto_history">📈 Auto: Histórico Atualizado</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: theme.text, marginBottom: '0.3rem' }}>
                Público-alvo <InfoTooltip text="Escolha quem receberá a notificação: todos, apenas Free ou apenas Pro." darkMode={darkMode} size={11} />
              </label>
              <select value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} style={{ ...inputStyle, WebkitAppearance: 'none' as any, cursor: 'pointer' }}>
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
              borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
              color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600,
              WebkitAppearance: 'none' as any,
            }}>
              {saving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
              {editingId ? 'Salvar' : 'Criar'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{
              padding: '0.6rem 1rem', borderRadius: 8, border: `1px solid ${theme.border}`,
              background: 'transparent', color: theme.textSecondary, cursor: 'pointer', fontSize: '0.85rem',
              WebkitAppearance: 'none' as any,
            }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Automated Notifications */}
      <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Settings size={18} color="#10b981" />
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: theme.text }}>Notificações Automáticas</h2>
          <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 10, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600 }}>
            {autoNotifs.filter(n => n.enabled).length}/{autoNotifs.length} ativas
          </span>
          <InfoTooltip text="Notificações disparadas automaticamente quando eventos do sistema ocorrem. Ative/desative sem excluir." darkMode={darkMode} size={12} />
        </div>
        {autoNotifs.length === 0 ? (
          <p style={{ color: theme.textSecondary, fontSize: '0.85rem', margin: 0 }}>
            Nenhuma notificação automática configurada. Crie uma para que os usuários sejam notificados automaticamente.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {autoNotifs.map(renderNotifCard)}
          </div>
        )}
      </div>

      {/* Manual Notifications */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Send size={18} color="#8b5cf6" />
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: theme.text }}>Notificações Manuais</h2>
          <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 10, background: 'rgba(59,130,246,0.1)', color: '#8b5cf6', fontWeight: 600 }}>
            {manualNotifs.length}
          </span>
          <InfoTooltip text="Notificações enviadas manualmente uma vez. Útil para comunicados, avisos de manutenção, etc." darkMode={darkMode} size={12} />
        </div>
        {manualNotifs.length === 0 ? (
          <p style={{ color: theme.textSecondary, fontSize: '0.85rem', margin: 0 }}>
            Nenhuma notificação manual enviada. Use o botão "Nova Notificação" para criar uma.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {manualNotifs.map(renderNotifCard)}
          </div>
        )}
      </div>

      {/* WhatsApp Alerts */}
      <div style={{ ...cardStyle, marginTop: '1.25rem', borderLeft: '4px solid #25d366' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <MessageCircle size={18} color="#25d366" />
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: theme.text }}>Alertas WhatsApp</h2>
          <InfoTooltip text="Envie mensagens via WhatsApp para usuários Pro que ativaram alertas. O sistema gera links de envio para cada destinatário." darkMode={darkMode} size={12} />
        </div>

        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: 8,
          background: darkMode ? 'rgba(37,211,102,0.08)' : 'rgba(37,211,102,0.04)',
          border: `1px solid ${darkMode ? 'rgba(37,211,102,0.2)' : 'rgba(37,211,102,0.15)'}`,
        }}>
          <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
            💡 <strong style={{ color: theme.text }}>Como funciona:</strong> Escreva a mensagem, selecione o público e clique em "Buscar Destinatários". O sistema retorna os números dos usuários que ativaram alertas WhatsApp. Clique no link de cada número para enviar via WhatsApp Web.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: theme.text, marginBottom: '0.3rem' }}>
              Público-alvo
            </label>
            <select value={whatsappTarget} onChange={e => setWhatsappTarget(e.target.value)} style={{ ...inputStyle, WebkitAppearance: 'none' as any, cursor: 'pointer' }}>
              <option value="pro">👑 Apenas Pro</option>
              <option value="all">👥 Todos com WhatsApp ativo</option>
              <option value="free">🆓 Apenas Free</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: theme.text, marginBottom: '0.3rem' }}>
            Mensagem
          </label>
          <textarea
            value={whatsappMsg} onChange={e => setWhatsappMsg(e.target.value)}
            placeholder="Ex: 🚀 Novas recomendações disponíveis! Acesse o dashboard para ver os sinais de hoje."
            rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <button
          onClick={async () => {
            if (!whatsappMsg.trim()) return;
            setWhatsappSending(true); setWhatsappResult(null);
            try {
              const res = await fetch(`${API_BASE_URL}/admin/whatsapp`, {
                method: 'POST', headers: headers(),
                body: JSON.stringify({ message: whatsappMsg, target: whatsappTarget }),
              });
              if (res.ok) {
                const data = await res.json();
                setWhatsappResult({ phones: data.phones || [], message: data.whatsappMessage || whatsappMsg });
              }
            } catch { /* silent */ }
            finally { setWhatsappSending(false); }
          }}
          disabled={whatsappSending || !whatsappMsg.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.6rem 1.25rem',
            borderRadius: 8, border: 'none',
            background: whatsappMsg.trim() && !whatsappSending ? 'linear-gradient(135deg, #25d366, #128c7e)' : (darkMode ? '#363258' : '#e2e8f0'),
            color: whatsappMsg.trim() && !whatsappSending ? 'white' : theme.textSecondary,
            cursor: whatsappMsg.trim() && !whatsappSending ? 'pointer' : 'not-allowed',
            fontSize: '0.85rem', fontWeight: 600, WebkitAppearance: 'none' as any,
          }}
        >
          <Phone size={14} /> {whatsappSending ? 'Buscando...' : 'Buscar Destinatários'}
        </button>

        {whatsappResult && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem' }}>
              {whatsappResult.phones.length > 0
                ? `✅ ${whatsappResult.phones.length} destinatário(s) encontrado(s):`
                : '⚠️ Nenhum usuário com WhatsApp ativo encontrado para este público.'}
            </div>
            {whatsappResult.phones.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {whatsappResult.phones.map((ph, i) => {
                  const cleanNum = ph.replace(/\D/g, '');
                  const waUrl = `https://wa.me/${cleanNum}?text=${encodeURIComponent(whatsappResult.message)}`;
                  return (
                    <a key={i} href={waUrl} target="_blank" rel="noopener noreferrer" style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem',
                      borderRadius: 8, border: `1px solid ${theme.border}`, textDecoration: 'none',
                      color: theme.text, fontSize: '0.82rem', transition: 'background 0.15s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(37,211,102,0.1)' : 'rgba(37,211,102,0.05)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <MessageCircle size={16} color="#25d366" />
                      <span style={{ fontFamily: 'monospace' }}>{ph}</span>
                      <ExternalLink size={12} color={theme.textSecondary} style={{ marginLeft: 'auto' }} />
                    </a>
                  );
                })}
                <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.3rem' }}>
                  Clique em cada número para abrir o WhatsApp Web com a mensagem pré-preenchida.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AdminNotificationsPage;
