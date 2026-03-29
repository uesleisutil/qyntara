import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { theme } from '../styles';
import { X, Eye, EyeOff, Loader2, Mail, TrendingUp, Shield, Zap, BarChart3 } from 'lucide-react';

interface Props { onClose: () => void; dark: boolean; }
type Step = 'login' | 'register' | 'verify_sent';

export const AuthModal: React.FC<Props> = ({ onClose }) => {
  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const { login, register, loading, error, clearError } = useAuthStore();

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 0.9rem', borderRadius: 10,
    border: `1px solid ${theme.border}`, background: theme.bg,
    color: theme.text, fontSize: '0.88rem', outline: 'none',
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
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.2s ease',
    }} onClick={onClose}>
      <div style={{
        display: 'flex', width: '100%', maxWidth: 820, maxHeight: '90vh',
        borderRadius: 20, overflow: 'hidden',
        border: `1px solid ${theme.border}`,
        boxShadow: '0 32px 100px rgba(0,0,0,0.6)',
        animation: 'slideUp 0.3s ease',
      }} onClick={e => e.stopPropagation()}>

        {/* Left panel — branding */}
        <div style={{
          width: 340, flexShrink: 0, padding: '2.5rem',
          background: `linear-gradient(135deg, ${theme.accent}15, ${theme.purple}15)`,
          borderRight: `1px solid ${theme.border}`,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '2rem' }}>
              <TrendingUp size={24} color={theme.accent} />
              <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>Predikt</span>
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, lineHeight: 1.3, marginBottom: '1rem' }}>
              Inteligência para mercados de predição
            </h3>
            <p style={{ fontSize: '0.82rem', color: theme.textSecondary, lineHeight: 1.6 }}>
              Modelos de deep learning analisam Polymarket e Kalshi em tempo real para encontrar oportunidades.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: <BarChart3 size={16} />, text: 'Scanner de 500+ mercados ao vivo' },
              { icon: <Zap size={16} />, text: 'Sinais de IA com edge detection' },
              { icon: <Shield size={16} />, text: 'Portfólio com gestão de risco' },
            ].map(f => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.78rem', color: theme.textSecondary }}>
                <span style={{ color: theme.accent }}>{f.icon}</span> {f.text}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — form */}
        <div style={{
          flex: 1, padding: '2.5rem', background: theme.card,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          overflowY: 'auto',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted,
            padding: 6, borderRadius: 8,
          }}><X size={18} /></button>

          {step === 'verify_sent' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', margin: '0 auto 1.5rem',
                background: theme.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `2px solid ${theme.green}30`,
              }}>
                <Mail size={32} color={theme.green} />
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.75rem' }}>Verifique seu email</h2>
              <p style={{ color: theme.textSecondary, fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '0.5rem' }}>
                Enviamos um link de verificação para
              </p>
              <p style={{
                color: theme.accent, fontWeight: 600, fontSize: '1rem', marginBottom: '2rem',
                padding: '0.5rem 1rem', borderRadius: 8, background: theme.accentBg, display: 'inline-block',
              }}>{email}</p>
              <p style={{ color: theme.textMuted, fontSize: '0.78rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                Clique no link do email para verificar sua conta e desbloquear todos os recursos. O link expira em 24 horas.
              </p>
              <button onClick={onClose} style={{
                width: '100%', padding: '0.8rem', borderRadius: 10, border: 'none',
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
                color: '#fff', fontSize: '0.92rem', fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(99,102,241,0.25)',
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
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  {step === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
                </h2>
                <p style={{ fontSize: '0.82rem', color: theme.textSecondary }}>
                  {step === 'login'
                    ? 'Entre para acessar seus mercados e sinais'
                    : 'Comece grátis — sem cartão de crédito'}
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {step === 'register' && (
                  <div>
                    <label style={{ fontSize: '0.75rem', color: theme.textSecondary, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome</label>
                    <input type="text" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
                  </div>
                )}
                <div>
                  <label style={{ fontSize: '0.75rem', color: theme.textSecondary, fontWeight: 600, display: 'block', marginBottom: 6 }}>Email</label>
                  <input type="email" placeholder="voce@exemplo.com" value={email} required
                    onChange={e => { setEmail(e.target.value); clearError(); }} style={inputStyle} autoComplete="email" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: theme.textSecondary, fontWeight: 600, display: 'block', marginBottom: 6 }}>Senha</label>
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
                    padding: '0.65rem 0.9rem', borderRadius: 10, fontSize: '0.8rem',
                    background: theme.redBg, color: theme.red, border: `1px solid ${theme.red}20`,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }} role="alert"><X size={14} style={{ flexShrink: 0 }} /> {error}</div>
                )}

                <button type="submit" disabled={loading} style={{
                  padding: '0.8rem', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
                  color: '#fff', fontSize: '0.95rem', fontWeight: 600,
                  opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8, marginTop: 4,
                  boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
                  transition: 'opacity 0.15s, transform 0.15s',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
                  {loading && <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />}
                  {step === 'login' ? 'Entrar' : 'Criar conta'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <button onClick={() => { setStep(step === 'login' ? 'register' : 'login'); clearError(); }}
                  style={{
                    background: 'none', border: 'none', color: theme.textSecondary,
                    cursor: 'pointer', fontSize: '0.82rem',
                  }}>
                  {step === 'login' ? 'Não tem conta? ' : 'Já tem conta? '}
                  <span style={{ color: theme.accent, fontWeight: 600 }}>
                    {step === 'login' ? 'Cadastre-se' : 'Entre'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
