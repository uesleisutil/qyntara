import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Settings, Trash2, Shield, Lock, CreditCard, AlertTriangle, CheckCircle, ExternalLink, Bell, Keyboard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL } from '../../config';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const SettingsPage: React.FC = () => {
  const { darkMode } = useOutletContext<DashboardContext>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [emailNotif, setEmailNotif] = useState(() => localStorage.getItem('b3tr_email_notif') === 'true');
  const [emailNotifSaving, setEmailNotifSaving] = useState(false);
  const isPro = user?.plan === 'pro';

  const theme = {
    bg: darkMode ? '#0c0a1a' : '#f8f7fc',
    cardBg: darkMode ? '#1a1836' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#9895b0' : '#64618b',
    border: darkMode ? '#2a2745' : '#e2e0f0',
    hover: darkMode ? '#2a2745' : '#f3f1fa',
  };

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg, border: `1px solid ${theme.border}`,
    borderRadius: 12, padding: 'clamp(1rem, 3vw, 1.5rem)', marginBottom: '1rem',
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'EXCLUIR') return;
    setDeleting(true); setDeleteError('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Erro ao excluir conta');
      }
      setDeleteSuccess(true);
      setTimeout(async () => { await logout(); navigate('/'); }, 3000);
    } catch (err: any) {
      setDeleteError(err.message);
    } finally { setDeleting(false); }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>
        <Settings size={20} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Configurações
      </h1>
      <p style={{ color: theme.textSecondary, fontSize: '0.82rem', marginBottom: '1.25rem' }}>
        Gerencie sua conta e preferências
      </p>

      {/* Account info */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem' }}>Minha Conta</h3>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {[
            { label: 'Email', value: user?.email || '—' },
            { label: 'Nome', value: user?.name || '—' },
            { label: 'Plano', value: user?.plan === 'pro' ? 'Pro' : 'Gratuito' },
            { label: 'Email verificado', value: user?.emailVerified ? 'Sim ✓' : 'Não — verifique seu email' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: `1px solid ${theme.border}` }}>
              <span style={{ fontSize: '0.82rem', color: theme.textSecondary }}>{item.label}</span>
              <span style={{ fontSize: '0.82rem', color: theme.text, fontWeight: 500 }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem' }}>Ações Rápidas</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {[
            { icon: <Lock size={15} />, label: 'Alterar senha', path: '/dashboard/change-password' },
            { icon: <CreditCard size={15} />, label: 'Gerenciar assinatura', path: '/dashboard/upgrade' },
            { icon: <Shield size={15} />, label: 'Política de Privacidade', path: '/privacidade' },
          ].map((item, i) => (
            <button key={i} onClick={() => navigate(item.path)} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.75rem',
              background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: 8,
              color: theme.textSecondary, cursor: 'pointer', fontSize: '0.82rem', textAlign: 'left',
              transition: 'background 0.15s', width: '100%',
            }}
              onMouseEnter={e => e.currentTarget.style.background = theme.hover}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {item.icon} {item.label} <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.4 }} />
            </button>
          ))}
        </div>
      </div>

      {/* Email Notifications */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Bell size={16} /> Notificações por Email
        </h3>
        <p style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '0.75rem', lineHeight: 1.5 }}>
          Receba um resumo diário das recomendações no seu email.
          {!isPro && <span style={{ color: '#f59e0b' }}> Disponível apenas para assinantes Pro.</span>}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={async () => {
              if (!isPro) return;
              setEmailNotifSaving(true);
              const newVal = !emailNotif;
              try {
                const token = localStorage.getItem('authToken');
                await fetch(`${API_BASE_URL}/auth/preferences`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ emailNotifications: newVal }),
                }).catch(() => {});
                localStorage.setItem('b3tr_email_notif', String(newVal));
                setEmailNotif(newVal);
              } catch {} finally { setEmailNotifSaving(false); }
            }}
            disabled={!isPro || emailNotifSaving}
            style={{
              width: 40, height: 22, borderRadius: 11, border: 'none', cursor: isPro ? 'pointer' : 'not-allowed',
              background: emailNotif && isPro ? '#10b981' : (darkMode ? '#2a2745' : '#e2e0f0'),
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              opacity: isPro ? 1 : 0.5, padding: 0,
              WebkitAppearance: 'none' as any,
            }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: '50%', background: 'white',
              position: 'absolute', top: 3,
              left: emailNotif && isPro ? 21 : 3,
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
          <span style={{ fontSize: '0.82rem', color: theme.text }}>
            {emailNotif && isPro ? 'Ativado' : 'Desativado'}
          </span>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Keyboard size={16} /> Atalhos de Teclado
        </h3>
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {[
            { keys: 'Ctrl + K', desc: 'Buscar ticker na tabela' },
            { keys: '1', desc: 'Ir para Recomendações' },
            { keys: '2', desc: 'Ir para Explicabilidade' },
            { keys: '3', desc: 'Ir para Backtesting' },
            { keys: '4', desc: 'Ir para Performance' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: `1px solid ${theme.border}` }}>
              <span style={{ fontSize: '0.82rem', color: theme.textSecondary }}>{s.desc}</span>
              <kbd style={{
                padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600,
                background: darkMode ? '#0c0a1a' : '#f3f1fa', border: `1px solid ${theme.border}`,
                color: theme.text, fontFamily: 'monospace',
              }}>{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>

      {/* LGPD — Delete account */}
      <div style={{ ...cardStyle, borderColor: 'rgba(239,68,68,0.3)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f87171', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Trash2 size={16} /> Excluir Minha Conta
        </h3>
        <p style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: '0.75rem' }}>
          Conforme a LGPD (Art. 18), você pode solicitar a exclusão total dos seus dados pessoais.
          Esta ação é irreversível e removerá permanentemente sua conta, histórico e dados associados.
        </p>

        {deleteSuccess ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.85rem' }}>
            <CheckCircle size={16} /> Conta excluída com sucesso. Redirecionando...
          </div>
        ) : !showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)} style={{
            padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)',
            background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500,
          }}>
            Solicitar exclusão de dados
          </button>
        ) : (
          <div style={{ padding: '0.75rem', borderRadius: 8, background: darkMode ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', color: '#f87171', fontSize: '0.82rem', fontWeight: 600 }}>
              <AlertTriangle size={15} /> Confirme a exclusão
            </div>
            <p style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>
              Digite <strong style={{ color: '#f87171' }}>EXCLUIR</strong> para confirmar:
            </p>
            <input
              type="text" value={deleteInput} onChange={e => setDeleteInput(e.target.value)}
              placeholder="EXCLUIR"
              style={{
                width: '100%', padding: '0.5rem', borderRadius: 6, border: `1px solid ${theme.border}`,
                background: theme.bg, color: theme.text, fontSize: '0.85rem', marginBottom: '0.5rem',
                boxSizing: 'border-box',
              }}
            />
            {deleteError && <p style={{ color: '#f87171', fontSize: '0.78rem', marginBottom: '0.5rem' }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); setDeleteError(''); }} style={{
                padding: '0.45rem 0.75rem', borderRadius: 6, border: `1px solid ${theme.border}`,
                background: 'transparent', color: theme.textSecondary, cursor: 'pointer', fontSize: '0.8rem',
              }}>
                Cancelar
              </button>
              <button onClick={handleDeleteAccount} disabled={deleteInput !== 'EXCLUIR' || deleting} style={{
                padding: '0.45rem 0.75rem', borderRadius: 6, border: 'none',
                background: deleteInput === 'EXCLUIR' ? '#ef4444' : '#64748b',
                color: 'white', cursor: deleteInput === 'EXCLUIR' ? 'pointer' : 'not-allowed',
                fontSize: '0.8rem', fontWeight: 600, opacity: deleting ? 0.6 : 1,
              }}>
                {deleting ? 'Excluindo...' : 'Excluir permanentemente'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
