import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { X, Eye, EyeOff, Loader2 } from 'lucide-react';

interface Props {
  onClose: () => void;
  dark: boolean;
}

export const AuthModal: React.FC<Props> = ({ onClose, dark }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const { login, register, loading, error, clearError } = useAuthStore();

  const bg = dark ? '#12141c' : '#fff';
  const border = dark ? '#1e2130' : '#e2e8f0';
  const textSec = dark ? '#8892a4' : '#64748b';
  const accent = '#6366f1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await login(email, password);
    } else {
      await register(email, password, name);
    }
    if (!useAuthStore.getState().error) onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.75rem', borderRadius: 8,
    border: `1px solid ${border}`, background: dark ? '#0a0b0f' : '#f8fafc',
    color: dark ? '#e2e8f0' : '#1a202c', fontSize: '0.85rem', outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background: bg, borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 400,
        border: `1px solid ${border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textSec }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <input
              type="text" placeholder="Name" value={name}
              onChange={e => setName(e.target.value)} style={inputStyle}
              aria-label="Name"
            />
          )}
          <input
            type="email" placeholder="Email" value={email} required
            onChange={e => { setEmail(e.target.value); clearError(); }}
            style={inputStyle} aria-label="Email" autoComplete="email"
          />
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'} placeholder="Password" value={password} required
              onChange={e => { setPassword(e.target.value); clearError(); }}
              style={{ ...inputStyle, paddingRight: 40 }}
              aria-label="Password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
            />
            <button type="button" onClick={() => setShowPw(!showPw)} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: textSec,
            }} aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {mode === 'register' && (
            <p style={{ fontSize: '0.68rem', color: textSec, margin: 0 }}>
              Min 8 chars, 1 uppercase, 1 number
            </p>
          )}

          {error && (
            <div style={{
              padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.78rem',
              background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430',
            }} role="alert">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            padding: '0.7rem', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: accent, color: '#fff', fontSize: '0.88rem', fontWeight: 600,
            opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
          }}>
            {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); clearError(); }}
            style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: '0.82rem' }}>
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
