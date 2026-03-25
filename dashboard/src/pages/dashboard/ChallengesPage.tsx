import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Trophy, TrendingUp, Target, Flame, Medal,
  ChevronUp, ChevronDown, Loader2, Calendar, BarChart3,
  Award, Star, Zap, Crown,
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { brand } from '../../styles/theme';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

interface ChallengeData {
  active: boolean;
  startDate: string;
  endDate: string;
  userReturn: number;
  ibovReturn: number;
  isBeating: boolean;
  streak: number;
  bestStreak: number;
  rank: number;
  totalParticipants: number;
  portfolio: { ticker: string; weight: number; return: number }[];
  history: { date: string; userReturn: number; ibovReturn: number }[];
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  return: number;
  isCurrentUser: boolean;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: string;
}

const BADGE_ICONS: Record<string, React.ReactNode> = {
  first_challenge: <Target size={20} />,
  beat_ibov_week: <TrendingUp size={20} />,
  beat_ibov_month: <Trophy size={20} />,
  streak_3: <Flame size={20} />,
  streak_7: <Zap size={20} />,
  top_10: <Medal size={20} />,
  top_3: <Crown size={20} />,
  consistent: <Star size={20} />,
};

const ChallengesPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [tab, setTab] = useState<'challenge' | 'leaderboard' | 'badges'>('challenge');

  const token = localStorage.getItem('authToken');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [cRes, lRes, bRes] = await Promise.all([
        fetch(`${API_BASE_URL}/auth/stats?type=challenge`, { headers }),
        fetch(`${API_BASE_URL}/auth/stats?type=leaderboard`, { headers }),
        fetch(`${API_BASE_URL}/auth/stats?type=achievements`, { headers }),
      ]);
      if (cRes.ok) setChallenge(await cRes.json());
      if (lRes.ok) setLeaderboard(await lRes.json());
      if (bRes.ok) setBadges(await bRes.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const joinChallenge = async () => {
    setJoining(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/free-ticker`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join-challenge' }),
      });
      if (res.ok) await fetchData();
    } catch { /* silent */ }
    finally { setJoining(false); }
  };

  const card: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1d27' : '#fff'),
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: 'clamp(1rem, 3vw, 1.5rem)',
  };

  const pctColor = (v: number) => v >= 0 ? '#10b981' : '#ef4444';
  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0', color: theme.textSecondary }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const tabBtn = (id: typeof tab, label: string, icon: React.ReactNode) => (
    <button key={id} onClick={() => setTab(id)} style={{
      padding: '0.5rem 1rem', borderRadius: 8, border: `1px solid ${tab === id ? brand.accent : theme.border}`,
      background: tab === id ? brand.alpha(0.12) : 'transparent',
      color: tab === id ? brand.accent : theme.textSecondary,
      cursor: 'pointer', fontSize: '0.82rem', fontWeight: tab === id ? 600 : 400,
      display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.15s',
    }}>
      {icon} {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{
        ...card,
        background: darkMode
          ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(239,68,68,0.08))'
          : 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(239,68,68,0.03))',
        textAlign: 'center', padding: 'clamp(1.5rem, 4vw, 2.5rem)',
        marginBottom: '1.25rem',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 1rem',
          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Trophy size={28} color="white" />
        </div>
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.6rem)', fontWeight: 700, color: theme.text, margin: '0 0 0.5rem' }}>
          🏆 Desafio: Bata o IBOVESPA
        </h1>
        <p style={{ color: theme.textSecondary, fontSize: '0.88rem', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
          Monte sua carteira com as recomendações da Qyntara e veja se você consegue superar o índice.
          Ganhe badges, suba no ranking e prove suas habilidades.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {tabBtn('challenge', 'Desafio', <Target size={15} />)}
        {tabBtn('leaderboard', 'Ranking', <BarChart3 size={15} />)}
        {tabBtn('badges', 'Conquistas', <Award size={15} />)}
      </div>

      {/* Challenge tab */}
      {tab === 'challenge' && (
        <>
          {!challenge?.active ? (
            <div style={{ ...card, textAlign: 'center' }}>
              <Trophy size={48} color="#f59e0b" style={{ marginBottom: '1rem', opacity: 0.6 }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: theme.text, marginBottom: '0.5rem' }}>
                Participe do desafio mensal
              </h2>
              <p style={{ color: theme.textSecondary, fontSize: '0.88rem', marginBottom: '1.25rem', maxWidth: 400, margin: '0 auto 1.25rem' }}>
                Suas recomendações seguidas serão comparadas com o IBOVESPA ao longo do mês.
                Sem risco real — apenas diversão e aprendizado.
              </p>
              <button onClick={joinChallenge} disabled={joining} style={{
                padding: '0.75rem 2rem', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: 'white',
                fontWeight: 600, fontSize: '0.9rem', opacity: joining ? 0.7 : 1,
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              }}>
                {joining ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Flame size={16} />}
                {joining ? 'Entrando...' : 'Entrar no desafio'}
              </button>
            </div>
          ) : (
            <>
              {/* Score comparison */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{
                  ...card, textAlign: 'center',
                  border: `1px solid ${challenge.isBeating ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  background: challenge.isBeating
                    ? (darkMode ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)')
                    : (darkMode ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.03)'),
                }}>
                  <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.3rem' }}>Sua carteira</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: pctColor(challenge.userReturn) }}>
                    {fmtPct(challenge.userReturn)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.2rem' }}>
                    {challenge.isBeating ? '🔥 Batendo o IBOV' : 'Abaixo do IBOV'}
                  </div>
                </div>
                <div style={{ ...card, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.3rem' }}>IBOVESPA</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: pctColor(challenge.ibovReturn) }}>
                    {fmtPct(challenge.ibovReturn)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.2rem' }}>Benchmark</div>
                </div>
              </div>

              {/* Stats row */}
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

              {/* Period info */}
              <div style={{
                ...card, display: 'flex', alignItems: 'center', gap: '0.5rem',
                fontSize: '0.8rem', color: theme.textSecondary, marginBottom: '1.25rem',
              }}>
                <Calendar size={14} />
                Período: {new Date(challenge.startDate).toLocaleDateString('pt-BR')} — {new Date(challenge.endDate).toLocaleDateString('pt-BR')}
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>
                  {challenge.totalParticipants} participantes
                </span>
              </div>

              {/* Mini performance chart (text-based) */}
              {challenge.history.length > 0 && (
                <div style={{ ...card, marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: theme.text, marginBottom: '0.75rem' }}>
                    Evolução diária
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: 250, overflowY: 'auto' }}>
                    {challenge.history.map((h, i) => {
                      const diff = h.userReturn - h.ibovReturn;
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.4rem 0.6rem', borderRadius: 6,
                          background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                          fontSize: '0.78rem',
                        }}>
                          <span style={{ color: theme.textSecondary, minWidth: 70 }}>
                            {new Date(h.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                          <span style={{ color: pctColor(h.userReturn), fontWeight: 600, minWidth: 65 }}>
                            Você: {fmtPct(h.userReturn)}
                          </span>
                          <span style={{ color: theme.textSecondary, minWidth: 65 }}>
                            IBOV: {fmtPct(h.ibovReturn)}
                          </span>
                          <span style={{
                            marginLeft: 'auto', fontWeight: 600, fontSize: '0.72rem',
                            color: pctColor(diff), display: 'flex', alignItems: 'center', gap: '0.2rem',
                          }}>
                            {diff >= 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {fmtPct(diff)}
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

      {/* Leaderboard tab */}
      {tab === 'leaderboard' && (
        <div style={card}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={16} /> Ranking mensal
          </h2>
          {leaderboard.length === 0 ? (
            <p style={{ color: theme.textSecondary, fontSize: '0.88rem', textAlign: 'center', padding: '2rem 0' }}>
              Nenhum participante ainda. Seja o primeiro a entrar no desafio.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {leaderboard.map((entry) => {
                const medalColor = entry.rank === 1 ? '#f59e0b' : entry.rank === 2 ? '#94a3b8' : entry.rank === 3 ? '#cd7f32' : undefined;
                return (
                  <div key={entry.rank} style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.6rem 0.75rem', borderRadius: 8,
                    background: entry.isCurrentUser
                      ? (darkMode ? brand.alpha(0.1) : brand.alpha(0.05))
                      : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                    border: entry.isCurrentUser ? `1px solid ${brand.alpha(0.25)}` : `1px solid ${theme.border}`,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700,
                      background: medalColor ? `${medalColor}20` : (darkMode ? '#2a2e3a' : '#e0e2e8'),
                      color: medalColor || theme.textSecondary,
                    }}>
                      {entry.rank <= 3 ? <Medal size={14} /> : entry.rank}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: entry.isCurrentUser ? 600 : 400, color: theme.text }}>
                        {entry.name} {entry.isCurrentUser && '(você)'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: pctColor(entry.return) }}>
                      {fmtPct(entry.return)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Badges tab */}
      {tab === 'badges' && (
        <div style={card}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: theme.text, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={16} /> Conquistas
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
            {badges.map(b => (
              <div key={b.id} style={{
                padding: '1rem', borderRadius: 10, textAlign: 'center',
                background: b.earned
                  ? (darkMode ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)')
                  : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                border: `1px solid ${b.earned ? 'rgba(245,158,11,0.25)' : theme.border}`,
                opacity: b.earned ? 1 : 0.5,
                transition: 'all 0.2s',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', margin: '0 auto 0.5rem',
                  background: b.earned ? 'rgba(245,158,11,0.15)' : (darkMode ? '#2a2e3a' : '#e0e2e8'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: b.earned ? '#f59e0b' : theme.textSecondary,
                }}>
                  {BADGE_ICONS[b.id] || <Star size={20} />}
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, marginBottom: '0.2rem' }}>
                  {b.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: theme.textSecondary, lineHeight: 1.4 }}>
                  {b.description}
                </div>
                {b.earned && b.earnedAt && (
                  <div style={{ fontSize: '0.65rem', color: '#f59e0b', marginTop: '0.3rem' }}>
                    ✓ {new Date(b.earnedAt).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            ))}
            {badges.length === 0 && (
              <p style={{ color: theme.textSecondary, fontSize: '0.88rem', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem 0' }}>
                Entre no desafio para começar a desbloquear conquistas.
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
