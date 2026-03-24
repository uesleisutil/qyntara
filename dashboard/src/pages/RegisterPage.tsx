import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const accent = '#5a9e87';
const gradient = 'linear-gradient(135deg, #4a8e77, #5ab0a0, #5ab0a0)';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dark] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  const t = {
    bg: dark ? '#121a1a' : '#f6faf8',
    card: dark ? 'rgba(90,158,135,0.03)' : 'white',
    cardBorder: dark ? '#2a3d36' : '#d4e5dc',
    input: dark ? '#1a2626' : '#edf5f1',
    inputBorder: dark ? '#2a3d36' : '#bdd4c8',
    text: dark ? '#e8f0ed' : '#0f1a16',
    textSecondary: dark ? '#8fa89c' : '#5a7268',
    label: dark ? '#8fa89c' : '#3a5248',
  };

  const passwordChecks = [
    { label: 'Mínimo 8 caracteres', valid: password.length >= 8 },
    { label: 'Uma letra maiúscula', valid: /[A-Z]/.test(password) },
    { label: 'Uma letra minúscula', valid: /[a-z]/.test(password) },
    { label: 'Um número', valid: /\d/.test(password) },
    { label: 'Um caractere especial (!@#$%...)', valid: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('As senhas não coincidem.'); return; }
    if (!passwordChecks.every(c => c.valid)) { setError('A senha não atende aos requisitos mínimos.'); return; }
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/verify-email');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta. Tente novamente.');
    } finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', background: t.input, border: `1px solid ${t.inputBorder}`,
    borderRadius: 8, color: t.text, fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s',
  };

  return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '2.5rem', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem' }}>Q</span>
          </div>
          <span style={{ fontSize: '1.35rem', fontWeight: 700, color: t.text }}>Qyntara</span>
        </div>

        <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 16, padding: '2rem', boxShadow: dark ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: t.text, marginBottom: '0.5rem', textAlign: 'center' }}>Criar sua conta</h2>
          <p style={{ color: t.textSecondary, textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Comece a receber recomendações inteligentes</p>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(224,112,112,0.1)', border: '1px solid rgba(224,112,112,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#e89090', fontSize: '0.85rem' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: t.label, fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>Nome</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" required style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = accent} onBlur={e => e.currentTarget.style.borderColor = t.inputBorder} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: t.label, fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = accent} onBlur={e => e.currentTarget.style.borderColor = t.inputBorder} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', color: t.label, fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required style={{ ...inputStyle, paddingRight: '2.5rem' }}
                  onFocus={e => e.currentTarget.style.borderColor = accent} onBlur={e => e.currentTarget.style.borderColor = t.inputBorder} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: t.textSecondary, cursor: 'pointer', padding: 4,
                }} aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {passwordChecks.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: c.valid ? '#4ead8a' : t.textSecondary }}>
                    <CheckCircle size={13} /> {c.label}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', color: t.label, fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>Confirmar Senha</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••" required style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = accent} onBlur={e => e.currentTarget.style.borderColor = t.inputBorder} />
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '0.8rem', background: gradient,
              border: 'none', color: 'white', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: '0.95rem', opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            }}>
              {loading && <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </button>
            <p style={{ fontSize: '0.72rem', color: t.textSecondary, textAlign: 'center', marginTop: '0.75rem', lineHeight: 1.5 }}>
              Ao criar sua conta, você concorda com nossos{' '}
              <Link to="/privacidade" style={{ color: accent, textDecoration: 'underline' }}>Termos de Uso e Política de Privacidade</Link>.
            </p>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: t.textSecondary, fontSize: '0.9rem' }}>
          Já tem conta?{' '}
          <Link to="/login" style={{ color: accent, textDecoration: 'none', fontWeight: 500 }}>Entrar</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: '0.75rem' }}>
          <Link to="/" style={{ color: t.textSecondary, textDecoration: 'none', fontSize: '0.85rem' }}>← Voltar para a página inicial</Link>
        </p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default RegisterPage;
