import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { theme } from '../styles';
import { X, Eye, EyeOff, Loader2, Mail } from 'lucide-react';

interface Props { onClose: () => void; dark: boolean; }
type Step = 'login' | 'register' | 'verify_sent';

export const AuthModal: React.FC<Props> = ({ onClose, dark }) => {
  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const { login, register, loading, error, clearError } = useAuthStore();

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.7rem 0.85rem', borderRadius: 10,
    border: `1px solid ${theme.border}`, background: theme.bg,
    color: theme.text, fontSize: '0.85rem', outline: 'none',
    fontFamily: 'inherit', transition: 'border-color 0.2s',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 'login') {
      await login(email, password);
      if (!useAuthStore.getState().error) onClose();
    } else if (step === 'register') {
      await register(email, password, name);
      if (!useAuthStore.getState().error) setStep('verify_sent');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      animation: 'fadeIn 0.2s ease',
    }} onClick={onClose}>
      <div style={{
        background: theme.card, borderRadius: 18, padding: '2rem', width: '100%', maxWidth: 420,
        border: `1px solid ${theme.border}`, boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        animation: 'slideUp 0.3s ease',
      }} onClick={e => e.stopPropagation()}>

        {step === 'verify_sent' ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 1.25rem',
              background: theme.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Mail size={28} color={theme.green} />
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Verifique seu email</h2>
            <p style={{ color: theme.textSecondary, fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Enviamos um link de verificação para
            </p>
            <p style={{ color: theme.accent, fontWeight: 600, fontSize: '0.92rem', marginBottom: '1.5rem' }}>{email}</p>
            <p style={{ color: theme.textMuted, fontSize: '0.78rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Clique no link do email para verificar sua conta e desbloquear todos os recursos. O link expira em 24 horas.
            </p>
            <button onClick={onClose} style={{
              width: '100%', padding: '0.7rem', borderRadius: 10, border: 'none',
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
              color: '#fff', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
            }}>Entendi</button>
            <p style={{ fontSize: '0.72rem', color: theme.textMuted, marginTop: '1rem' }}>
              Não recebeu? Verifique a pasta de spam ou{' '}
              <button onClick={() => setStep('register')} style={{
                background: 'none', border: 'none', color: theme.accent, cursor: 'pointer',
                fontSize: '0.72rem', textDecoration: 'underline',
              }}>tente novamente</button>
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  {step === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
                </h2>
                <p style={{ fontSize: '0.78rem', color: theme.textSecondary, marginTop: 4 }}>
                  {step === 'login' ? 'Entre para acessar seu painel' : 'Comece a encontrar oportunidades em mercados de predição'}
                </p>
              </div>
              <button onClick={onClose} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, padding: 4, borderRadius: 6,
              }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {step === 'register' && (
                <div>
                  <label style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome</label>
                  <input type="text" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
                </div>
              )}
              <div>
                <label style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 600, display: 'block', marginBottom: 6 }}>Email</label>
                <input type="email" placeholder="voce@exemplo.com" value={email} required
                  onChange={e => { setEmail(e.target.value); clearError(); }} style={inputStyle} autoComplete="email" />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 600, display: 'block', marginBottom: 6 }}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} required
                    onChange={e => { setPassword(e.target.value); clearError(); }}
                    style={{ ...inputStyle, paddingRight: 44 }}
                    autoComplete={step === 'login' ? 'current-password' : 'new-password'} minLength={8} />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted,
                  }}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
                {step === 'register' && (
                  <p style={{ fontSize: '0.65rem', color: theme.textMuted, marginTop: 6 }}>Mín. 8 caracteres, 1 letra maiúscula, 1 número</p>
                )}
              </div>

              {error && (
                <div style={{
                  padding: '0.6rem 0.85rem', borderRadius: 10, fontSize: '0.78rem',
                  background: theme.redBg, color: theme.red, border: `1px solid ${theme.red}25`,
                  display: 'flex', alignItems: 'center', gap: 8,
                }} role="alert"><X size={14} style={{ flexShrink: 0 }} /> {error}</div>
              )}

              <button type="submit" disabled={loading} style={{
                padding: '0.75rem', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
                color: '#fff', fontSize: '0.9rem', fontWeight: 600,
                opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8, marginTop: 4,
                boxShadow: '0 4px 16px rgba(99,102,241,0.25)',
              }}>
                {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                {step === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <button onClick={() => { setStep(step === 'login' ? 'register' : 'login'); clearError(); }}
                style={{ background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer', fontSize: '0.82rem' }}>
                {step === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
