import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { MessageCircle, Send, Loader2, CheckCircle, Clock, Plus, ChevronLeft } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }
interface Message { id: string; sender: 'user' | 'admin'; senderName: string; message: string; timestamp: string; }
interface Ticket { ticketId: string; subject: string; status: string; messages: Message[]; createdAt: string; updatedAt: string; }

const SupportChatPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/chat/tickets`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erro ao carregar');
      const data = await res.json();
      const t = data.tickets || [];
      setTickets(t);
      // If viewing a ticket, refresh it
      if (activeTicket) {
        const updated = t.find((x: Ticket) => x.ticketId === activeTicket.ticketId);
        if (updated) setActiveTicket(updated);
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [activeTicket]);

  useEffect(() => { fetchTickets(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for new messages when viewing a ticket
  useEffect(() => {
    if (!activeTicket) return;
    const interval = setInterval(fetchTickets, 8000);
    return () => clearInterval(interval);
  }, [activeTicket, fetchTickets]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTicket?.messages]);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true); setError('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/chat/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), ticketId: activeTicket?.ticketId || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro');
      setMessage('');
      // If new ticket was created, set it active
      if (data.ticketId && !activeTicket) {
        setActiveTicket({ ticketId: data.ticketId, subject: message.trim().slice(0, 80), status: 'open', messages: [{ id: '1', sender: 'user', senderName: user?.name || '', message: message.trim(), timestamp: new Date().toISOString() }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
      await fetchTickets();
    } catch (err: any) { setError(err.message); }
    finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a2626' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12,
  };

  const fmtTime = (d: string) => {
    try {
      const dt = new Date(d);
      const now = new Date();
      const diffH = (now.getTime() - dt.getTime()) / 3600000;
      if (diffH < 24) return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const statusLabel = (s: string) => {
    if (s === 'answered') return { text: 'Respondido', color: '#4ead8a', bg: 'rgba(16,185,129,0.12)' };
    if (s === 'closed') return { text: 'Encerrado', color: '#8fa89c', bg: 'rgba(148,163,184,0.12)' };
    return { text: 'Aberto', color: '#d4a84b', bg: 'rgba(212,168,75,0.12)' };
  };

  const openTickets = tickets.filter(t => t.status !== 'closed');
  const closedTickets = tickets.filter(t => t.status === 'closed');

  // Chat view (active ticket or new message)
  if (activeTicket) {
    const msgs = activeTicket.messages || [];
    return (
      <div className="chat-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', maxHeight: 700 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button onClick={() => setActiveTicket(null)} style={{ background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer', padding: 4, WebkitAppearance: 'none' as any }}>
            <ChevronLeft size={20} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeTicket.subject}
            </div>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
              #{activeTicket.ticketId} · {(() => { const s = statusLabel(activeTicket.status); return <span style={{ color: s.color }}>{s.text}</span>; })()}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ ...cardStyle, flex: 1, overflow: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {msgs.map(m => {
            const isUser = m.sender === 'user';
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '80%', padding: '0.6rem 0.85rem', borderRadius: 12,
                  borderBottomRightRadius: isUser ? 4 : 12, borderBottomLeftRadius: isUser ? 12 : 4,
                  background: isUser ? 'linear-gradient(135deg, #4a8e77, #5ab0a0)' : (darkMode ? '#2a3d36' : '#edf5f1'),
                  color: isUser ? 'white' : theme.text,
                }}>
                  {!isUser && <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#4ead8a', marginBottom: '0.15rem' }}>Suporte</div>}
                  <div style={{ fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.message}</div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.7, textAlign: 'right', marginTop: '0.2rem' }}>{fmtTime(m.timestamp)}</div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {activeTicket.status !== 'closed' && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <textarea value={message} onChange={e => setMessage(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              rows={1}
              style={{
                flex: 1, padding: '0.65rem 0.85rem', borderRadius: 10, resize: 'none',
                border: `1px solid ${theme.border}`, background: theme.card || (darkMode ? '#1a2626' : '#fff'),
                color: theme.text, fontSize: '0.85rem', outline: 'none', minHeight: 42, maxHeight: 120,
                fontFamily: 'inherit',
              }} />
            <button onClick={handleSend} disabled={sending || !message.trim()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 42, height: 42, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: message.trim() ? 'linear-gradient(135deg, #4a8e77, #5ab0a0)' : (darkMode ? '#2a3d36' : '#d4e5dc'),
                color: message.trim() ? 'white' : theme.textSecondary,
                transition: 'all 0.2s', WebkitAppearance: 'none' as any,
                opacity: sending ? 0.6 : 1,
              }}>
              {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
            </button>
          </div>
        )}
        {activeTicket.status === 'closed' && (
          <div style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.78rem', color: theme.textSecondary }}>
            Este chamado foi encerrado. Abra um novo se precisar de ajuda.
          </div>
        )}
        {error && <div style={{ color: '#e07070', fontSize: '0.78rem', marginTop: '0.3rem' }}>{error}</div>}
        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Ticket list view
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageCircle size={22} /> Fale Conosco
          </h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
            Tire dúvidas ou envie sugestões
          </p>
        </div>
      </div>

      {error && <div style={{ ...cardStyle, padding: '0.75rem', marginBottom: '0.75rem', background: 'rgba(224,112,112,0.1)', border: '1px solid rgba(224,112,112,0.3)', color: '#e89090', fontSize: '0.82rem' }}>{error}</div>}

      {/* New message card */}
      <div style={{ ...cardStyle, padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Plus size={14} /> Nova mensagem
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <textarea value={message} onChange={e => setMessage(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Descreva sua dúvida ou sugestão..."
            rows={2}
            style={{
              flex: 1, padding: '0.65rem 0.85rem', borderRadius: 10, resize: 'vertical',
              border: `1px solid ${theme.border}`, background: darkMode ? '#121a1a' : '#f6faf8',
              color: theme.text, fontSize: '0.85rem', outline: 'none', minHeight: 60, maxHeight: 200,
              fontFamily: 'inherit',
            }} />
          <button onClick={handleSend} disabled={sending || !message.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
              padding: '0.5rem 1rem', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: message.trim() ? 'linear-gradient(135deg, #4a8e77, #5ab0a0)' : (darkMode ? '#2a3d36' : '#d4e5dc'),
              color: message.trim() ? 'white' : theme.textSecondary,
              fontSize: '0.82rem', fontWeight: 600, alignSelf: 'flex-end',
              WebkitAppearance: 'none' as any, opacity: sending ? 0.6 : 1, transition: 'all 0.2s',
            }}>
            {sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />} Enviar
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: theme.textSecondary }}>
          <Loader2 size={24} className="spin" />
          <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <>
          {/* Open tickets */}
          {openTickets.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: theme.textSecondary, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Chamados abertos ({openTickets.length})
              </div>
              {openTickets.map(t => {
                const s = statusLabel(t.status);
                const lastMsg = t.messages?.[t.messages.length - 1];
                return (
                  <div key={t.ticketId} onClick={() => setActiveTicket(t)}
                    style={{ ...cardStyle, padding: '0.75rem', marginBottom: '0.4rem', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#2a3d36' : '#edf5f1'}
                    onMouseLeave={e => e.currentTarget.style.background = theme.card || (darkMode ? '#1a2626' : '#fff')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>{t.subject}</span>
                      <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 6, background: s.bg, color: s.color, fontWeight: 600 }}>{s.text}</span>
                    </div>
                    {lastMsg && (
                      <div style={{ fontSize: '0.72rem', color: theme.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lastMsg.sender === 'admin' ? <CheckCircle size={10} style={{ verticalAlign: 'middle', marginRight: 3, color: '#4ead8a' }} /> : <Clock size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />}
                        {lastMsg.sender === 'admin' ? 'Suporte: ' : 'Você: '}{lastMsg.message.slice(0, 80)}
                      </div>
                    )}
                    <div style={{ fontSize: '0.65rem', color: theme.textSecondary, marginTop: '0.2rem' }}>{fmtTime(t.updatedAt)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Closed tickets */}
          {closedTickets.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: theme.textSecondary, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Encerrados ({closedTickets.length})
              </div>
              {closedTickets.map(t => (
                <div key={t.ticketId} onClick={() => setActiveTicket(t)}
                  style={{ ...cardStyle, padding: '0.6rem 0.75rem', marginBottom: '0.3rem', cursor: 'pointer', opacity: 0.6, transition: 'opacity 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; }}>
                  <div style={{ fontSize: '0.78rem', color: theme.textSecondary }}>{t.subject}</div>
                  <div style={{ fontSize: '0.65rem', color: theme.textSecondary }}>{fmtTime(t.updatedAt)}</div>
                </div>
              ))}
            </div>
          )}

          {tickets.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem', color: theme.textSecondary }}>
              <MessageCircle size={32} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, marginBottom: '0.3rem' }}>Nenhum chamado</div>
              <div style={{ fontSize: '0.78rem' }}>Envie uma mensagem acima para iniciar uma conversa.</div>
            </div>
          )}
        </>
      )}
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SupportChatPage;
