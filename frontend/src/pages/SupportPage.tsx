import React, { useState } from 'react';
import { useApi, apiFetch } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { theme, badgeStyle } from '../styles';
import {
  MessageCircle, Mail, Plus, Send, X, Trash2, ChevronDown, ChevronUp,
  Clock, CheckCircle2, AlertCircle, Lock,
} from 'lucide-react';

interface Message { role: string; text: string; at: string; }
interface Ticket {
  id: string; subject: string; status: string; channel: string;
  messages: Message[]; created_at: string; updated_at: string;
  user_tier?: string;
}

interface Props { dark?: boolean; onAuthRequired: () => void; }

const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: 'Aberto', color: theme.yellow, icon: <AlertCircle size={12} /> },
  in_progress: { label: 'Em andamento', color: theme.blue, icon: <Clock size={12} /> },
  closed: { label: 'Fechado', color: theme.green, icon: <CheckCircle2 size={12} /> },
};

export const SupportPage: React.FC<Props> = ({ onAuthRequired }) => {
  const user = useAuthStore(s => s.user);
  const tier = user?.tier || 'free';
  const hasChat = tier === 'pro' || tier === 'quant' || tier === 'enterprise';
  const { data, refresh, loading } = useApi<{ tickets: Ticket[] }>('/support/tickets', 15000);
  const [showNew, setShowNew] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

  if (!user) {
    return (
      <div style={{
        textAlign: 'center', padding: '4rem 2rem', background: theme.card,
        borderRadius: 20, border: `1px solid ${theme.border}`, animation: 'fadeIn 0.4s ease',
      }}>
        <Lock size={28} color={theme.accent} style={{ marginBottom: 12 }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Suporte</h3>
        <p style={{ color: theme.textSecondary, marginBottom: '1.5rem', fontSize: '0.85rem' }}>Entre para acessar o suporte</p>
        <button onClick={onAuthRequired} style={{
          padding: '0.7rem 1.8rem', borderRadius: 10, border: 'none',
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
          color: '#fff', fontWeight: 600, cursor: 'pointer',
        }}>Entrar</button>
      </div>
    );
  }

  const tickets = data?.tickets || [];

  const handleClose = async (ticketId: string) => {
    await apiFetch(`/support/tickets/${ticketId}/status`, {
      method: 'PUT', body: JSON.stringify({ status: 'closed' }),
    });
    refresh();
    useToastStore.getState().addToast('Ticket fechado.', 'success');
  };

  const handleDelete = async (ticketId: string) => {
    if (!confirm('Tem certeza que deseja excluir este ticket?')) return;
    await apiFetch(`/support/tickets/${ticketId}`, { method: 'DELETE' });
    refresh();
    if (openTicketId === ticketId) setOpenTicketId(null);
    useToastStore.getState().addToast('Ticket excluído.', 'success');
  };

  const handleReopen = async (ticketId: string) => {
    await apiFetch(`/support/tickets/${ticketId}/status`, {
      method: 'PUT', body: JSON.stringify({ status: 'open' }),
    });
    refresh();
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <MessageCircle size={20} color={theme.accent} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Suporte</h2>
          </div>
          <p style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
            {hasChat ? (
              <><span style={{ color: theme.green }}>●</span> Chat ao vivo disponível no seu plano</>
            ) : (
              <>Suporte por email · <span style={{ color: theme.accent, cursor: 'pointer' }}>Faça upgrade para chat ao vivo</span></>
            )}
          </p>
        </div>
        <button onClick={() => setShowNew(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem',
          borderRadius: 10, border: 'none',
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
          color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
          boxShadow: `0 4px 12px ${theme.accent}25`, transition: 'all 0.2s',
        }}>
          <Plus size={14} /> Novo ticket
        </button>
      </div>

      {/* Channel info */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: '1.5rem',
      }}>
        <div style={{
          flex: 1, padding: '1rem', borderRadius: 14, border: `1px solid ${theme.border}`,
          background: hasChat ? `${theme.green}08` : theme.card,
          borderLeft: `3px solid ${hasChat ? theme.green : theme.textMuted}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <MessageCircle size={15} color={hasChat ? theme.green : theme.textMuted} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Chat</span>
            {!hasChat && <span style={badgeStyle(theme.accent, theme.accentBg)}>PRO</span>}
          </div>
          <p style={{ fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.5 }}>
            {hasChat ? 'Respostas em até 4 horas úteis.' : 'Disponível nos planos Pro e Quant.'}
          </p>
        </div>
        <div style={{
          flex: 1, padding: '1rem', borderRadius: 14, border: `1px solid ${theme.border}`,
          background: theme.card, borderLeft: `3px solid ${theme.accent}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Mail size={15} color={theme.accent} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Email</span>
          </div>
          <p style={{ fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.5 }}>
            suporte@qyntara.tech · Respostas em até 48h.
          </p>
        </div>
      </div>

      {/* Tickets list */}
      {loading && !tickets.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{
              height: 72, borderRadius: 14, border: `1px solid ${theme.border}`,
              background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`,
              backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite ${i * 0.1}s`,
            }} />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '4rem 2rem', color: theme.textMuted,
          background: theme.card, borderRadius: 20, border: `1px solid ${theme.border}`,
        }}>
          <MessageCircle size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: '0.95rem', marginBottom: 6 }}>Nenhum ticket ainda</p>
          <p style={{ fontSize: '0.78rem' }}>Abra um ticket para falar com nosso suporte.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tickets.map((t, i) => {
            const st = statusMap[t.status] || statusMap.open;
            const isOpen = openTicketId === t.id;
            const lastMsg = t.messages?.[t.messages.length - 1];
            return (
              <div key={t.id} style={{
                borderRadius: 14, border: `1px solid ${theme.border}`,
                background: theme.card, overflow: 'hidden',
                animation: `fadeIn 0.3s ease ${i * 0.05}s both`,
                transition: 'all 0.2s',
              }}>
                {/* Ticket header */}
                <div onClick={() => setOpenTicketId(isOpen ? null : t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '0.85rem 1.1rem',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = theme.cardHover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${st.color}12`, color: st.color, flexShrink: 0,
                  }}>{t.channel === 'chat' ? <MessageCircle size={14} /> : <Mail size={14} />}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.subject}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: theme.textMuted, marginTop: 2 }}>
                      {lastMsg && `${lastMsg.role === 'admin' ? 'Suporte' : 'Você'}: ${lastMsg.text.slice(0, 60)}${lastMsg.text.length > 60 ? '...' : ''}`}
                    </div>
                  </div>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    ...badgeStyle(st.color, `${st.color}15`),
                  }}>{st.icon} {st.label}</span>
                  <span style={{ fontSize: '0.65rem', color: theme.textMuted, flexShrink: 0 }}>
                    {new Date(t.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                  {isOpen ? <ChevronUp size={14} color={theme.textMuted} /> : <ChevronDown size={14} color={theme.textMuted} />}
                </div>

                {/* Expanded ticket */}
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${theme.border}`, animation: 'fadeIn 0.2s ease' }}>
                    {/* Messages */}
                    <div style={{ padding: '1rem', maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(t.messages || []).map((m, mi) => (
                        <div key={mi} style={{
                          display: 'flex', flexDirection: 'column',
                          alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                        }}>
                          <div style={{
                            maxWidth: '80%', padding: '0.6rem 0.85rem', borderRadius: 12,
                            background: m.role === 'user' ? theme.accentBg : theme.bg,
                            border: `1px solid ${m.role === 'user' ? theme.accentBorder : theme.border}`,
                          }}>
                            <div style={{ fontSize: '0.6rem', color: theme.textMuted, marginBottom: 4, fontWeight: 600 }}>
                              {m.role === 'admin' ? '🛡️ Suporte' : 'Você'} · {new Date(m.at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div style={{ fontSize: '0.8rem', lineHeight: 1.5, color: theme.text, whiteSpace: 'pre-wrap' }}>{m.text}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Reply + actions */}
                    {t.status !== 'closed' ? (
                      <ReplyBox ticketId={t.id} onSent={refresh} />
                    ) : (
                      <div style={{ padding: '0.75rem 1rem', background: theme.bg, fontSize: '0.78rem', color: theme.textMuted, textAlign: 'center' }}>
                        Ticket fechado.
                        <button onClick={() => handleReopen(t.id)} style={{
                          background: 'none', border: 'none', color: theme.accent, cursor: 'pointer', fontWeight: 600, marginLeft: 6,
                        }}>Reabrir</button>
                      </div>
                    )}

                    {/* Actions bar */}
                    <div style={{
                      display: 'flex', gap: 8, padding: '0.6rem 1rem', borderTop: `1px solid ${theme.border}`,
                      background: theme.bg,
                    }}>
                      {t.status !== 'closed' && (
                        <button onClick={() => handleClose(t.id)} style={{
                          padding: '4px 10px', borderRadius: 6, border: `1px solid ${theme.green}30`,
                          background: 'transparent', color: theme.green, cursor: 'pointer',
                          fontSize: '0.7rem', fontWeight: 600,
                        }}>Fechar ticket</button>
                      )}
                      <button onClick={() => handleDelete(t.id)} style={{
                        padding: '4px 10px', borderRadius: 6, border: `1px solid ${theme.red}30`,
                        background: 'transparent', color: theme.red, cursor: 'pointer',
                        fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                      }}><Trash2 size={11} /> Excluir</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New ticket modal */}
      {showNew && <NewTicketModal hasChat={hasChat} onClose={() => { setShowNew(false); refresh(); }} />}
    </div>
  );
};

/* ── Reply box ── */
const ReplyBox: React.FC<{ ticketId: string; onSent: () => void }> = ({ ticketId, onSent }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    await apiFetch(`/support/tickets/${ticketId}/messages`, {
      method: 'POST', body: JSON.stringify({ message: text }),
    });
    setText('');
    setSending(false);
    onSent();
  };

  return (
    <div style={{ display: 'flex', gap: 8, padding: '0.75rem 1rem', borderTop: `1px solid ${theme.border}` }}>
      <input value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        placeholder="Escreva sua mensagem..."
        style={{
          flex: 1, padding: '0.55rem 0.85rem', borderRadius: 10,
          border: `1px solid ${theme.border}`, background: theme.bg,
          color: theme.text, fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit',
        }} />
      <button onClick={handleSend} disabled={sending || !text.trim()} style={{
        padding: '0.55rem 0.85rem', borderRadius: 10, border: 'none',
        background: text.trim() ? `linear-gradient(135deg, ${theme.accent}, ${theme.purple})` : theme.border,
        color: text.trim() ? '#fff' : theme.textMuted, cursor: text.trim() ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600,
        transition: 'all 0.2s',
      }}><Send size={14} /></button>
    </div>
  );
};

/* ── New ticket modal ── */
const NewTicketModal: React.FC<{ hasChat: boolean; onClose: () => void }> = ({ hasChat, onClose }) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const res = await apiFetch('/support/tickets', {
        method: 'POST', body: JSON.stringify({ subject, message }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Erro ao criar ticket');
      }
      useToastStore.getState().addToast('Ticket criado com sucesso!', 'success');
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.85rem', borderRadius: 10,
    border: `1px solid ${theme.border}`, background: theme.bg,
    color: theme.text, fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      animation: 'fadeIn 0.2s ease',
    }} onClick={onClose}>
      <div style={{
        background: theme.card, borderRadius: 20, padding: '1.75rem', width: '100%', maxWidth: 480,
        border: `1px solid ${theme.border}`, boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        animation: 'slideUp 0.3s ease',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Novo Ticket</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted }}><X size={18} /></button>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 0.75rem',
          borderRadius: 8, background: hasChat ? theme.greenBg : theme.accentBg,
          marginBottom: '1rem', fontSize: '0.72rem',
          color: hasChat ? theme.green : theme.accent,
        }}>
          {hasChat ? <MessageCircle size={13} /> : <Mail size={13} />}
          {hasChat ? 'Chat ao vivo — resposta em até 4h' : 'Suporte por email — resposta em até 48h'}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 600, display: 'block', marginBottom: 5 }}>Assunto *</label>
            <input placeholder="Ex: Problema com sinais de IA" value={subject} onChange={e => setSubject(e.target.value)} required style={inp} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 600, display: 'block', marginBottom: 5 }}>Mensagem *</label>
            <textarea placeholder="Descreva seu problema ou dúvida..." value={message} onChange={e => setMessage(e.target.value)}
              required rows={5} style={{ ...inp, resize: 'vertical', minHeight: 100 }} />
          </div>
          {error && (
            <div style={{ padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.78rem', background: theme.redBg, color: theme.red }}>{error}</div>
          )}
          <button type="submit" disabled={sending} style={{
            padding: '0.7rem', borderRadius: 10, border: 'none',
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
            color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem',
            opacity: sending ? 0.7 : 1,
          }}>{sending ? 'Enviando...' : 'Enviar ticket'}</button>
        </form>
      </div>
    </div>
  );
};
