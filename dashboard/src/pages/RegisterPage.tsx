import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TrendingUp, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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

  const passwordChecks = [
    { label: 'Mínimo 8 caracteres', valid: password.length >= 8 },
    { label: 'Uma letra maiúscula', valid: /[A-Z]/.test(password) },
    { label: 'Uma letra minúscula', valid: /[a-z]/.test(password) },
    { label: 'Um número', valid: /\d/.test(password) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (!passwordChecks.every(c => c.valid)) {
      setError('A senha não atende aos requisitos mínimos.');
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', background: '#1e293b', border: '1px solid #334155',
    borderRadius: 8, color: '#f1f5f9', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s',
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '2rem',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '2.5rem', cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          <TrendingUp size={32} color="#3b82f6" />
          <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f1f5f9' }}>B3 Tactical Ranking</span>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 16, padding: '2rem',
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem', textAlign: 'center' }}>
            Criar sua conta
          </h2>
          <p style={{ color: '#64748b', textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Comece a receber recomendações inteligentes
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
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>Nome</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" required style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'} onBlur={e => e.currentTarget.style.borderColor = '#334155'} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'} onBlur={e => e.currentTarget.style.borderColor = '#334155'} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required style={{ ...inputStyle, paddingRight: '2.5rem' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'} onBlur={e => e.currentTarget.style.borderColor = '#334155'} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4,
                }} aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {passwordChecks.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: c.valid ? '#10b981' : '#64748b' }}>
                    <CheckCircle size={13} /> {c.label}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>Confirmar Senha</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••" required style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'} onBlur={e => e.currentTarget.style.borderColor = '#334155'} />
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '0.8rem', background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              border: 'none', color: 'white', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: '0.95rem', opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
            }}>
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#64748b', fontSize: '0.9rem' }}>
          Já tem conta?{' '}
          <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>Entrar</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
