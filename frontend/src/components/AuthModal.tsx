import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { PasswordStrength } from './PasswordStrength';
import { theme } from '../styles';
import { X, Eye, EyeOff, Loader2, Mail, TrendingUp, Shield, Zap, BarChart3 } from 'lucide-react';

interface Props { onClose: () => void; dark: boolean; }
type Step = 'login' | 'register' | 'verify_sent';

const COUNTRIES = [
  'Brasil', 'Estados Unidos', 'Portugal', 'Argentina', 'Colômbia', 'México',
  'Chile', 'Espanha', 'Alemanha', 'Reino Unido', 'Canadá', 'Outro',
];
const REFERRALS = [
  { value: '', label: 'Selecione...' },
  { value: 'google', label: 'Google / Busca' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'friend', label: 'Indicação de amigo' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'other', label: 'Outro' },
];

export const AuthModal: React.FC<Props> = ({ onClose }) => {
  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [referral, setReferral] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const { login, register, loading, error, clearError } = useAuthStore();

  const inp: React.CSSProperties = {
    width: '100%', padding: '0.7rem 0.85rem', borderRadius: 10,
    border: `1px solid ${theme.border}`, background: theme.bg,
    color: theme.text, fontSize: '0.85rem', outline: 'none',
    fontFamily: 'inherit', transition: 'border-color 0.2s',
  };
  const lbl: React.CSSProperties = {
    fontSize: '0.72rem', color: theme.textSecondary, fontWeight: 600,
    display: 'block', marginBottom: 5,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 'login') {
      await login(email, password);
      if (!useAuthStore.getState().error) onClose();
    } else {
      if (!acceptTerms) {
        useAuthStore.setState({ error: 'Você precisa aceitar os termos para continuar.' });
        return;
      }
      await register(email, password, name, phone, country, referral);
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
        display: 'flex', width: '100%', maxWidth: 860, maxHeight: '92vh',
        borderRadius: 20, overflow: 'hidden',
        border: `1px solid ${theme.border}`,
        boxShadow: '0 32px 100px rgba(0,0,0,0.6)',
        animation: 'slideUp 0.3s ease',
      }} onClick={e => e.stopPropagation()}>

        {/* Left — branding (hidden on mobile) */}
        <div className="auth-branding" style={{
          width: 320, flexShrink: 0, padding: '2.5rem',
          background: `linear-gradient(160deg, ${theme.accent}12, ${theme.purple}12, ${theme.cyan}08)`,
          borderRight: `1px solid ${theme.border}`,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '2.5rem' }}>
              <TrendingUp size={24} color={theme.accent} />
              <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>Qyntara</span>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.3, marginBottom: '1rem' }}>
              Inteligência para mercados de predição
            </h3>
            <p style={{ fontSize: '0.82rem', color: theme.textSecondary, lineHeight: 1.7 }}>
              Deep learning analisa Polymarket e Kalshi em tempo real para encontrar oportunidades antes da multidão.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

        {/* Right — form */}
        <div style={{
          flex: 1, padding: '2rem 2.5rem', background: theme.card,
          overflowY: 'auto', position: 'relative',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted,
          }}><X size={18} /></button>

          {step === 'verify_sent' ? (
            <div style={{ textAlign: 'center', paddingTop: '2rem' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', margin: '0 auto 1.5rem',
                background: theme.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `2px solid ${theme.green}30`,
              }}><Mail size={32} color={theme.green} /></div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.75rem' }}>Verifique seu email</h2>
              <p style={{ color: theme.textSecondary, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Enviamos um link para</p>
              <p style={{
                color: theme.accent, fontWeight: 600, fontSize: '0.95rem', marginBottom: '2rem',
                padding: '0.5rem 1rem', borderRadius: 8, background: theme.accentBg, display: 'inline-block',
              }}>{email}</p>
              <p style={{ color: theme.textMuted, fontSize: '0.78rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                Clique no link do email para verificar sua conta. O link expira em 24 horas.
              </p>
              <button onClick={onClose} style={{
                width: '100%', padding: '0.8rem', borderRadius: 10, border: 'none',
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
                color: '#fff', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
              }}>Entendi</button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                  {step === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
                </h2>
                <p style={{ fontSize: '0.8rem', color: theme.textSecondary }}>
                  {step === 'login' ? 'Entre para acessar seus mercados' : 'Comece grátis — sem cartão de crédito'}
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {step === 'register' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={lbl}>Nome completo *</label>
                        <input type="text" placeholder="Seu nome" value={name} required minLength={2}
                          onChange={e => setName(e.target.value)} style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>Telefone</label>
                        <input type="tel" placeholder="+55 11 99999-9999" value={phone}
                          onChange={e => setPhone(e.target.value)} style={inp} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={lbl}>País</label>
                        <select value={country} onChange={e => setCountry(e.target.value)}
                          style={{ ...inp, cursor: 'pointer', appearance: 'auto' as any }}>
                          <option value="">Selecione...</option>
                          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Como nos conheceu?</label>
                        <select value={referral} onChange={e => setReferral(e.target.value)}
                          style={{ ...inp, cursor: 'pointer', appearance: 'auto' as any }}>
                          {REFERRALS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label style={lbl}>Email *</label>
                  <input type="email" placeholder="voce@exemplo.com" value={email} required
                    onChange={e => { setEmail(e.target.value); clearError(); }} style={inp} autoComplete="email" />
                </div>

                <div>
                  <label style={lbl}>Senha *</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} required
                      onChange={e => { setPassword(e.target.value); clearError(); }}
                      style={{ ...inp, paddingRight: 44 }}
                      autoComplete={step === 'login' ? 'current-password' : 'new-password'} minLength={8} />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted,
                    }}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                  {step === 'register' && <PasswordStrength password={password} />}
                </div>

                {error && (
                  <div style={{
                    padding: '0.6rem 0.85rem', borderRadius: 10, fontSize: '0.78rem',
                    background: theme.redBg, color: theme.red, border: `1px solid ${theme.red}20`,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }} role="alert"><X size={14} style={{ flexShrink: 0 }} /> {error}</div>
                )}

                {step === 'register' && (
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.5 }}>
                    <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)}
                      style={{ marginTop: 2, accentColor: theme.accent }} />
                    <span>
                      Ao criar minha conta, concordo com os{' '}
                      <a href="/termos" target="_blank" style={{ color: theme.accent, textDecoration: 'none' }}>Termos de Uso</a>,{' '}
                      <a href="/privacidade" target="_blank" style={{ color: theme.accent, textDecoration: 'none' }}>Política de Privacidade</a>{' '}
                      e autorizo o tratamento dos meus dados conforme a LGPD. Seus dados não são usados para treinar modelos de IA.
                      Você pode solicitar a exclusão dos seus dados a qualquer momento.
                    </span>
                  </label>
                )}

                <button type="submit" disabled={loading} style={{
                  padding: '0.8rem', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
                  color: '#fff', fontSize: '0.92rem', fontWeight: 600,
                  opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8, marginTop: 4,
                  boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
                }}>
                  {loading && <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />}
                  {step === 'login' ? 'Entrar' : 'Criar conta'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                <button onClick={() => { setStep(step === 'login' ? 'register' : 'login'); clearError(); }}
                  style={{ background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer', fontSize: '0.82rem' }}>
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
