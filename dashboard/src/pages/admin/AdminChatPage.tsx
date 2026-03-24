import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { MessageCircle, Send, Loader2, RefreshCw, XCircle, CheckCircle, Clock, ChevronLeft, User } from 'lucide-react';
import { API_BASE_URL } from '../../config';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }
interface Message { id: string; sender: 'user' | 'admin'; senderName: string; message: string; timestamp: string; }
interface Ticket {
  ticketId: string; userEmail: string; userName: string; subject: string;
  status: string; messages: Message[]; createdAt: string; updatedAt: string;
  unreadCount?: number;
}

const AdminChatPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'answered' | 'closed'>('all');
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/admin/chat`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erro ao carregar');
      const data = await res.json();
      const t = data.tickets || [];
      setTickets(t);
      if (activeTicket) {
        const updated = t.find((x: Ticket) => x.ticketId === activeTicket.ticketId);
        if (updated) setActiveTicket(updated);
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [activeTicket]);

  useEffect(() => { fetchTickets(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeTicket) return;
    const interval = setInterval(fetchTickets, 8000);
    return () => clearInterval(interval);
  }, [activeTicket, fetchTickets]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTicket?.messages]);

  const handleReply = async () => {
    if (!reply.trim() || !activeTicket) return;
    setSending(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/admin/chat/reply`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: activeTicket.ticketId, message: reply.trim() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      setReply('');
      await fetchTickets();
    } catch (err: any) { setError(err.message); }
    finally { setSending(false); }
  };

  const handleClose = async (ticketId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`${API_BASE_URL}/admin/chat/close`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId }),
      });
      await fetchTickets();
      if (activeTicket?.ticketId === ticketId) {
        setActiveTicket(prev => prev ? { ...prev, status: 'closed' } : null);
      }
    } catch { /* silent */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); }
  };

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1836' : '#fff'),
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

  const statusInfo = (s: string) => {
    if (s === 'answered') return { text: 'Respondido', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
    if (s === 'closed') return { text: 'Encerrado', color: '#9895b0', bg: 'rgba(148,163,184,0.12)' };
    return { text: 'Aberto', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  };

  const filtered = tickets.filter(t => filter === 'all' || t.status === filter);
  const totalOpen = tickets.filter(t => t.status === 'open').length;
  const totalUnread = tickets.reduce((s, t) => s + (t.unreadCount || 0), 0);

  // Detail view
  if (activeTicket) {
    const msgs = activeTicket.messages || [];
    const si = statusInfo(activeTicket.status);
    return (
      <div className="chat-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', maxHeight: 700 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTicket(null)} style={{ background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer', padding: 4, WebkitAppearance: 'none' as any }}>
            <ChevronLeft size={20} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeTicket.subject}
            </div>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <User size={10} /> {activeTicket.userEmail} · #{activeTicket.ticketId} · <span style={{ color: si.color }}>{si.text}</span>
            </div>
          </div>
          {activeTicket.status !== 'closed' && (
            <button onClick={() => handleClose(activeTicket.ticketId)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', borderRadius: 8, border: `1px solid rgba(148,163,184,0.3)`, background: 'transparent', color: '#9895b0', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, WebkitAppearance: 'none' as any }}>
              <XCircle size={12} /> Encerrar
            </button>
          )}
        </div>

        <div style={{ ...cardStyle, flex: 1, overflow: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {msgs.map(m => {
            const isAdmin = m.sender === 'admin';
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '80%', padding: '0.6rem 0.85rem', borderRadius: 12,
                  borderBottomRightRadius: isAdmin ? 4 : 12, borderBottomLeftRadius: isAdmin ? 12 : 4,
                  background: isAdmin ? 'linear-gradient(135deg, #10b981, #059669)' : (darkMode ? '#2a2745' : '#f1f5f9'),
                  color: isAdmin ? 'white' : theme.text,
                }}>
                  {!isAdmin && <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#8b5cf6', marginBottom: '0.15rem' }}>{m.senderName || 'Cliente'}</div>}
                  {isAdmin && <div style={{ fontSize: '0.65rem', fontWeight: 600, opacity: 0.8, marginBottom: '0.15rem' }}>Você</div>}
                  <div style={{ fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.message}</div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.7, textAlign: 'right', marginTop: '0.2rem' }}>{fmtTime(m.timestamp)}</div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {activeTicket.status !== 'closed' && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <textarea value={reply} onChange={e => setReply(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Responder ao cliente..."
              rows={1}
              style={{
                flex: 1, padding: '0.65rem 0.85rem', borderRadius: 10, resize: 'none',
                border: `1px solid ${theme.border}`, background: theme.card || (darkMode ? '#1a1836' : '#fff'),
                color: theme.text, fontSize: '0.85rem', outline: 'none', minHeight: 42, maxHeight: 120,
                fontFamily: 'inherit',
              }} />
            <button onClick={handleReply} disabled={sending || !reply.trim()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 42, height: 42, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: reply.trim() ? 'linear-gradient(135deg, #10b981, #059669)' : (darkMode ? '#2a2745' : '#e2e8f0'),
                color: reply.trim() ? 'white' : theme.textSecondary,
                transition: 'all 0.2s', WebkitAppearance: 'none' as any, opacity: sending ? 0.6 : 1,
              }}>
              {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
            </button>
          </div>
        )}
        {error && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.3rem' }}>{error}</div>}
        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // List view
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageCircle size={22} /> Chat — Suporte
          </h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
            Chamados dos clientes
          </p>
        </div>
        <button onClick={fetchTickets} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.75rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', color: 'white', WebkitAppearance: 'none' as any }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {error && <div style={{ ...cardStyle, padding: '0.75rem', marginBottom: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.82rem' }}>{error}</div>}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {[
          { label: 'Total', value: tickets.length, color: '#8b5cf6' },
          { label: 'Abertos', value: totalOpen, color: '#f59e0b' },
          { label: 'Não lidos', value: totalUnread, color: '#ef4444' },
        ].map((k, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ padding: '0.6rem 0.75rem' }}>
              <div style={{ fontSize: '0.65rem', color: theme.textSecondary }}>{k.label}</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {([['all', 'Todos'], ['open', 'Abertos'], ['answered', 'Respondidos'], ['closed', 'Encerrados']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.4rem 0.7rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
              border: `1.5px solid ${filter === val ? '#8b5cf6' : theme.border}`,
              background: filter === val ? 'rgba(59,130,246,0.1)' : 'transparent',
              color: filter === val ? '#8b5cf6' : theme.textSecondary,
              cursor: 'pointer', WebkitAppearance: 'none' as any,
            }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: theme.textSecondary }}>
          <Loader2 size={24} className="spin" />
          <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem', color: theme.textSecondary }}>
          <MessageCircle size={32} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text }}>Nenhum chamado</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {filtered.map(t => {
            const si = statusInfo(t.status);
            const lastMsg = t.messages?.[t.messages.length - 1];
            const hasUnread = (t.unreadCount || 0) > 0;
            return (
              <div key={t.ticketId} onClick={() => { setActiveTicket(t); setError(''); }}
                style={{
                  ...cardStyle, padding: '0.75rem', cursor: 'pointer', transition: 'background 0.15s',
                  borderLeft: hasUnread ? '3px solid #f59e0b' : `1px solid ${theme.border}`,
                }}
                onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#2a2745' : '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = theme.card || (darkMode ? '#1a1836' : '#fff')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</span>
                    {hasUnread && <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: 8, background: '#ef4444', color: 'white', fontWeight: 700, flexShrink: 0 }}>{t.unreadCount}</span>}
                  </div>
                  <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 6, background: si.bg, color: si.color, fontWeight: 600, flexShrink: 0 }}>{si.text}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <User size={10} /> {t.userName || t.userEmail}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: theme.textSecondary }}>{fmtTime(t.updatedAt)}</div>
                </div>
                {lastMsg && (
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lastMsg.sender === 'admin' ? <CheckCircle size={10} style={{ verticalAlign: 'middle', marginRight: 3, color: '#10b981' }} /> : <Clock size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />}
                    {lastMsg.sender === 'admin' ? 'Você: ' : `${t.userName || 'Cliente'}: `}{lastMsg.message.slice(0, 100)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AdminChatPage;
