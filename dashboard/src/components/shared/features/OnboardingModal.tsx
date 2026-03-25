import { brand } from '../../../styles/theme';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp, Brain, TestTubes, ArrowRight, X, Search, Check, Star,
  Play, BarChart3, Shield, Zap, Sparkles, Target,
  DollarSign, Clock, LineChart,
} from 'lucide-react';
import { UNIVERSE_SIZE_FALLBACK, getSignal, getSignalColor } from '../../../constants';
import { useAuth } from '../../../contexts/AuthContext';
import { API_BASE_URL, API_KEY } from '../../../config';

/* ── Types ── */
interface OnboardingModalProps {
  darkMode: boolean;
  onClose: () => void;
}

interface Rec {
  ticker: string;
  score: number;
  last_close: number;
  pred_price_t_plus_20: number;
  exp_return_20: number;
}

type InvestorProfile = 'conservador' | 'moderado' | 'arrojado' | null;

const ONBOARDING_DONE_KEY = 'b3tr_onboarding_done';

export const shouldShowOnboarding = (user: { onboardingDone?: boolean; id?: string } | null): boolean => {
  if (!user) return false;
  // If backend says done, respect it
  if (user.onboardingDone) return false;
  // Fallback: check localStorage in case the backend call failed previously
  const localKey = `${ONBOARDING_DONE_KEY}_${user.id || 'default'}`;
  if (localStorage.getItem(localKey) === 'true') return false;
  return true;
};

export const markOnboardingDoneLocally = (userId?: string): void => {
  const localKey = `${ONBOARDING_DONE_KEY}_${userId || 'default'}`;
  localStorage.setItem(localKey, 'true');
};

/* ── Step IDs ── */
const STEP_WELCOME = 0;
const STEP_SIMULATION = 1;
const STEP_VIDEO = 2;
const STEP_WIZARD = 3;
const STEP_TICKER = 4; // free users only

/* ── Investor profiles ── */
const profiles: { id: InvestorProfile; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
  { id: 'conservador', label: 'Conservador', icon: <Shield size={24} />, desc: 'Prefiro segurança e menor volatilidade', color: '#10b981' },
  { id: 'moderado', label: 'Moderado', icon: <Target size={24} />, desc: 'Equilíbrio entre risco e retorno', color: '#3b82f6' },
  { id: 'arrojado', label: 'Arrojado', icon: <Zap size={24} />, desc: 'Busco maiores retornos, aceito mais risco', color: '#f59e0b' },
];


/* ══════════════════════════════════════════════════════════════════════
   SimulationCard — animated mini-card for the recommendation preview
   ══════════════════════════════════════════════════════════════════════ */
const SimulationCard: React.FC<{ rec: Rec; darkMode: boolean; delay: number }> = ({ rec, darkMode, delay }) => {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t); }, [delay]);

  const signal = getSignal(rec.score);
  const sc = getSignalColor(signal);
  const retPct = (rec.exp_return_20 * 100).toFixed(1);

  return (
    <div style={{
      opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(12px)',
      transition: 'all 0.4s ease', padding: '0.6rem 0.75rem', borderRadius: 10,
      background: darkMode ? '#0f1117' : '#f8f9fb',
      border: `1px solid ${darkMode ? '#2a2e3a' : '#e2e8f0'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{
          fontWeight: 700, fontSize: '0.82rem',
          color: darkMode ? '#f1f5f9' : '#0f1117',
        }}>{rec.ticker}</span>
        <span style={{
          fontSize: '0.68rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4,
          background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
        }}>{signal}</span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '0.72rem', color: darkMode ? '#9ba1b0' : '#64748b' }}>
          Retorno esperado
        </div>
        <div style={{
          fontSize: '0.82rem', fontWeight: 700,
          color: rec.exp_return_20 >= 0 ? '#10b981' : '#ef4444',
        }}>
          {rec.exp_return_20 >= 0 ? '+' : ''}{retPct}%
        </div>
      </div>
    </div>
  );
};


/* ══════════════════════════════════════════════════════════════════════
   Main OnboardingModal component
   ══════════════════════════════════════════════════════════════════════ */
const OnboardingModal: React.FC<OnboardingModalProps> = ({ darkMode, onClose }) => {
  const { user, setFreeTicker, completeOnboarding } = useAuth();
  const isPro = user?.plan === 'pro';
  const totalSteps = isPro ? 4 : 5; // skip ticker step for pro

  const [step, setStep] = useState(STEP_WELCOME);
  const [visible, setVisible] = useState(false);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [selectedTicker, setSelectedTicker] = useState('');
  const [tickerSearch, setTickerSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [investorProfile, setInvestorProfile] = useState<InvestorProfile>(null);
  const videoRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // Fetch recommendations for simulation + ticker selection
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, {
          headers: { 'x-api-key': API_KEY },
        });
        if (res.ok) {
          const data = await res.json();
          const all = (data.recommendations || [])
            .map((r: any) => ({ ticker: r.ticker, score: r.score, last_close: r.last_close, pred_price_t_plus_20: r.pred_price_t_plus_20, exp_return_20: r.exp_return_20 }))
            .sort((a: Rec, b: Rec) => b.score - a.score);
          setRecs(all);
        }
      } catch { /* silent */ }
    })();
  }, []);

  const handleClose = () => {
    setVisible(false);
    markOnboardingDoneLocally(user?.id);
    completeOnboarding(investorProfile || undefined).catch(() => {});
    setTimeout(onClose, 250);
  };

  const handleFinish = useCallback(async () => {
    if (!isPro && selectedTicker) {
      setSaving(true);
      try { await setFreeTicker(selectedTicker); } catch { /* silent */ }
      setSaving(false);
    }
    markOnboardingDoneLocally(user?.id);
    try { await completeOnboarding(investorProfile || undefined); } catch { /* silent */ }
    setVisible(false);
    setTimeout(onClose, 250);
  }, [isPro, selectedTicker, setFreeTicker, onClose, investorProfile, completeOnboarding, user?.id]);

  const handleNext = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else handleFinish();
  };
  const handleBack = () => { if (step > 0) setStep(step - 1); };

  const isLast = step === totalSteps - 1;
  const isTickerStep = !isPro && step === STEP_TICKER;
  const canAdvance = (() => {
    if (step === STEP_WIZARD && !investorProfile) return false;
    if (isTickerStep && !selectedTicker) return false;
    return true;
  })();

  const filteredTickers = recs.filter(t =>
    !tickerSearch || t.ticker.toLowerCase().includes(tickerSearch.toLowerCase())
  );

  // Top 5 for simulation preview
  const topRecs = recs.slice(0, 5);
  const buyCount = recs.filter(r => getSignal(r.score) === 'Compra').length;
  const sellCount = recs.filter(r => getSignal(r.score) === 'Venda').length;
  const neutralCount = recs.length - buyCount - sellCount;

  const bg = darkMode ? '#1a1d27' : '#fff';
  const border = darkMode ? '#2a2e3a' : '#e2e8f0';
  const textPrimary = darkMode ? '#f1f5f9' : '#0f1117';
  const textSecondary = darkMode ? '#9ba1b0' : '#64748b';
  const textMuted = darkMode ? '#64748b' : '#6b7280';


  /* ── Step renderers ── */

  const renderWelcome = () => (
    <div style={{ padding: '2rem 1.75rem 1rem', textAlign: 'center' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, margin: '0 auto 1rem',
        background: brand.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 8px 24px ${brand.alpha(0.3)}`,
      }}>
        <Sparkles size={28} color="#fff" />
      </div>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: textPrimary, marginBottom: '0.5rem' }}>
        Bem-vindo ao Qyntara
      </h2>
      <p style={{ fontSize: '0.88rem', color: textSecondary, lineHeight: 1.7, marginBottom: '1rem', maxWidth: 360, margin: '0 auto 1rem' }}>
        Nosso modelo de Deep Learning analisa <strong style={{ color: textPrimary }}>{recs.length || UNIVERSE_SIZE_FALLBACK} ações</strong> da B3 diariamente
        e gera sinais inteligentes de Compra, Venda ou Neutro.
      </p>
      <div style={{
        display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '0.5rem',
      }}>
        {[
          { icon: <BarChart3 size={16} />, label: 'Recomendações diárias' },
          { icon: <Brain size={16} />, label: 'IA explicável' },
          { icon: <TestTubes size={16} />, label: 'Backtesting real' },
        ].map((f, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            fontSize: '0.75rem', color: textSecondary,
            padding: '0.35rem 0.6rem', borderRadius: 8,
            background: darkMode ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.04)',
            border: `1px solid ${darkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)'}`,
          }}>
            <span style={{ color: '#3b82f6' }}>{f.icon}</span> {f.label}
          </div>
        ))}
      </div>
    </div>
  );

  const renderSimulation = () => (
    <div style={{ padding: '1.5rem 1.75rem 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <TrendingUp size={28} color="#3b82f6" style={{ marginBottom: '0.4rem' }} />
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: textPrimary, marginBottom: '0.3rem' }}>
          Veja as recomendações de hoje
        </h2>
        <p style={{ fontSize: '0.8rem', color: textSecondary, margin: 0 }}>
          Prévia em tempo real do nosso modelo
        </p>
      </div>

      {/* Signal summary */}
      <div style={{
        display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', justifyContent: 'center',
      }}>
        {[
          { label: 'Compra', count: buyCount, color: '#10b981' },
          { label: 'Neutro', count: neutralCount, color: '#94a3b8' },
          { label: 'Venda', count: sellCount, color: '#ef4444' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '0.4rem 0.75rem', borderRadius: 8, textAlign: 'center',
            background: darkMode ? '#0f1117' : '#f8f9fb',
            border: `1px solid ${border}`, flex: 1,
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: '0.68rem', color: textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Top picks animated */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {topRecs.length > 0 ? topRecs.map((r, i) => (
          <SimulationCard key={r.ticker} rec={r} darkMode={darkMode} delay={200 + i * 150} />
        )) : (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: textMuted, fontSize: '0.82rem' }}>
            <Clock size={20} style={{ marginBottom: '0.3rem', opacity: 0.5 }} />
            <div>Carregando recomendações...</div>
          </div>
        )}
      </div>

      {recs.length > 5 && (
        <div style={{
          textAlign: 'center', marginTop: '0.5rem', fontSize: '0.72rem', color: textMuted,
        }}>
          + {recs.length - 5} ações disponíveis no dashboard
        </div>
      )}
    </div>
  );


  const renderVideo = () => (
    <div style={{ padding: '1.5rem 1.75rem 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <Play size={28} color="#3b82f6" style={{ marginBottom: '0.4rem' }} />
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: textPrimary, marginBottom: '0.3rem' }}>
          Como funciona em 90 segundos
        </h2>
        <p style={{ fontSize: '0.8rem', color: textSecondary, margin: 0 }}>
          Entenda o poder do Qyntara rapidamente
        </p>
      </div>

      {/* Video embed placeholder — replace src with actual video URL */}
      <div style={{
        position: 'relative', width: '100%', paddingBottom: '56.25%', borderRadius: 12,
        overflow: 'hidden', background: darkMode ? '#0f1117' : '#f0f0f0',
        border: `1px solid ${border}`,
      }}>
        <iframe
          ref={videoRef}
          src="https://www.youtube.com/embed/VIDEO_ID?rel=0&modestbranding=1"
          title="Como funciona o Qyntara"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none',
          }}
        />
      </div>

      <div style={{
        marginTop: '0.75rem', display: 'flex', gap: '0.5rem', justifyContent: 'center',
      }}>
        {[
          { icon: <LineChart size={14} />, text: 'Análise diária' },
          { icon: <Brain size={14} />, text: 'IA explicável' },
          { icon: <DollarSign size={14} />, text: 'Backtesting' },
        ].map((item, i) => (
          <span key={i} style={{
            display: 'flex', alignItems: 'center', gap: '0.25rem',
            fontSize: '0.72rem', color: textMuted,
          }}>
            <span style={{ color: '#3b82f6' }}>{item.icon}</span> {item.text}
          </span>
        ))}
      </div>

      <div style={{
        marginTop: '0.5rem', textAlign: 'center', fontSize: '0.72rem', color: textMuted,
      }}>
        Pode pular se preferir — você pode assistir depois na aba Ajuda.
      </div>
    </div>
  );

  const renderWizard = () => (
    <div style={{ padding: '1.5rem 1.75rem 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <Target size={28} color="#3b82f6" style={{ marginBottom: '0.4rem' }} />
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: textPrimary, marginBottom: '0.3rem' }}>
          Qual é o seu perfil?
        </h2>
        <p style={{ fontSize: '0.8rem', color: textSecondary, margin: 0 }}>
          Personalizamos as recomendações para você
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {profiles.map(p => {
          const selected = investorProfile === p.id;
          return (
            <button key={p.id} onClick={() => setInvestorProfile(p.id)} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.85rem 1rem', borderRadius: 12, cursor: 'pointer',
              border: selected ? `2px solid ${p.color}` : `1px solid ${border}`,
              background: selected
                ? (darkMode ? `${p.color}15` : `${p.color}08`)
                : 'transparent',
              transition: 'all 0.2s', textAlign: 'left',
              WebkitAppearance: 'none' as any,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: selected ? `${p.color}20` : (darkMode ? '#0f1117' : '#f8f9fb'),
                color: selected ? p.color : textMuted,
                transition: 'all 0.2s',
              }}>
                {p.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '0.88rem', fontWeight: 700,
                  color: selected ? p.color : textPrimary,
                  marginBottom: '0.15rem',
                }}>{p.label}</div>
                <div style={{ fontSize: '0.75rem', color: textSecondary }}>{p.desc}</div>
              </div>
              {selected && (
                <Check size={18} color={p.color} style={{ flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>

      <div style={{
        marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.72rem',
        background: darkMode ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.03)',
        border: `1px solid ${darkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)'}`,
        color: textMuted,
      }}>
        💡 Você pode alterar seu perfil a qualquer momento nas Configurações.
      </div>
    </div>
  );


  const renderTickerSelection = () => (
    <div style={{ padding: '1.5rem 1.75rem 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <Star size={28} color="#f59e0b" style={{ marginBottom: '0.4rem' }} />
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: textPrimary, marginBottom: '0.3rem' }}>
          Escolha sua ação gratuita
        </h2>
        <p style={{ fontSize: '0.8rem', color: textSecondary, margin: 0, lineHeight: 1.5 }}>
          No plano Free, você tem acesso completo a <strong style={{ color: textPrimary }}>1 ação</strong> de sua escolha.
        </p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: textMuted }} />
        <input
          type="text" placeholder="Buscar ticker..." value={tickerSearch}
          onChange={e => setTickerSearch(e.target.value)}
          style={{
            width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem', borderRadius: 8,
            border: `1px solid ${border}`, background: darkMode ? '#0f1117' : '#f8f9fb',
            color: textPrimary, fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Ticker grid */}
      <div style={{
        maxHeight: 200, overflowY: 'auto', display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', padding: '0.25rem 0',
      }}>
        {filteredTickers.map(t => (
          <button key={t.ticker} onClick={() => setSelectedTicker(t.ticker)} style={{
            padding: '0.5rem 0.4rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
            border: selectedTicker === t.ticker
              ? '2px solid #3b82f6'
              : `1px solid ${border}`,
            background: selectedTicker === t.ticker
              ? (darkMode ? brand.alpha(0.15) : brand.alpha(0.08))
              : 'transparent',
            color: selectedTicker === t.ticker ? '#3b82f6' : textPrimary,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
            transition: 'all 0.15s', WebkitAppearance: 'none' as any,
          }}>
            {selectedTicker === t.ticker && <Check size={12} />}
            {t.ticker}
          </button>
        ))}
        {filteredTickers.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1rem', color: textMuted, fontSize: '0.8rem' }}>
            Nenhum ticker encontrado
          </div>
        )}
      </div>

      <div style={{
        marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.72rem',
        background: darkMode ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)',
        border: `1px solid ${darkMode ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.1)'}`,
        color: textMuted,
      }}>
        👑 Com o Pro, você desbloqueia todas as {recs.length || UNIVERSE_SIZE_FALLBACK} ações, carteira modelo e muito mais.
      </div>
    </div>
  );


  /* ── Step labels for progress ── */
  const stepLabels = isPro
    ? ['Início', 'Simulação', 'Vídeo', 'Perfil']
    : ['Início', 'Simulação', 'Vídeo', 'Perfil', 'Ação'];

  const renderStep = () => {
    switch (step) {
      case STEP_WELCOME: return renderWelcome();
      case STEP_SIMULATION: return renderSimulation();
      case STEP_VIDEO: return renderVideo();
      case STEP_WIZARD: return renderWizard();
      case STEP_TICKER: return renderTickerSelection();
      default: return null;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={handleClose} style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
        opacity: visible ? 1 : 0, transition: 'opacity 0.25s ease',
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: visible ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.93)',
        opacity: visible ? 1 : 0, transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
        zIndex: 9999, width: 'min(480px, 92vw)',
        background: bg, border: `1px solid ${border}`,
        borderRadius: 20, overflow: 'hidden',
        boxShadow: `0 24px 80px rgba(0,0,0,0.35), 0 0 0 1px ${brand.alpha(0.05)}`,
      }}>
        {/* Close */}
        <button onClick={handleClose} aria-label="Fechar" style={{
          position: 'absolute', top: 14, right: 14, background: darkMode ? '#ffffff10' : '#00000008',
          border: 'none', color: textMuted, cursor: 'pointer', padding: 6, borderRadius: 8,
          zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}>
          <X size={16} />
        </button>

        {/* Progress with labels */}
        <div style={{ padding: '14px 20px 0', display: 'flex', gap: 4 }}>
          {stepLabels.map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 3, borderRadius: 2, marginBottom: 4,
                background: i <= step ? brand.gradient : (darkMode ? '#2a2e3a' : '#e2e8f0'),
                transition: 'background 0.3s',
              }} />
              <span style={{
                fontSize: '0.6rem', fontWeight: i === step ? 700 : 500,
                color: i <= step ? '#3b82f6' : textMuted,
                transition: 'color 0.3s',
              }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        {renderStep()}

        {/* Footer */}
        <div style={{
          padding: '0.75rem 1.75rem 1.25rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.72rem', color: textMuted }}>
            {step + 1} de {totalSteps}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {step > 0 && (
              <button onClick={handleBack} style={{
                padding: '0.5rem 1rem', borderRadius: 10, fontSize: '0.82rem',
                border: `1px solid ${border}`, background: 'transparent',
                color: textSecondary, cursor: 'pointer', WebkitAppearance: 'none' as any,
              }}>Voltar</button>
            )}
            <button
              onClick={handleNext}
              disabled={!canAdvance}
              style={{
                padding: '0.55rem 1.25rem', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600,
                border: 'none', cursor: canAdvance ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                background: isLast
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : brand.gradient,
                color: 'white',
                boxShadow: isLast
                  ? '0 4px 12px rgba(245,158,11,0.3)'
                  : `0 4px 12px ${brand.alpha(0.3)}`,
                opacity: canAdvance ? 1 : 0.5,
                transition: 'all 0.2s',
                WebkitAppearance: 'none' as any,
              }}>
              {saving ? 'Salvando...' : isLast ? '🚀 Começar' : 'Próximo'}
              {!saving && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingModal;
