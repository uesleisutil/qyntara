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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Bell size={16} /> Notificações
          </h3>
          {!isPro && (
            <span style={{
              fontSize: '0.68rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: 10,
              background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
            }}>Apenas Pro</span>
          )}
        </div>
        <p style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '1rem', lineHeight: 1.5 }}>
          Escolha quais alertas receber e por qual canal.
        </p>

        {/* Channel matrix — categories as rows, channels as columns */}
        <div style={{
          borderRadius: 10, border: `1px solid ${theme.border}`, overflow: 'hidden',
          opacity: isPro ? 1 : 0.5, pointerEvents: isPro ? 'auto' : 'none',
        }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 60px 60px',
            padding: '0.55rem 0.75rem', gap: '0.5rem',
            background: darkMode ? '#13151d' : '#f4f5f7',
            borderBottom: `1px solid ${theme.border}`,
          }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Categoria</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>Email</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>SMS</span>
          </div>

          {/* Rows */}
          {notifCategories.map((cat, i) => {
            const emailOn = emailTypes.includes(cat.id);
            const smsOn = smsTypes.includes(cat.id);
            const isLast = i === notifCategories.length - 1;
            const catIcons: Record<string, string> = { degradation: '🔻', drift: '📉', anomaly: '⚠️', cost: '💰', system: '🛡️' };
            return (
              <div key={cat.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 60px 60px',
                padding: '0.6rem 0.75rem', gap: '0.5rem', alignItems: 'center',
                borderBottom: isLast ? 'none' : `1px solid ${theme.border}`,
                transition: 'background 0.12s',
              }}
                onMouseEnter={e => { if (isPro) e.currentTarget.style.background = darkMode ? 'rgba(59,130,246,0.04)' : 'rgba(59,130,246,0.02)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.95rem', lineHeight: 1 }}>{catIcons[cat.id] || '🔔'}</span>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 500, color: theme.text, lineHeight: 1.3 }}>{cat.label}</div>
                    <div style={{ fontSize: '0.68rem', color: theme.textSecondary, lineHeight: 1.3 }}>{cat.desc}</div>
                  </div>
                </div>
                {/* Email toggle */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    onClick={() => toggleCategory(emailTypes, setEmailTypes, cat.id)}
                    aria-label={`Email ${cat.label} ${emailOn ? 'ativado' : 'desativado'}`}
                    role="switch"
                    aria-checked={emailOn}
                    style={{
                      width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: emailOn ? '#3b82f6' : (darkMode ? '#2a2e3a' : '#d1d5db'),
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                      WebkitAppearance: 'none' as any,
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2, left: emailOn ? 18 : 2,
                      width: 16, height: 16, borderRadius: '50%', background: 'white',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>
                {/* SMS toggle */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    onClick={() => toggleCategory(smsTypes, setSmsTypes, cat.id)}
                    aria-label={`SMS ${cat.label} ${smsOn ? 'ativado' : 'desativado'}`}
                    role="switch"
                    aria-checked={smsOn}
                    style={{
                      width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: smsOn ? '#10b981' : (darkMode ? '#2a2e3a' : '#d1d5db'),
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                      WebkitAppearance: 'none' as any,
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2, left: smsOn ? 18 : 2,
                      width: 16, height: 16, borderRadius: '50%', background: 'white',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quiet hours */}
        <div style={{
          marginTop: '1rem', padding: '0.65rem 0.75rem', borderRadius: 10,
          border: `1px solid ${quietEnabled ? (darkMode ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)') : theme.border}`,
          background: quietEnabled ? (darkMode ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.03)') : 'transparent',
          opacity: isPro ? 1 : 0.5, pointerEvents: isPro ? 'auto' : 'none',
          transition: 'border-color 0.2s, background 0.2s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.95rem' }}>🌙</span>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 500, color: theme.text }}>Horário silencioso</div>
                <div style={{ fontSize: '0.68rem', color: theme.textSecondary }}>Pausar alertas não-críticos durante a noite</div>
              </div>
            </div>
            <button
              onClick={() => setQuietEnabled(!quietEnabled)}
              aria-label={`Horário silencioso ${quietEnabled ? 'ativado' : 'desativado'}`}
              role="switch"
              aria-checked={quietEnabled}
              style={{
                width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: quietEnabled ? '#6366f1' : (darkMode ? '#2a2e3a' : '#d1d5db'),
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                WebkitAppearance: 'none' as any,
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: quietEnabled ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%', background: 'white',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
          {quietEnabled && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.65rem', paddingTop: '0.6rem', borderTop: `1px solid ${darkMode ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)'}` }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="qstart" style={{ fontSize: '0.68rem', color: theme.textSecondary, fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Início</label>
                <input id="qstart" type="time" value={quietStart} onChange={e => setQuietStart(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: 8, border: `1px solid ${theme.border}`, background: darkMode ? '#0f1117' : '#f8f9fb', color: theme.text, fontSize: '0.82rem', boxSizing: 'border-box' as const }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="qend" style={{ fontSize: '0.68rem', color: theme.textSecondary, fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Fim</label>
                <input id="qend" type="time" value={quietEnd} onChange={e => setQuietEnd(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: 8, border: `1px solid ${theme.border}`, background: darkMode ? '#0f1117' : '#f8f9fb', color: theme.text, fontSize: '0.82rem', boxSizing: 'border-box' as const }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Save button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
          <button onClick={saveNotifPrefs} disabled={!isPro || notifSaving} style={{
            padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', fontSize: '0.82rem', fontWeight: 600,
            background: isPro ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : '#64748b', color: 'white',
            cursor: isPro && !notifSaving ? 'pointer' : 'not-allowed',
            opacity: notifSaving ? 0.6 : 1, transition: 'opacity 0.15s',
            boxShadow: isPro ? '0 2px 8px rgba(37,99,235,0.2)' : 'none',
          }}>
            {notifSaving ? 'Salvando...' : 'Salvar preferências'}
          </button>
          {notifSaved && (
            <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <CheckCircle size={12} /> Salvo
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
