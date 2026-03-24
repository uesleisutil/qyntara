import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const accent = '#8b5cf6';
const gradient = 'linear-gradient(135deg, #7c3aed, #6366f1, #3b82f6)';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    bg: dark ? '#0c0a1a' : '#f8f7fc',
    card: dark ? 'rgba(139,92,246,0.03)' : 'white',
    cardBorder: dark ? '#2a2745' : '#e8e5f0',
    input: dark ? '#1a1836' : '#f3f1fa',
    inputBorder: dark ? '#2a2745' : '#d1d5db',
    text: dark ? '#f1f0f9' : '#0f0e1a',
    textSecondary: dark ? '#9895b0' : '#64618b',
    label: dark ? '#9895b0' : '#475569',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setError('Email ou senha inválidos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', background: t.input, border: `1px solid ${t.inputBorder}`,
    borderRadius: 8, color: t.text, fontSize: '0.95rem', outline: 'none',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{
      minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '2rem',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '2.5rem', cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          <div style={{ width: 32, height: 32, borderRadius: 8, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem' }}>Q</span>
          </div>
          <span style={{ fontSize: '1.35rem', fontWeight: 700, color: t.text }}>Qyntara</span>
        </div>

        <div style={{
          background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 16,
          padding: '2rem', boxShadow: dark ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: t.text, marginBottom: '0.5rem', textAlign: 'center' }}>
            Bem-vindo de volta
          </h2>
          <p style={{ color: t.textSecondary, textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Entre na sua conta para acessar o dashboard
          </p>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem',
              marginBottom: '1rem', color: '#f87171', fontSize: '0.85rem',
            }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: t.label, fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" required style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = accent}
                onBlur={e => e.currentTarget.style.borderColor = t.inputBorder}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ color: t.label, fontSize: '0.85rem', fontWeight: 500 }}>Senha</label>
                <Link to="/forgot-password" style={{ color: accent, textDecoration: 'none', fontSize: '0.8rem' }}>
                  Esqueci minha senha
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required style={{ ...inputStyle, paddingRight: '2.5rem' }}
                  onFocus={e => e.currentTarget.style.borderColor = accent}
                  onBlur={e => e.currentTarget.style.borderColor = t.inputBorder}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: t.textSecondary, cursor: 'pointer', padding: 4,
                }} aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '0.8rem', background: gradient,
              border: 'none', color: 'white', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: '0.95rem', opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            }}>
              {loading && <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: t.textSecondary, fontSize: '0.9rem' }}>
          Não tem conta?{' '}
          <Link to="/register" style={{ color: accent, textDecoration: 'none', fontWeight: 500 }}>
            Criar conta grátis
          </Link>
        </p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default LoginPage;
