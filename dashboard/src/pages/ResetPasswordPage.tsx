import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const accent = '#5a9e87';
const gradient = 'linear-gradient(135deg, #4a8e77, #2d7d9a, #8b7eb8)';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState((location.state as any)?.email || '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordChecks = [
    { label: 'Mínimo 8 caracteres', valid: newPassword.length >= 8 },
    { label: 'Uma letra maiúscula', valid: /[A-Z]/.test(newPassword) },
    { label: 'Uma letra minúscula', valid: /[a-z]/.test(newPassword) },
    { label: 'Um número', valid: /\d/.test(newPassword) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (newPassword !== confirmPassword) { setError('As senhas não coincidem.'); return; }
    if (!passwordChecks.every(c => c.valid)) { setError('A senha não atende aos requisitos.'); return; }
    setLoading(true);
    try { await resetPassword(email, code, newPassword); setSuccess(true); }
    catch (err: any) { setError(err.message || 'Erro ao redefinir senha.'); }
    finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', background: '#1a2626', border: '1px solid #2a3d36',
    borderRadius: 8, color: '#e8f0ed', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s',
  };

  const logoBlock = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '2.5rem', cursor: 'pointer' }} onClick={() => navigate('/')}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem' }}>Q</span>
      </div>
      <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#e8f0ed' }}>Qyntara</span>
    </div>
  );

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#121a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {logoBlock}
          <div style={{ background: 'rgba(90,158,135,0.03)', border: '1px solid #2a3d36', borderRadius: 16, padding: '2rem', textAlign: 'center' }}>
            <CheckCircle size={48} color="#4ead8a" style={{ marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#e8f0ed', marginBottom: '0.5rem' }}>Senha Redefinida</h2>
            <p style={{ color: '#8fa89c', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Sua senha foi alterada com sucesso.</p>
            <button onClick={() => navigate('/login')} style={{
              width: '100%', padding: '0.8rem', background: gradient,
              border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem',
            }}>Fazer Login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#121a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {logoBlock}
        <div style={{ background: 'rgba(90,158,135,0.03)', border: '1px solid #2a3d36', borderRadius: 16, padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e8f0ed', marginBottom: '0.5rem', textAlign: 'center' }}>Redefinir Senha</h2>
          <p style={{ color: '#8fa89c', textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Digite o código recebido por email e sua nova senha
          </p>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(224,112,112,0.1)', border: '1px solid rgba(224,112,112,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#e89090', fontSize: '0.85rem' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#8fa89c', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = accent} onBlur={e => e.currentTarget.style.borderColor = '#2a3d36'} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#8fa89c', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>Código de Verificação</label>
              <input type="text" inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" required maxLength={6} style={{ ...inputStyle, letterSpacing: '4px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }}
                onFocus={e => e.currentTarget.style.borderColor = accent} onBlur={e => e.currentTarget.style.borderColor = '#2a3d36'} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', color: '#8fa89c', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>Nova Senha</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••" required style={{ ...inputStyle, paddingRight: '2.5rem' }}
                  onFocus={e => e.currentTarget.style.borderColor = accent} onBlur={e => e.currentTarget.style.borderColor = '#2a3d36'} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#8fa89c', cursor: 'pointer', padding: 4,
                }} aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {passwordChecks.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: c.valid ? '#4ead8a' : '#8fa89c' }}>
                    <CheckCircle size={13} /> {c.label}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', color: '#8fa89c', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>Confirmar Nova Senha</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••" required style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = accent} onBlur={e => e.currentTarget.style.borderColor = '#2a3d36'} />
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '0.8rem', background: gradient,
              border: 'none', color: 'white', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: '0.95rem', opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
            }}>
              {loading ? 'Redefinindo...' : 'Redefinir Senha'}
            </button>
          </form>
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

export default ResetPasswordPage;
