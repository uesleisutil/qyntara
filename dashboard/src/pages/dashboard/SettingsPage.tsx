import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Settings, Trash2, Shield, Lock, CreditCard, AlertTriangle, CheckCircle, ExternalLink, Bell, Keyboard, Target, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL } from '../../config';

type NotifCategory = 'drift' | 'anomaly' | 'cost' | 'degradation' | 'system';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const SettingsPage: React.FC = () => {
  const { darkMode } = useOutletContext<DashboardContext>();
  const { user, logout, completeOnboarding, updateNotificationPreferences } = useAuth();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const isPro = user?.plan === 'pro';

  // Notification preferences (persisted to backend)
  const notifCategories: { id: NotifCategory; label: string; desc: string }[] = [
    { id: 'degradation', label: 'Degradação do modelo', desc: 'Queda de performance nas previsões' },
    { id: 'drift', label: 'Data Drift', desc: 'Mudanças na distribuição dos dados' },
    { id: 'anomaly', label: 'Anomalias de dados', desc: 'Problemas de qualidade e outliers' },
    { id: 'cost', label: 'Alertas de custo', desc: 'Avisos de orçamento e picos de custo' },
    { id: 'system', label: 'Saúde do sistema', desc: 'Infraestrutura e disponibilidade' },
  ];

  const savedPrefs = user?.notificationPreferences;
  const [emailTypes, setEmailTypes] = useState<NotifCategory[]>(savedPrefs?.emailTypes as NotifCategory[] || ['degradation', 'system']);
  const [smsTypes, setSmsTypes] = useState<NotifCategory[]>(savedPrefs?.smsTypes as NotifCategory[] || []);
  const [quietEnabled, setQuietEnabled] = useState(savedPrefs?.quietHours?.enabled ?? false);
  const [quietStart, setQuietStart] = useState(savedPrefs?.quietHours?.start ?? '22:00');
  const [quietEnd, setQuietEnd] = useState(savedPrefs?.quietHours?.end ?? '08:00');
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);
  const [notifError, setNotifError] = useState('');

  // Sync state when user prefs change (e.g. after login refresh)
  useEffect(() => {
    if (savedPrefs) {
      setEmailTypes(savedPrefs.emailTypes as NotifCategory[] || []);
      setSmsTypes(savedPrefs.smsTypes as NotifCategory[] || []);
      if (savedPrefs.quietHours) {
        setQuietEnabled(savedPrefs.quietHours.enabled ?? false);
        setQuietStart(savedPrefs.quietHours.start ?? '22:00');
        setQuietEnd(savedPrefs.quietHours.end ?? '08:00');
      }
    }
  }, [savedPrefs]);

  const toggleCategory = useCallback((list: NotifCategory[], setList: React.Dispatch<React.SetStateAction<NotifCategory[]>>, cat: NotifCategory) => {
    setList(list.includes(cat) ? list.filter(c => c !== cat) : [...list, cat]);
  }, []);

  const saveNotifPrefs = useCallback(async () => {
    if (!isPro) return;
    setNotifSaving(true); setNotifError(''); setNotifSaved(false);
    try {
      await updateNotificationPreferences({
        emailTypes,
        smsTypes,
        quietHours: { enabled: quietEnabled, start: quietStart, end: quietEnd },
      });
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 3000);
    } catch {
      setNotifError('Erro ao salvar preferências');
    } finally { setNotifSaving(false); }
  }, [isPro, emailTypes, smsTypes, quietEnabled, quietStart, quietEnd, updateNotificationPreferences]);

  const theme = {
    bg: darkMode ? '#0f1117' : '#f8f9fb',
    cardBg: darkMode ? '#1a1d27' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f1117',
    textSecondary: darkMode ? '#9ba1b0' : '#5f6577',
    border: darkMode ? '#2a2e3a' : '#e0e2e8',
    hover: darkMode ? '#2a2e3a' : '#f1f2f6',
  };

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg, border: `1px solid ${theme.border}`,
    borderRadius: 12, padding: 'clamp(1rem, 3vw, 1.5rem)', marginBottom: '1rem',
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'EXCLUIR') return;
    setDeleting(true); setDeleteError('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Erro ao excluir conta');
      }
      setDeleteSuccess(true);
      setTimeout(async () => { await logout(); navigate('/'); }, 3000);
    } catch (err: any) {
      setDeleteError(err.message);
    } finally { setDeleting(false); }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>
        <Settings size={20} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Configurações
      </h1>
      <p style={{ color: theme.textSecondary, fontSize: '0.82rem', marginBottom: '1.25rem' }}>
        Gerencie sua conta e preferências
      </p>

      {/* Account info */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem' }}>Minha Conta</h3>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {[
            { label: 'Email', value: user?.email || '—' },
            { label: 'Nome', value: user?.name || '—' },
            { label: 'Plano', value: user?.plan === 'pro' ? 'Pro' : 'Gratuito' },
            { label: 'Perfil investidor', value: user?.investorProfile ? user.investorProfile.charAt(0).toUpperCase() + user.investorProfile.slice(1) : 'Não definido' },
            { label: 'Email verificado', value: user?.emailVerified ? 'Sim ✓' : 'Não — verifique seu email' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: `1px solid ${theme.border}` }}>
              <span style={{ fontSize: '0.82rem', color: theme.textSecondary }}>{item.label}</span>
              <span style={{ fontSize: '0.82rem', color: theme.text, fontWeight: 500 }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem' }}>Ações Rápidas</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {[
            { icon: <Lock size={15} />, label: 'Alterar senha', path: '/dashboard/change-password' },
            { icon: <CreditCard size={15} />, label: 'Gerenciar assinatura', path: '/dashboard/upgrade' },
            { icon: <Shield size={15} />, label: 'Política de Privacidade', path: '/privacidade' },
          ].map((item, i) => (
            <button key={i} onClick={() => navigate(item.path)} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.75rem',
              background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: 8,
              color: theme.textSecondary, cursor: 'pointer', fontSize: '0.82rem', textAlign: 'left',
              transition: 'background 0.15s', width: '100%',
            }}
              onMouseEnter={e => e.currentTarget.style.background = theme.hover}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {item.icon} {item.label} <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.4 }} />
            </button>
          ))}
        </div>
      </div>

      {/* Investor Profile */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Target size={16} /> Perfil de Investidor
        </h3>
        <p style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '0.75rem', lineHeight: 1.5 }}>
          Seu perfil ajuda a personalizar as recomendações.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {([
            { id: 'conservador' as const, label: 'Conservador', icon: <Shield size={14} />, color: '#10b981' },
            { id: 'moderado' as const, label: 'Moderado', icon: <Target size={14} />, color: '#3b82f6' },
            { id: 'arrojado' as const, label: 'Arrojado', icon: <Zap size={14} />, color: '#f59e0b' },
          ]).map(p => {
            const selected = user?.investorProfile === p.id;
            return (
              <button key={p.id} disabled={profileSaving} onClick={async () => {
                setProfileSaving(true); setProfileSaved(false);
                try { await completeOnboarding(p.id); setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2000); } catch { /* silent */ }
                finally { setProfileSaving(false); }
              }} style={{
                padding: '0.5rem 0.85rem', borderRadius: 8, cursor: profileSaving ? 'wait' : 'pointer',
                border: selected ? `2px solid ${p.color}` : `1px solid ${theme.border}`,
                background: selected ? `${p.color}12` : 'transparent',
                color: selected ? p.color : theme.textSecondary,
                fontSize: '0.82rem', fontWeight: selected ? 600 : 400,
                display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.15s',
              }}>
                {p.icon} {p.label} {selected && <CheckCircle size={12} />}
              </button>
            );
          })}
        </div>
        {profileSaved && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <CheckCircle size={12} /> Perfil atualizado
          </div>
        )}
      </div>

      {/* Notificações — Preferências */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Bell size={16} /> Notificações
        </h3>
        <p style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '0.75rem', lineHeight: 1.5 }}>
          Escolha quais tipos de notificação deseja receber.
          {!isPro && <span style={{ color: '#f59e0b' }}> Disponível apenas para assinantes Pro.</span>}
        </p>

        {/* Email types */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem' }}>Email</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {notifCategories.map(cat => {
              const checked = emailTypes.includes(cat.id);
              return (
                <label key={cat.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.6rem',
                  borderRadius: 8, border: `1px solid ${checked ? '#3b82f640' : theme.border}`,
                  background: checked ? (darkMode ? '#3b82f60a' : '#3b82f606') : 'transparent',
                  cursor: isPro ? 'pointer' : 'not-allowed', opacity: isPro ? 1 : 0.5,
                  transition: 'border-color 0.15s, background 0.15s',
                }}>
                  <input type="checkbox" checked={checked} disabled={!isPro}
                    onChange={() => toggleCategory(emailTypes, setEmailTypes, cat.id)}
                    style={{ width: 15, height: 15, cursor: isPro ? 'pointer' : 'not-allowed', accentColor: '#3b82f6' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 500, color: theme.text }}>{cat.label}</div>
                    <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{cat.desc}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* SMS types */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem' }}>SMS (apenas alertas críticos)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {notifCategories.map(cat => {
              const checked = smsTypes.includes(cat.id);
              return (
                <label key={cat.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.6rem',
                  borderRadius: 8, border: `1px solid ${checked ? '#10b98140' : theme.border}`,
                  background: checked ? (darkMode ? '#10b9810a' : '#10b98106') : 'transparent',
                  cursor: isPro ? 'pointer' : 'not-allowed', opacity: isPro ? 1 : 0.5,
                  transition: 'border-color 0.15s, background 0.15s',
                }}>
                  <input type="checkbox" checked={checked} disabled={!isPro}
                    onChange={() => toggleCategory(smsTypes, setSmsTypes, cat.id)}
                    style={{ width: 15, height: 15, cursor: isPro ? 'pointer' : 'not-allowed', accentColor: '#10b981' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 500, color: theme.text }}>{cat.label}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Quiet hours */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: isPro ? 'pointer' : 'not-allowed', opacity: isPro ? 1 : 0.5 }}>
            <input type="checkbox" checked={quietEnabled} disabled={!isPro}
              onChange={e => setQuietEnabled(e.target.checked)}
              style={{ width: 15, height: 15, cursor: isPro ? 'pointer' : 'not-allowed' }}
            />
            <span style={{ fontSize: '0.82rem', fontWeight: 500, color: theme.text }}>Horário silencioso (pausar notificações não-críticas)</span>
          </label>
          {quietEnabled && isPro && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', marginLeft: '1.5rem' }}>
              <div>
                <label htmlFor="qstart" style={{ fontSize: '0.72rem', color: theme.textSecondary }}>Início</label>
                <input id="qstart" type="time" value={quietStart} onChange={e => setQuietStart(e.target.value)}
                  style={{ display: 'block', padding: '0.35rem 0.5rem', borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: '0.82rem' }}
                />
              </div>
              <div>
                <label htmlFor="qend" style={{ fontSize: '0.72rem', color: theme.textSecondary }}>Fim</label>
                <input id="qend" type="time" value={quietEnd} onChange={e => setQuietEnd(e.target.value)}
                  style={{ display: 'block', padding: '0.35rem 0.5rem', borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: '0.82rem' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Save button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={saveNotifPrefs} disabled={!isPro || notifSaving} style={{
            padding: '0.5rem 1rem', borderRadius: 8, border: 'none', fontSize: '0.82rem', fontWeight: 600,
            background: isPro ? '#3b82f6' : '#64748b', color: 'white',
            cursor: isPro && !notifSaving ? 'pointer' : 'not-allowed',
            opacity: notifSaving ? 0.6 : 1, transition: 'background 0.15s',
          }}>
            {notifSaving ? 'Salvando...' : 'Salvar preferências'}
          </button>
          {notifSaved && (
            <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <CheckCircle size={12} /> Preferências salvas
            </span>
          )}
          {notifError && <span style={{ fontSize: '0.75rem', color: '#f87171' }}>{notifError}</span>}
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Keyboard size={16} /> Atalhos de Teclado
        </h3>
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {[
            { keys: 'Ctrl + K', desc: 'Buscar ticker na tabela' },
            { keys: '1', desc: 'Ir para Recomendações' },
            { keys: '2', desc: 'Ir para Explicabilidade' },
            { keys: '3', desc: 'Ir para Backtesting' },
            { keys: '4', desc: 'Ir para Performance' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: `1px solid ${theme.border}` }}>
              <span style={{ fontSize: '0.82rem', color: theme.textSecondary }}>{s.desc}</span>
              <kbd style={{
                padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600,
                background: darkMode ? '#0f1117' : '#f1f2f6', border: `1px solid ${theme.border}`,
                color: theme.text, fontFamily: 'monospace',
              }}>{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>

      {/* LGPD — Delete account */}
      <div style={{ ...cardStyle, borderColor: 'rgba(239,68,68,0.3)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f87171', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Trash2 size={16} /> Excluir Minha Conta
        </h3>
        <p style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: '0.75rem' }}>
          Conforme a LGPD (Art. 18), você pode solicitar a exclusão total dos seus dados pessoais.
          Esta ação é irreversível e removerá permanentemente sua conta, histórico e dados associados.
        </p>

        {deleteSuccess ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.85rem' }}>
            <CheckCircle size={16} /> Conta excluída com sucesso. Redirecionando...
          </div>
        ) : !showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)} style={{
            padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)',
            background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500,
          }}>
            Solicitar exclusão de dados
          </button>
        ) : (
          <div style={{ padding: '0.75rem', borderRadius: 8, background: darkMode ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', color: '#f87171', fontSize: '0.82rem', fontWeight: 600 }}>
              <AlertTriangle size={15} /> Confirme a exclusão
            </div>
            <p style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>
              Digite <strong style={{ color: '#f87171' }}>EXCLUIR</strong> para confirmar:
            </p>
            <input
              type="text" value={deleteInput} onChange={e => setDeleteInput(e.target.value)}
              placeholder="EXCLUIR"
              style={{
                width: '100%', padding: '0.5rem', borderRadius: 6, border: `1px solid ${theme.border}`,
                background: theme.bg, color: theme.text, fontSize: '0.85rem', marginBottom: '0.5rem',
                boxSizing: 'border-box',
              }}
            />
            {deleteError && <p style={{ color: '#f87171', fontSize: '0.78rem', marginBottom: '0.5rem' }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); setDeleteError(''); }} style={{
                padding: '0.45rem 0.75rem', borderRadius: 6, border: `1px solid ${theme.border}`,
                background: 'transparent', color: theme.textSecondary, cursor: 'pointer', fontSize: '0.8rem',
              }}>
                Cancelar
              </button>
              <button onClick={handleDeleteAccount} disabled={deleteInput !== 'EXCLUIR' || deleting} style={{
                padding: '0.45rem 0.75rem', borderRadius: 6, border: 'none',
                background: deleteInput === 'EXCLUIR' ? '#ef4444' : '#64748b',
                color: 'white', cursor: deleteInput === 'EXCLUIR' ? 'pointer' : 'not-allowed',
                fontSize: '0.8rem', fontWeight: 600, opacity: deleting ? 0.6 : 1,
              }}>
                {deleting ? 'Excluindo...' : 'Excluir permanentemente'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
