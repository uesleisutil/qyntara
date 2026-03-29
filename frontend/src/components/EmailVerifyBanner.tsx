import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiFetch } from '../hooks/useApi';
import { Mail, X, Loader2 } from 'lucide-react';

export const EmailVerifyBanner: React.FC<{ dark: boolean }> = ({ dark }) => {
  const user = useAuthStore(s => s.user);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.email_verified || dismissed) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      await apiFetch('/auth/resend-verification', { method: 'POST' });
      setSent(true);
    } catch {}
    setSending(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 1.5rem',
      background: '#f59e0b15', borderBottom: '1px solid #f59e0b30',
      fontSize: '0.78rem', color: '#f59e0b',
    }}>
      <Mail size={16} />
      <span style={{ flex: 1 }}>
        {sent
          ? 'Verification email sent! Check your inbox.'
          : 'Please verify your email to unlock all features.'}
      </span>
      {!sent && (
        <button onClick={handleResend} disabled={sending} style={{
          padding: '0.3rem 0.6rem', borderRadius: 6, border: '1px solid #f59e0b40',
          background: 'transparent', color: '#f59e0b', cursor: 'pointer',
          fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {sending ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
          Resend
        </button>
      )}
      <button onClick={() => setDismissed(true)} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', opacity: 0.5,
      }}><X size={14} /></button>
    </div>
  );
};
