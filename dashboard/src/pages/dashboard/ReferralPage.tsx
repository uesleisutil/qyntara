import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Gift, Copy, Check, Users, Crown, Clock, Share2, Mail,
  CheckCircle, XCircle, Loader2, Trophy, Sparkles,
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { brand } from '../../styles/theme';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

interface ReferralStats {
  referralCode: string;
  totalReferred: number;
  activePaid: number;
  rewardsEarned: number;
  pendingRewards: number;
  referrals: {
    name: string;
    email: string;
    status: 'pending' | 'paid' | 'qualified' | 'expired';
    createdAt: string;
    qualifiedAt?: string;
  }[];
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Cadastrado', color: '#f59e0b', icon: <Clock size={13} /> },
  paid: { label: 'Pagou — aguardando 7 dias', color: '#3b82f6', icon: <Loader2 size={13} /> },
  qualified: { label: 'Qualificado ✓', color: '#10b981', icon: <CheckCircle size={13} /> },
  expired: { label: 'Cancelou', color: '#ef4444', icon: <XCircle size={13} /> },
};

const ReferralPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/auth/stats?type=referral`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStats(await res.json());
      } else {
        // No referral code yet — generate one
        setStats(null);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const generateCode = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/auth/free-ticker`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-referral' }),
      });
      if (res.ok) await fetchStats();
    } catch { /* silent */ }
    finally { setGenerating(false); }
  };

  const referralLink = stats?.referralCode
    ? `${window.location.origin}${window.location.pathname}#/register?ref=${stats.referralCode}`
    : '';

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const text = `Estou usando a Qyntara para recomendações de ações com IA. Cadastre-se com meu link e nós dois ganhamos 1 mês Pro grátis: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareEmail = () => {
    const subject = 'Convite Qyntara — 1 mês Pro grátis';
    const body = `Oi! Estou usando a Qyntara para recomendações de ações com IA e está sendo incrível.\n\nCadastre-se com meu link e nós dois ganhamos 1 mês Pro grátis:\n${referralLink}\n\nA recompensa é ativada quando você assina e permanece por 7 dias.`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const card: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1d27' : '#fff'),
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: 'clamp(1rem, 3vw, 1.5rem)',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0', color: theme.textSecondary }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{
        ...card,
        background: darkMode
          ? `linear-gradient(135deg, rgba(37,99,235,0.15), rgba(16,185,129,0.1))`
          : `linear-gradient(135deg, rgba(37,99,235,0.06), rgba(16,185,129,0.04))`,
        textAlign: 'center', padding: 'clamp(1.5rem, 4vw, 2.5rem)',
        marginBottom: '1.25rem',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 1rem',
          background: brand.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Gift size={28} color="white" />
        </div>
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.6rem)', fontWeight: 700, color: theme.text, margin: '0 0 0.5rem' }}>
          Indique e Ganhe
        </h1>
        <p style={{ color: theme.textSecondary, fontSize: '0.9rem', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
          Convide amigos para a Qyntara. Quando seu indicado assinar o Pro e permanecer por 7 dias,
          vocês dois ganham <span style={{ color: '#10b981', fontWeight: 700 }}>1 mês Pro grátis</span>.
        </p>
      </div>

      {/* How it works */}
      <div style={{ ...card, marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={16} color="#f59e0b" /> Como funciona
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          {[
            { step: '1', title: 'Compartilhe', desc: 'Envie seu link para amigos', icon: <Share2 size={20} />, color: '#3b82f6' },
            { step: '2', title: 'Amigo assina', desc: 'Ele se cadastra e paga o Pro', icon: <Crown size={20} />, color: '#f59e0b' },
            { step: '3', title: 'Aguarde 7 dias', desc: 'Período de confirmação', icon: <Clock size={20} />, color: '#8b5cf6' },
            { step: '4', title: 'Ambos ganham', desc: '1 mês Pro grátis cada', icon: <Trophy size={20} />, color: '#10b981' },
          ].map(s => (
            <div key={s.step} style={{
              padding: '1rem', borderRadius: 10, textAlign: 'center',
              background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${theme.border}`,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', margin: '0 auto 0.6rem',
                background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: s.color,
              }}>{s.icon}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text, marginBottom: '0.2rem' }}>{s.title}</div>
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Referral link */}
      {!stats?.referralCode ? (
        <div style={{ ...card, textAlign: 'center', marginBottom: '1.25rem' }}>
          <p style={{ color: theme.textSecondary, fontSize: '0.88rem', marginBottom: '1rem' }}>
            Gere seu código de indicação para começar a convidar amigos.
          </p>
          <button onClick={generateCode} disabled={generating} style={{
            padding: '0.75rem 2rem', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: brand.gradient, color: 'white', fontWeight: 600, fontSize: '0.9rem',
            opacity: generating ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          }}>
            {generating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Gift size={16} />}
            {generating ? 'Gerando...' : 'Gerar meu link'}
          </button>
        </div>
      ) : (
        <div style={{ ...card, marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem' }}>
            Seu link de indicação
          </h2>
          <div style={{
            display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap',
          }}>
            <div style={{
              flex: 1, minWidth: 200, padding: '0.65rem 0.85rem', borderRadius: 8,
              background: darkMode ? '#0f1117' : '#f1f2f6',
              border: `1px solid ${theme.border}`, fontSize: '0.82rem', color: theme.text,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'monospace',
            }}>
              {referralLink}
            </div>
            <button onClick={copyLink} style={{
              padding: '0.65rem 1rem', borderRadius: 8, border: `1px solid ${theme.border}`,
              background: copied ? 'rgba(16,185,129,0.1)' : 'transparent',
              color: copied ? '#10b981' : theme.textSecondary, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 500,
              transition: 'all 0.15s',
            }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button onClick={shareWhatsApp} style={{
              padding: '0.55rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#25D366', color: 'white', fontSize: '0.8rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
              <Share2 size={14} /> WhatsApp
            </button>
            <button onClick={shareEmail} style={{
              padding: '0.55rem 1rem', borderRadius: 8, border: `1px solid ${theme.border}`,
              background: 'transparent', color: theme.textSecondary, fontSize: '0.8rem', fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
              <Mail size={14} /> Email
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Indicados', value: stats.totalReferred, icon: <Users size={18} />, color: '#3b82f6' },
            { label: 'Qualificados', value: stats.activePaid, icon: <CheckCircle size={18} />, color: '#10b981' },
            { label: 'Meses ganhos', value: stats.rewardsEarned, icon: <Crown size={18} />, color: '#f59e0b' },
            { label: 'Pendentes', value: stats.pendingRewards, icon: <Clock size={18} />, color: '#8b5cf6' },
          ].map(s => (
            <div key={s.label} style={{
              ...card, textAlign: 'center', padding: '1rem',
            }}>
              <div style={{ color: s.color, marginBottom: '0.4rem' }}>{s.icon}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: theme.text }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Referral history */}
      {stats && stats.referrals.length > 0 && (
        <div style={card}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem' }}>
            Histórico de indicações
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {stats.referrals.map((r, i) => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.6rem 0.75rem', borderRadius: 8,
                  background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${theme.border}`, flexWrap: 'wrap', gap: '0.5rem',
                }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, color: theme.text }}>{r.name || r.email}</div>
                    <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
                      {new Date(r.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    fontSize: '0.75rem', fontWeight: 500, color: st.color,
                    padding: '0.2rem 0.6rem', borderRadius: 20,
                    background: `${st.color}15`,
                  }}>
                    {st.icon} {st.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ReferralPage;
