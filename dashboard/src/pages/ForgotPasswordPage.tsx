import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const accent = '#5a9e87';
const gradient = 'linear-gradient(135deg, #4a8e77, #5ab0a0, #5ab0a0)';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar código.');
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: t.text, marginBottom: '0.5rem', textAlign: 'center' }}>
            {sent ? 'Código Enviado' : 'Esqueci minha senha'}
          </h2>
          {!sent ? (
            <>
              <p style={{ color: t.textSecondary, textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Digite seu email para receber o código de redefinição
              </p>
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(224,112,112,0.1)', border: '1px solid rgba(224,112,112,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#e89090', fontSize: '0.85rem' }}>
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', color: t.label, fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = accent} onBlur={e => e.currentTarget.style.borderColor = t.inputBorder} />
                </div>
                <button type="submit" disabled={loading} style={{
                  width: '100%', padding: '0.8rem', background: gradient,
                  border: 'none', color: 'white', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: '0.95rem', opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
                }}>
                  {loading ? 'Enviando...' : 'Enviar Código'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem', color: '#4ead8a', fontSize: '0.85rem' }}>
                <CheckCircle size={16} /> Se o email existir, um código foi enviado.
              </div>
              <button onClick={() => navigate('/reset-password', { state: { email } })} style={{
                width: '100%', padding: '0.8rem', background: gradient,
                border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer',
                fontWeight: 600, fontSize: '0.95rem', transition: 'all 0.2s',
              }}>
                Inserir Código
              </button>
            </>
          )}
        </div>
        <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/login" style={{ color: accent, textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <ArrowLeft size={16} /> Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
