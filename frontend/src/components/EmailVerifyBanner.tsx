import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiFetch } from '../hooks/useApi';
import { theme } from '../styles';
import { Mail, X, Loader2 } from 'lucide-react';

export const EmailVerifyBanner: React.FC<{ dark: boolean }> = ({ dark }) => {
  const user = useAuthStore(s => s.user);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.email_verified || dismissed) return null;

  const handleResend = async () => {
    setSending(true);
    try { await apiFetch('/auth/resend-verification', { method: 'POST' }); setSent(true); } catch {}
    setSending(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 1.5rem',
      background: theme.yellowBg, borderBottom: `1px solid ${theme.yellow}30`,
      fontSize: '0.78rem', color: theme.yellow,
    }}>
      <Mail size={16} />
      <span style={{ flex: 1 }}>
        {sent ? 'Email de verificação enviado! Verifique sua caixa de entrada.' : 'Verifique seu email para desbloquear todos os recursos.'}
      </span>
      {!sent && (
        <button onClick={handleResend} disabled={sending} style={{
          padding: '0.3rem 0.6rem', borderRadius: 6, border: `1px solid ${theme.yellow}40`,
          background: 'transparent', color: theme.yellow, cursor: 'pointer',
          fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {sending ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
          Reenviar
        </button>
      )}
      <button onClick={() => setDismissed(true)} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: theme.yellow, opacity: 0.5,
      }}><X size={14} /></button>
    </div>
  );
};
