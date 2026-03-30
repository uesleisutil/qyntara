import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../hooks/useApi';
import { useToastStore } from '../../store/toastStore';
import { theme } from '../../styles';
import { MessageCircle, Mail, Send, Clock, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, User, Zap, Crown, Star } from 'lucide-react';

interface Message { role: string; text: string; at: string; }
interface Ticket {
  id: string; subject: string; status: string; channel: string; category?: string;
  messages: Message[]; created_at: string; updated_at: string;
  user_id: string; user_email: string; user_name: string; user_tier: string;
}

const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: 'Aberto', color: theme.yellow, icon: <AlertCircle size={11} /> },
  in_progress: { label: 'Em andamento', color: theme.blue, icon: <Clock size={11} /> },
  closed: { label: 'Fechado', color: theme.green, icon: <CheckCircle2 size={11} /> },
};
const tierIcons: Record<string, React.ReactNode> = {
  free: <Star size={10} />, pro: <Zap size={10} />, quant: <Crown size={10} />,
};
const tierColors: Record<string, string> = {
  free: theme.textMuted, pro: theme.accent, quant: theme.yellow,
};

export const AdminSupportPage: React.FC<{ dark?: boolean }> = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    try {
      const res = await apiFetch(`/admin/support/tickets${statusFilter ? `?status=${statusFilter}` : ''}`);
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch {}
    setLoaded(true);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleReply = async (id: string, text: string) => {
    await apiFetch(`/support/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ message: text }) });
    load();
  };

  const handleStatus = async (id: string, status: string) => {
    await apiFetch(`/support/tickets/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    load();
    useToastStore.getState().addToast(`Ticket ${status === 'closed' ? 'fechado' : 'atualizado'}.`, 'success');
  };

  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Suporte</h2>
        <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>
          {openCount} aberto{openCount !== 1 ? 's' : ''} · {inProgressCount} em andamento · {tickets.length} total
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: '1.25rem' }}>
        {[
          { l: 'Abertos', v: openCount, c: theme.yellow },
          { l: 'Em andamento', v: inProgressCount, c: theme.blue },
          { l: 'Fechados', v: tickets.filter(t => t.status === 'closed').length, c: theme.green },
          { l: 'Total', v: tickets.length, c: theme.accent },
        ].map(s => (
          <div key={s.l} style={{ padding: '0.65rem', borderRadius: 8, borderLeft: `3px solid ${s.c}`, background: theme.card }}>
            <div style={{ fontSize: '0.58rem', color: theme.textMuted, marginBottom: 3 }}>{s.l}</div>
            <div style={{ fontSize: '1rem', fontWeight: 800 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1rem' }}>
        {['', 'open', 'in_progress', 'closed'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: '0.4rem 0.75rem', borderRadius: 100, fontSize: '0.68rem',
            border: `1px solid ${statusFilter === s ? theme.accentBorder : theme.border}`,
            background: statusFilter === s ? theme.accentBg : 'transparent',
            color: statusFilter === s ? theme.accent : theme.textMuted,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>{s === '' ? 'Todos' : statusMap[s]?.label || s}</button>
        ))}
      </div>

      {/* Tickets */}
      {!loaded ? (
        <div style={{ color: theme.textMuted, fontSize: '0.78rem', padding: '2rem', textAlign: 'center' }}>Carregando...</div>
      ) : tickets.length === 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '0.78rem', padding: '3rem', textAlign: 'center' }}>Nenhum ticket.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tickets.map(t => {
            const st = statusMap[t.status] || statusMap.open;
            const isOpen = openId === t.id;
            const lastMsg = t.messages?.[t.messages.length - 1];
            const tc = tierColors[t.user_tier] || theme.textMuted;

            return (
              <div key={t.id} style={{ borderRadius: 10, border: `1px solid ${theme.border}`, overflow: 'hidden', background: theme.card }}>
                {/* Header */}
                <div onClick={() => setOpenId(isOpen ? null : t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '0.7rem 1rem',
                  cursor: 'pointer', transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = theme.cardHover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {/* Channel icon */}
                  {t.channel === 'chat' ? <MessageCircle size={13} color={theme.green} /> : <Mail size={13} color={theme.accent} />}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</span>
                      {t.category && <span style={{ fontSize: '0.55rem', padding: '1px 5px', borderRadius: 3, background: `${theme.textMuted}12`, color: theme.textMuted }}>{t.category}</span>}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: theme.textMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* User info inline */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <User size={9} /> {t.user_name || t.user_email.split('@')[0]}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: tc }}>
                        {tierIcons[t.user_tier]} {t.user_tier}
                      </span>
                      {lastMsg && <span>· {lastMsg.role === 'admin' ? 'Você' : 'Cliente'}: {lastMsg.text.slice(0, 40)}</span>}
                    </div>
                  </div>

                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.58rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${st.color}12`, color: st.color }}>
                    {st.icon} {st.label}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: theme.textMuted }}>
                    {new Date(t.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                  {isOpen ? <ChevronUp size={12} color={theme.textMuted} /> : <ChevronDown size={12} color={theme.textMuted} />}
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${theme.border}` }}>
                    {/* Customer info card */}
                    <div style={{ padding: '0.75rem 1rem', background: theme.bg, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.7rem' }}>
                      <div>
                        <div style={{ color: theme.textMuted, fontSize: '0.58rem', marginBottom: 2 }}>Cliente</div>
                        <div style={{ fontWeight: 600 }}>{t.user_name || '—'}</div>
                      </div>
                      <div>
                        <div style={{ color: theme.textMuted, fontSize: '0.58rem', marginBottom: 2 }}>Email</div>
                        <div>{t.user_email}</div>
                      </div>
                      <div>
                        <div style={{ color: theme.textMuted, fontSize: '0.58rem', marginBottom: 2 }}>Plano</div>
                        <div style={{ color: tc, fontWeight: 600, textTransform: 'uppercase' }}>{t.user_tier}</div>
                      </div>
                      <div>
                        <div style={{ color: theme.textMuted, fontSize: '0.58rem', marginBottom: 2 }}>Canal</div>
                        <div>{t.channel === 'chat' ? '💬 Chat' : '📧 Email'}</div>
                      </div>
                      <div>
                        <div style={{ color: theme.textMuted, fontSize: '0.58rem', marginBottom: 2 }}>Categoria</div>
                        <div>{t.category || 'Geral'}</div>
                      </div>
                      <div>
                        <div style={{ color: theme.textMuted, fontSize: '0.58rem', marginBottom: 2 }}>Criado</div>
                        <div>{new Date(t.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>

                    {/* Messages */}
                    <div style={{ padding: '0.75rem 1rem', maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(t.messages || []).map((m, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'admin' ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            maxWidth: '80%', padding: '0.5rem 0.75rem', borderRadius: 10,
                            background: m.role === 'admin' ? theme.accentBg : theme.bg,
                            border: `1px solid ${m.role === 'admin' ? theme.accentBorder : theme.border}`,
                          }}>
                            <div style={{ fontSize: '0.55rem', color: theme.textMuted, marginBottom: 3, fontWeight: 600 }}>
                              {m.role === 'admin' ? '🛡️ Você' : `👤 ${t.user_name || 'Cliente'}`} · {new Date(m.at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div style={{ fontSize: '0.75rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.text}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Reply */}
                    {t.status !== 'closed' && <AdminReply onSend={(text) => handleReply(t.id, text)} />}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, padding: '0.5rem 1rem', borderTop: `1px solid ${theme.border}`, background: theme.bg }}>
                      {t.status === 'open' && (
                        <button onClick={() => handleStatus(t.id, 'in_progress')} style={{
                          padding: '3px 8px', borderRadius: 5, border: `1px solid ${theme.blue}30`,
                          background: 'transparent', color: theme.blue, cursor: 'pointer', fontSize: '0.62rem', fontWeight: 600,
                        }}>Em andamento</button>
                      )}
                      {t.status !== 'closed' && (
                        <button onClick={() => handleStatus(t.id, 'closed')} style={{
                          padding: '3px 8px', borderRadius: 5, border: `1px solid ${theme.green}30`,
                          background: 'transparent', color: theme.green, cursor: 'pointer', fontSize: '0.62rem', fontWeight: 600,
                        }}>Fechar</button>
                      )}
                      {t.status === 'closed' && (
                        <button onClick={() => handleStatus(t.id, 'open')} style={{
                          padding: '3px 8px', borderRadius: 5, border: `1px solid ${theme.accent}30`,
                          background: 'transparent', color: theme.accent, cursor: 'pointer', fontSize: '0.62rem', fontWeight: 600,
                        }}>Reabrir</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AdminReply: React.FC<{ onSend: (text: string) => void }> = ({ onSend }) => {
  const [text, setText] = useState('');
  return (
    <div style={{ display: 'flex', gap: 6, padding: '0.5rem 1rem', borderTop: `1px solid ${theme.border}` }}>
      <input value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { onSend(text); setText(''); } }}
        placeholder="Responder como admin..."
        style={{
          flex: 1, padding: '0.45rem 0.7rem', borderRadius: 8, border: `1px solid ${theme.border}`,
          background: theme.bg, color: theme.text, fontSize: '0.78rem', outline: 'none', fontFamily: 'inherit',
        }} />
      <button onClick={() => { if (text.trim()) { onSend(text); setText(''); } }} style={{
        padding: '0.45rem 0.7rem', borderRadius: 8, border: 'none',
        background: text.trim() ? theme.accent : theme.border,
        color: text.trim() ? '#fff' : theme.textMuted, cursor: text.trim() ? 'pointer' : 'default',
      }}><Send size={13} /></button>
    </div>
  );
};
