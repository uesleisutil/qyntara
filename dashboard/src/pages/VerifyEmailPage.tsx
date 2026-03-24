import { brand } from '../styles/theme';
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const accent = '#3b82f6';
const gradient = 'linear-gradient(135deg, #2563eb, #3b82f6, #3b82f6)';

const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, verifyEmail, resendCode } = useAuth();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const email = user?.email || '';

  useEffect(() => { if (!email) navigate('/register'); }, [email, navigate]);

  useEffect(() => {
    if (cooldown > 0) { const t = setTimeout(() => setCooldown(c => c - 1), 1000); return () => clearTimeout(t); }
  }, [cooldown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) newCode[i] = pasted[i];
    setCode(newCode);
    if (pasted.length > 0) inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccess('');
    const fullCode = code.join('');
    if (fullCode.length !== 6) { setError('Digite o código completo de 6 dígitos.'); return; }
    setLoading(true);
    try {
      await verifyEmail(email, fullCode);
      setSuccess('Email verificado com sucesso!');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err: any) { setError(err.message || 'Código inválido ou expirado.'); }
    finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true); setError(''); setSuccess('');
    try { await resendCode(email); setSuccess('Novo código enviado para seu email.'); setCooldown(60); }
    catch (err: any) { setError(err.message || 'Erro ao reenviar código.'); }
    finally { setResending(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: 'clamp(38px, 10vw, 48px)', height: 'clamp(44px, 12vw, 56px)', textAlign: 'center',
    fontSize: 'clamp(1.1rem, 4vw, 1.5rem)', fontWeight: 700,
    background: '#1a1d27', border: '1px solid #2a2e3a', borderRadius: 8, color: '#f1f0f9', outline: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '2.5rem', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem' }}>Q</span>
          </div>
          <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f1f0f9' }}>Qyntara</span>
        </div>
        <div style={{ background: brand.alpha(0.03), border: '1px solid #2a2e3a', borderRadius: 16, padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f0f9', marginBottom: '0.5rem', textAlign: 'center' }}>Verificar Email</h2>
          <p style={{ color: '#6b7280', textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Enviamos um código de 6 dígitos para<br /><span style={{ color: accent }}>{email}</span>
          </p>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#f87171', fontSize: '0.85rem' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {success && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#10b981', fontSize: '0.85rem' }}>
              <CheckCircle size={16} /> {success}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.5rem' }} onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input key={i} ref={el => { inputRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1}
                  value={digit} onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)}
                  style={{ ...inputStyle, borderColor: digit ? accent : '#2a2e3a' }}
                  onFocus={e => e.currentTarget.style.borderColor = accent} onBlur={e => { if (!digit) e.currentTarget.style.borderColor = '#2a2e3a'; }}
                  aria-label={`Dígito ${i + 1}`} />
              ))}
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '0.8rem', background: gradient,
              border: 'none', color: 'white', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: '0.95rem', opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
            }}>
              {loading ? 'Verificando...' : 'Verificar Email'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            <button onClick={handleResend} disabled={resending || cooldown > 0} style={{
              background: 'none', border: 'none', color: cooldown > 0 ? '#6b7280' : accent,
              cursor: cooldown > 0 ? 'default' : 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            }}>
              <RefreshCw size={14} /> {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar código'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
