import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Phone, CheckCircle, AlertTriangle, MessageCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const ChangePhonePage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [phone, setPhone] = useState('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/phone`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          setPhone(data.phone || '');
          setWhatsappEnabled(data.whatsappEnabled || false);
        }
      } catch { /* silent */ }
      finally { setFetching(false); }
    })();
  }, []);

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length <= 2) return `+${digits}`;
    if (digits.length <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
    if (digits.length <= 9) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  };

  const handlePhoneChange = (val: string) => {
    const raw = val.replace(/\D/g, '');
    if (raw.length <= 13) setPhone(raw ? formatPhone(raw) : '');
  };

  const phoneClean = phone.replace(/\D/g, '');
  const isValid = phoneClean.length >= 10 && phoneClean.length <= 15;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid && phoneClean.length > 0) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/auth/phone`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ phone: phoneClean ? `+${phoneClean}` : '', whatsappEnabled }),
      });
      if (res.ok) {
        setSuccess('Telefone atualizado com sucesso!');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'Erro ao atualizar');
      }
    } catch { setError('Erro de conexão'); }
    finally { setLoading(false); }
  };

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a2626' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '2rem',
    maxWidth: 480, margin: '0 auto',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.75rem',
    background: darkMode ? '#121a1a' : '#f6faf8', border: `1px solid ${theme.border}`,
    borderRadius: 8, color: theme.text, fontSize: '0.9rem', outline: 'none',
    boxSizing: 'border-box' as const,
  };

  if (fetching) {
    const sk: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1a2626' : '#d4e5dc'} 25%, ${darkMode ? '#2a3d36' : '#e8f0ed'} 50%, ${darkMode ? '#1a2626' : '#d4e5dc'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ ...sk, height: 28, width: 240, marginBottom: 8 }} />
        <div style={{ ...sk, height: 16, width: 360, marginBottom: 24 }} />
        <div style={{ ...sk, height: 300, maxWidth: 480, margin: '0 auto', borderRadius: 12 }} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>
          Telefone para Alertas
        </h1>
        <p style={{ color: theme.textSecondary, fontSize: '0.875rem' }}>
          Cadastre seu WhatsApp para receber alertas de recomendações e sinais fortes.
        </p>
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

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: theme.text, marginBottom: '0.4rem' }}>
              <Phone size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Número do WhatsApp
            </label>
            <input
              type="tel" value={phone} onChange={e => handlePhoneChange(e.target.value)}
              style={inputStyle} placeholder="+55 (11) 99999-9999"
            />
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginTop: '0.3rem' }}>
              Formato: +55 (DDD) número. Ex: +55 11 999999999
            </div>
          </div>

          {/* WhatsApp toggle */}
          <div style={{
            marginBottom: '1.25rem', padding: '1rem', borderRadius: 8,
            background: darkMode ? '#121a1a' : '#edf5f1',
            border: `1px solid ${whatsappEnabled ? 'rgba(37,211,102,0.3)' : theme.border}`,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <div
                onClick={() => setWhatsappEnabled(!whatsappEnabled)}
                style={{
                  width: 44, height: 24, borderRadius: 12, position: 'relative',
                  background: whatsappEnabled ? '#25d366' : (darkMode ? '#3a5248' : '#b0c8bc'),
                  transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: 'white',
                  position: 'absolute', top: 2, left: whatsappEnabled ? 22 : 2,
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MessageCircle size={16} color="#25d366" /> Receber alertas via WhatsApp
                </div>
                <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginTop: 2 }}>
                  Receba notificações de recomendações, sinais fortes e atualizações diretamente no seu WhatsApp.
                </div>
              </div>
            </label>
          </div>

          {/* Info box */}
          <div style={{
            marginBottom: '1.25rem', padding: '0.75rem', borderRadius: 8,
            background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
            border: `1px solid ${darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)'}`,
          }}>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
              💡 <strong style={{ color: theme.text }}>Como funciona:</strong> Ao ativar os alertas, você receberá mensagens no WhatsApp quando houver recomendações novas, sinais fortes detectados ou atualizações importantes do modelo. Disponível para usuários <strong style={{ color: '#d4a84b' }}>Pro</strong>.
            </div>
          </div>

          <button type="submit" disabled={loading || (phoneClean.length > 0 && !isValid)} style={{
            width: '100%', padding: '0.75rem', borderRadius: 8, border: 'none', fontSize: '0.9rem', fontWeight: 600,
            background: !loading ? 'linear-gradient(135deg, #25d366, #128c7e)' : (darkMode ? '#2a3d36' : '#d4e5dc'),
            color: !loading ? 'white' : theme.textSecondary,
            cursor: !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s', WebkitAppearance: 'none' as any,
          }}>
            {loading ? 'Salvando...' : 'Salvar Telefone'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePhonePage;
