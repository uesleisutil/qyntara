import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Trophy, TrendingUp, Target, Flame, Medal,
  ChevronUp, ChevronDown, Loader2, Calendar, BarChart3,
  Award, Star, Zap, Crown, Briefcase, RefreshCw,
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { brand } from '../../styles/theme';
import { useAuth } from '../../contexts/AuthContext';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }
interface ChallengeData {
  active: boolean; month?: string; startDate: string; endDate: string; carteiraId?: string;
  tickers?: string[];
  userReturn: number; ibovReturn: number; isBeating: boolean;
  streak: number; bestStreak: number; rank: number; totalParticipants: number;
  portfolio: { ticker: string; weight: number; return: number }[];
  history: { date: string; userReturn: number; ibovReturn: number }[];
}
interface LeaderboardEntry { rank: number; name: string; return: number; isCurrentUser: boolean; avatar?: string; carteiraName?: string; tickerCount?: number; }
interface Badge { id: string; name: string; description: string; icon: string; earned: boolean; earnedAt?: string; }
interface Carteira { carteiraId: string; name: string; icon: string; color: string; tickers: string[]; }

const BADGE_ICONS: Record<string, React.ReactNode> = {
  first_challenge: <Target size={20} />, beat_ibov_week: <TrendingUp size={20} />,
  beat_ibov_month: <Trophy size={20} />, streak_3: <Flame size={20} />,
  streak_7: <Zap size={20} />, top_10: <Medal size={20} />,
  top_3: <Crown size={20} />, consistent: <Star size={20} />,
};

const getHeaders = () => {
  const token = localStorage.getItem('authToken');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};

const AVATARS = ['🐂', '🦁', '🦅', '🐺', '🦊', '🐻', '🦈', '🐉', '🦉', '🐯', '🦇', '🐸', '🦖', '🐧', '🦋', '🐝'];

const ChallengesPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [carteiras, setCarteiras] = useState<Carteira[]>([]);
  const [pastMonths, setPastMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [showCarteiraSelect, setShowCarteiraSelect] = useState(false);
  const [selectedCarteira, setSelectedCarteira] = useState('');
  const [tab, setTab] = useState<'challenge' | 'leaderboard' | 'badges'>('challenge');
  const [updating, setUpdating] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const isAdmin = user?.role === 'admin';

  const currentMonth = new Date().toISOString().slice(0, 7);

  const fetchData = useCallback(async () => {
    try {
      const h = getHeaders();
      const [cRes, lRes, bRes, cartRes, mRes] = await Promise.all([
        fetch(`${API_BASE_URL}/auth/stats?type=challenge`, { headers: h }),
        fetch(`${API_BASE_URL}/auth/stats?type=leaderboard`, { headers: h }),
        fetch(`${API_BASE_URL}/auth/stats?type=achievements`, { headers: h }),
        fetch(`${API_BASE_URL}/carteiras`, { headers: h }),
        fetch(`${API_BASE_URL}/auth/stats?type=past-months`, { headers: h }),
      ]);
      if (cRes.ok) {
        const data = await cRes.json();
        if (data && data.active) {
          setChallenge({
            active: true, month: data.month || '', startDate: data.startDate || '', endDate: data.endDate || '',
            carteiraId: data.carteiraId || '', userReturn: data.userReturn || 0, ibovReturn: data.ibovReturn || 0,
            isBeating: data.isBeating || false, streak: data.streak || 0, bestStreak: data.bestStreak || 0,
            rank: data.rank || 1, totalParticipants: data.totalParticipants || 1,
            portfolio: data.portfolio || [], history: data.history || [],
          });
        } else { setChallenge(null); }
      }
      if (lRes.ok) { const d = await lRes.json(); setLeaderboard(Array.isArray(d) ? d : []); }
      if (bRes.ok) { const d = await bRes.json(); setBadges(Array.isArray(d) ? d : []); }
      if (cartRes.ok) { const d = await cartRes.json(); setCarteiras(d.carteiras || []); }
      if (mRes.ok) { const d = await mRes.json(); setPastMonths(Array.isArray(d) ? d : []); }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchLeaderboard = useCallback(async (month: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/stats?type=leaderboard&month=${month}`, { headers: getHeaders() });
      if (res.ok) { const d = await res.json(); setLeaderboard(Array.isArray(d) ? d : []); }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { if (selectedMonth) fetchLeaderboard(selectedMonth); }, [selectedMonth, fetchLeaderboard]);

  const joinChallenge = async (carteiraId: string) => {
    setJoining(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/free-ticker`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ action: 'join-challenge', carteiraId }),
      });
      if (res.ok) { setShowCarteiraSelect(false); await fetchData(); }
    } catch { /* silent */ }
    finally { setJoining(false); }
  };

  const handleJoinClick = () => {
    if (carteiras.length === 0) { setShowCarteiraSelect(true); return; }
    if (carteiras.length === 1) {
      if ((carteiras[0].tickers?.length || 0) < 3) { setShowCarteiraSelect(true); return; }
      joinChallenge(carteiras[0].carteiraId); return;
    }
    setShowCarteiraSelect(true);
  };

  const quitChallenge = async () => {
    if (!window.confirm('Tem certeza que deseja sair do desafio? Seu progresso será arquivado.')) return;
    setQuitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/free-ticker`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ action: 'quit-challenge' }),
      });
      if (res.ok) await fetchData();
    } catch { /* silent */ }
    finally { setQuitting(false); }
  };

  const triggerUpdate = async () => {
    setUpdating(true);
    try {
      await fetch(`${API_BASE_URL}/auth/free-ticker`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ action: 'update-challenges' }),
      });
      await fetchData();
    } catch { /* silent */ }
    finally { setUpdating(false); }
  };

  const setAvatar = async (emoji: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/free-ticker`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ action: 'set-avatar', avatar: emoji }),
      });
      if (res.ok) { setShowAvatarPicker(false); await fetchData(); }
    } catch { /* silent */ }
  };

  const card: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1d27' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: 'clamp(1rem, 3vw, 1.5rem)',
  };
  const pctColor = (v: number) => v >= 0 ? '#10b981' : '#ef4444';
  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;
  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-');
    const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${names[parseInt(mo, 10) - 1]} ${y}`;
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0', color: theme.textSecondary }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  const tabBtn = (id: typeof tab, label: string, icon: React.ReactNode) => (
    <button key={id} onClick={() => setTab(id)} style={{
      padding: '0.5rem 1rem', borderRadius: 8, border: `1px solid ${tab === id ? brand.accent : theme.border}`,
      background: tab === id ? brand.alpha(0.12) : 'transparent',
      color: tab === id ? brand.accent : theme.textSecondary,
      cursor: 'pointer', fontSize: '0.82rem', fontWeight: tab === id ? 600 : 400,
      display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.15s',
    }}>{icon} {label}</button>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{
        ...card, textAlign: 'center', padding: 'clamp(1.5rem, 4vw, 2.5rem)', marginBottom: '1.25rem',
        background: darkMode
          ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(239,68,68,0.08))'
          : 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(239,68,68,0.03))',
      }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 1rem', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Trophy size={28} color="white" />
        </div>
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.6rem)', fontWeight: 700, color: theme.text, margin: '0 0 0.5rem' }}>
          🏆 Desafio: Bata o IBOVESPA
        </h1>
        <p style={{ color: theme.textSecondary, fontSize: '0.88rem', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
          Vincule uma carteira e veja se ela supera o índice ao longo do mês.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {tabBtn('challenge', 'Desafio', <Target size={15} />)}
        {tabBtn('leaderboard', 'Ranking', <BarChart3 size={15} />)}
        {tabBtn('badges', 'Conquistas', <Award size={15} />)}
      </div>

      {/* ── Challenge tab ── */}
      {tab === 'challenge' && (
        <>
          {!challenge?.active ? (
            <div style={{ ...card, textAlign: 'center' }}>
              {showCarteiraSelect ? (
                <>
                  <Briefcase size={40} color="#3b82f6" style={{ marginBottom: '0.75rem', opacity: 0.7 }} />
                  {carteiras.length === 0 ? (
                    <>
                      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem' }}>
                        Você ainda não tem carteiras
                      </h2>
                      <p style={{ color: theme.textSecondary, fontSize: '0.85rem', marginBottom: '1rem', maxWidth: 380, margin: '0 auto 1rem' }}>
                        Para participar do desafio, primeiro monte uma carteira com as ações que deseja acompanhar.
                      </p>
                      <button onClick={() => navigate('/dashboard/carteiras')} style={{
                        padding: '0.65rem 1.5rem', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: brand.gradient, color: 'white', fontWeight: 600, fontSize: '0.88rem',
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      }}>
                        <Briefcase size={15} /> Criar carteira
                      </button>
                    </>
                  ) : (
                    <>
                      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem' }}>
                        Escolha a carteira para o desafio
                      </h2>
                      <p style={{ color: theme.textSecondary, fontSize: '0.82rem', marginBottom: '1rem' }}>
                        O retorno dessa carteira será comparado com o IBOVESPA durante o mês.
                        <br /><span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Mínimo de 3 ações na carteira.</span>
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 360, margin: '0 auto 1rem' }}>
                        {carteiras.map(c => {
                          const hasEnough = (c.tickers?.length || 0) >= 3;
                          return (
                          <button key={c.carteiraId} onClick={() => hasEnough && setSelectedCarteira(c.carteiraId)} style={{
                            display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 0.85rem',
                            borderRadius: 10, cursor: hasEnough ? 'pointer' : 'not-allowed', textAlign: 'left', transition: 'all 0.15s',
                            border: selectedCarteira === c.carteiraId ? `2px solid ${c.color || '#3b82f6'}` : `1px solid ${theme.border}`,
                            background: selectedCarteira === c.carteiraId ? `${c.color || '#3b82f6'}10` : 'transparent',
                            opacity: hasEnough ? 1 : 0.5,
                          }}>
                            <span style={{ fontSize: '1.2rem' }}>{c.icon || '💼'}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: theme.text }}>{c.name}</div>
                              <div style={{ fontSize: '0.72rem', color: hasEnough ? theme.textSecondary : '#ef4444' }}>
                                {c.tickers?.length || 0} ações {!hasEnough && '(mín. 3)'}
                              </div>
                            </div>
                          </button>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button onClick={() => setShowCarteiraSelect(false)} style={{
                          padding: '0.55rem 1rem', borderRadius: 8, border: `1px solid ${theme.border}`,
                          background: 'transparent', color: theme.textSecondary, cursor: 'pointer', fontSize: '0.82rem',
                        }}>Cancelar</button>
                        <button onClick={() => joinChallenge(selectedCarteira)} disabled={!selectedCarteira || joining} style={{
                          padding: '0.55rem 1.25rem', borderRadius: 8, border: 'none', cursor: selectedCarteira ? 'pointer' : 'not-allowed',
                          background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: 'white',
                          fontWeight: 600, fontSize: '0.82rem', opacity: selectedCarteira && !joining ? 1 : 0.5,
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                        }}>
                          {joining ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Flame size={14} />}
                          {joining ? 'Entrando...' : 'Confirmar'}
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Trophy size={48} color="#f59e0b" style={{ marginBottom: '1rem', opacity: 0.6 }} />
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem' }}>
                    Participe do desafio de {fmtMonth(currentMonth)}
                  </h2>
                  <p style={{ color: theme.textSecondary, fontSize: '0.88rem', marginBottom: '1.25rem', maxWidth: 400, margin: '0 auto 1.25rem' }}>
                    Vincule uma carteira e acompanhe se ela bate o IBOVESPA ao longo do mês. Sem risco real.
                  </p>
                  <button onClick={handleJoinClick} disabled={joining} style={{
                    padding: '0.75rem 2rem', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: 'white',
                    fontWeight: 600, fontSize: '0.9rem', opacity: joining ? 0.7 : 1,
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  }}>
                    {joining ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Flame size={16} />}
                    {joining ? 'Entrando...' : 'Entrar no desafio'}
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Active challenge stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ ...card, textAlign: 'center', border: `1px solid ${challenge.isBeating ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, background: challenge.isBeating ? (darkMode ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)') : (darkMode ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.03)') }}>
                  <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.3rem' }}>Sua carteira</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: pctColor(challenge.userReturn) }}>{fmtPct(challenge.userReturn)}</div>
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.2rem' }}>{challenge.isBeating ? '🔥 Batendo o IBOV' : 'Abaixo do IBOV'}</div>
                </div>
                <div style={{ ...card, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.3rem' }}>IBOVESPA</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: pctColor(challenge.ibovReturn) }}>{fmtPct(challenge.ibovReturn)}</div>
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.2rem' }}>Benchmark</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'Diferença', value: fmtPct(challenge.userReturn - challenge.ibovReturn), color: pctColor(challenge.userReturn - challenge.ibovReturn), icon: challenge.userReturn >= challenge.ibovReturn ? <ChevronUp size={16} /> : <ChevronDown size={16} /> },
                  { label: 'Sequência', value: `${challenge.streak} dias`, color: '#f59e0b', icon: <Flame size={16} /> },
                  { label: 'Melhor seq.', value: `${challenge.bestStreak} dias`, color: '#8b5cf6', icon: <Star size={16} /> },
                  { label: 'Ranking', value: `#${challenge.rank}`, color: '#3b82f6', icon: <Medal size={16} /> },
                ].map(s => (
                  <div key={s.label} style={{ ...card, textAlign: 'center', padding: '0.85rem' }}>
                    <div style={{ color: s.color, marginBottom: '0.3rem' }}>{s.icon}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: theme.textSecondary, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <Calendar size={14} />
                {fmtMonth(challenge.month || currentMonth)} · {new Date(challenge.startDate).toLocaleDateString('pt-BR')} — {new Date(challenge.endDate).toLocaleDateString('pt-BR')}
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>{challenge.totalParticipants} participantes</span>
              </div>

              {/* Admin: update returns button */}
              {isAdmin && (
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <button onClick={triggerUpdate} disabled={updating} style={{
                    padding: '0.4rem 1rem', borderRadius: 8, border: `1px solid ${theme.border}`,
                    background: 'transparent', color: theme.textSecondary, cursor: 'pointer', fontSize: '0.75rem',
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem', opacity: updating ? 0.5 : 1,
                  }}>
                    <RefreshCw size={13} style={updating ? { animation: 'spin 1s linear infinite' } : {}} />
                    {updating ? 'Atualizando retornos...' : 'Atualizar retornos (admin)'}
                  </button>
                </div>
              )}

              {/* Tickers in challenge */}
              {challenge.tickers && challenge.tickers.length > 0 && (
                <div style={{ ...card, marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem' }}>Ações no desafio</div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {challenge.tickers.map(t => (
                      <span key={t} style={{ padding: '0.25rem 0.5rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, background: darkMode ? '#0f1117' : '#f1f2f6', border: `1px solid ${theme.border}`, color: theme.text }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quit button */}
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <button onClick={quitChallenge} disabled={quitting} style={{
                  padding: '0.45rem 1rem', borderRadius: 8, border: `1px solid ${darkMode ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)'}`,
                  background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.78rem',
                  opacity: quitting ? 0.5 : 0.7, transition: 'opacity 0.15s',
                }}>
                  {quitting ? 'Saindo...' : 'Sair do desafio'}
                </button>
              </div>
              {challenge.history.length > 0 && (
                <div style={{ ...card, marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem' }}>Evolução diária</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: 250, overflowY: 'auto' }}>
                    {challenge.history.map((h, i) => {
                      const diff = h.userReturn - h.ibovReturn;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', borderRadius: 6, background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', fontSize: '0.78rem' }}>
                          <span style={{ color: theme.textSecondary, minWidth: 70 }}>{new Date(h.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                          <span style={{ color: pctColor(h.userReturn), fontWeight: 600, minWidth: 65 }}>Você: {fmtPct(h.userReturn)}</span>
                          <span style={{ color: theme.textSecondary, minWidth: 65 }}>IBOV: {fmtPct(h.ibovReturn)}</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 600, fontSize: '0.72rem', color: pctColor(diff), display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            {diff >= 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}{fmtPct(diff)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Leaderboard tab ── */}
      {tab === 'leaderboard' && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <BarChart3 size={16} /> Ranking {selectedMonth ? fmtMonth(selectedMonth) : 'atual'}
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {/* Avatar picker */}
              <button onClick={() => setShowAvatarPicker(!showAvatarPicker)} style={{
                padding: '0.3rem 0.6rem', borderRadius: 6, border: `1px solid ${theme.border}`,
                background: 'transparent', cursor: 'pointer', fontSize: '0.9rem',
              }} title="Mudar avatar">
                {user?.avatar || '🐂'}
              </button>
              {pastMonths.length > 0 && (
                <select value={selectedMonth || currentMonth} onChange={e => setSelectedMonth(e.target.value)} style={{
                  padding: '0.35rem 0.6rem', borderRadius: 6, border: `1px solid ${theme.border}`,
                  background: darkMode ? '#0f1117' : '#f8f9fb', color: theme.text, fontSize: '0.78rem',
                }}>
                  <option value={currentMonth}>Mês atual</option>
                  {pastMonths.filter(m => m !== currentMonth).map(m => (
                    <option key={m} value={m}>{fmtMonth(m)}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Avatar picker dropdown */}
          {showAvatarPicker && (
            <div style={{
              marginBottom: '1rem', padding: '0.75rem', borderRadius: 10,
              background: darkMode ? '#0f1117' : '#f8f9fb', border: `1px solid ${theme.border}`,
            }}>
              <div style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>Escolha seu avatar para o ranking:</div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {AVATARS.map(a => (
                  <button key={a} onClick={() => setAvatar(a)} style={{
                    width: 36, height: 36, borderRadius: 8, border: user?.avatar === a ? '2px solid #3b82f6' : `1px solid ${theme.border}`,
                    background: user?.avatar === a ? brand.alpha(0.12) : 'transparent',
                    cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{a}</button>
                ))}
              </div>
            </div>
          )}

          {leaderboard.length === 0 ? (
            <p style={{ color: theme.textSecondary, fontSize: '0.88rem', textAlign: 'center', padding: '2rem 0' }}>
              Nenhum participante {selectedMonth && selectedMonth !== currentMonth ? 'nesse mês' : 'ainda'}.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {leaderboard.map(entry => {
                const mc = entry.rank === 1 ? '#f59e0b' : entry.rank === 2 ? '#94a3b8' : entry.rank === 3 ? '#cd7f32' : undefined;
                const topBorder = entry.rank <= 3 ? `1px solid ${mc}40` : `1px solid ${theme.border}`;
                return (
                  <div key={entry.rank} style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 0.75rem', borderRadius: 10,
                    background: entry.isCurrentUser ? (darkMode ? brand.alpha(0.1) : brand.alpha(0.05)) : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                    border: entry.isCurrentUser ? `1px solid ${brand.alpha(0.25)}` : topBorder,
                  }}>
                    {/* Rank badge */}
                    <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, background: mc ? `${mc}20` : (darkMode ? '#2a2e3a' : '#e0e2e8'), color: mc || theme.textSecondary }}>
                      {entry.rank <= 3 ? <Medal size={14} /> : entry.rank}
                    </div>
                    {/* Avatar */}
                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{entry.avatar || '🐂'}</span>
                    {/* Name + carteira */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: entry.isCurrentUser ? 600 : 400, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.name} {entry.isCurrentUser && '(você)'}
                      </div>
                      {entry.carteiraName && (
                        <div style={{ fontSize: '0.68rem', color: theme.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          📁 {entry.carteiraName} · {entry.tickerCount || 0} ações
                        </div>
                      )}
                    </div>
                    {/* Return */}
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: pctColor(entry.return), flexShrink: 0 }}>{fmtPct(entry.return)}</span>
                    {/* Top 3 crown */}
                    {entry.rank <= 3 && <span style={{ fontSize: '0.9rem' }}>{entry.rank === 1 ? '👑' : entry.rank === 2 ? '🥈' : '🥉'}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Badges tab ── */}
      {tab === 'badges' && (
        <div style={card}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={16} /> Conquistas
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
            {badges.map(b => (
              <div key={b.id} style={{
                padding: '1rem', borderRadius: 10, textAlign: 'center',
                background: b.earned ? (darkMode ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)') : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                border: `1px solid ${b.earned ? 'rgba(245,158,11,0.25)' : theme.border}`, opacity: b.earned ? 1 : 0.5,
              }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', margin: '0 auto 0.5rem', background: b.earned ? 'rgba(245,158,11,0.15)' : (darkMode ? '#2a2e3a' : '#e0e2e8'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: b.earned ? '#f59e0b' : theme.textSecondary }}>
                  {BADGE_ICONS[b.id] || <Star size={20} />}
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, marginBottom: '0.2rem' }}>{b.name}</div>
                <div style={{ fontSize: '0.7rem', color: theme.textSecondary, lineHeight: 1.4 }}>{b.description}</div>
                {b.earned && b.earnedAt && <div style={{ fontSize: '0.65rem', color: '#f59e0b', marginTop: '0.3rem' }}>✓ {new Date(b.earnedAt).toLocaleDateString('pt-BR')}</div>}
              </div>
            ))}
            {badges.length === 0 && (
              <p style={{ color: theme.textSecondary, fontSize: '0.88rem', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem 0' }}>
                Entre no desafio para desbloquear conquistas.
              </p>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ChallengesPage;
