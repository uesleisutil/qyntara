import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const ChangePasswordPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const passwordChecks = [
    { label: 'Mínimo 8 caracteres', ok: newPassword.length >= 8 },
    { label: 'Letra maiúscula', ok: /[A-Z]/.test(newPassword) },
    { label: 'Letra minúscula', ok: /[a-z]/.test(newPassword) },
    { label: 'Número', ok: /\d/.test(newPassword) },
    { label: 'Caractere especial', ok: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) },
    { label: 'Senhas coincidem', ok: newPassword.length > 0 && newPassword === confirmPassword },
  ];

  const allValid = passwordChecks.every(c => c.ok) && currentPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allValid) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a2626' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '2rem',
    maxWidth: 480, margin: '0 auto',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.65rem 2.5rem 0.65rem 0.75rem',
    background: darkMode ? '#121a1a' : '#f6faf8', border: `1px solid ${theme.border}`,
    borderRadius: 8, color: theme.text, fontSize: '0.9rem', outline: 'none',
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Alterar Senha</h1>
        <p style={{ color: theme.textSecondary, fontSize: '0.875rem' }}>Atualize sua senha de acesso ao dashboard.</p>
      </div>

      <div style={cardStyle}>
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(224,112,112,0.1)', border: '1px solid rgba(224,112,112,0.3)', color: '#e89090', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}
          {success && (
            <div style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#4ead8a', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={16} /> {success}
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: theme.text, marginBottom: '0.4rem' }}>
              <Lock size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Senha Atual
            </label>
            <div style={{ position: 'relative' }}>
              <input type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inputStyle} placeholder="Digite sua senha atual" />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer', padding: 4 }}>
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: theme.text, marginBottom: '0.4rem' }}>
              <Lock size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Nova Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} placeholder="Digite a nova senha" />
              <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer', padding: 4 }}>
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: theme.text, marginBottom: '0.4rem' }}>
              <Lock size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Confirmar Nova Senha
            </label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} placeholder="Confirme a nova senha" />
          </div>

          {/* Password strength checks */}
          <div style={{ marginBottom: '1.25rem', padding: '0.75rem', borderRadius: 8, background: darkMode ? '#121a1a' : '#f6faf8', border: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: theme.textSecondary, marginBottom: '0.5rem' }}>Requisitos da senha:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
              {passwordChecks.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: c.ok ? '#4ead8a' : theme.textSecondary }}>
                  {c.ok ? <CheckCircle size={12} /> : <span style={{ width: 12, height: 12, borderRadius: '50%', border: `1.5px solid ${theme.textSecondary}`, display: 'inline-block' }} />}
                  {c.label}
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={!allValid || loading} style={{
            width: '100%', padding: '0.75rem', borderRadius: 8, border: 'none', fontSize: '0.9rem', fontWeight: 600,
            background: allValid && !loading ? 'linear-gradient(135deg, #4a8e77, #2d7d9a)' : (darkMode ? '#2a3d36' : '#d4e5dc'),
            color: allValid && !loading ? 'white' : theme.textSecondary, cursor: allValid && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}>
            {loading ? 'Alterando...' : 'Alterar Senha'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
