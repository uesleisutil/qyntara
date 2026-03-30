import React from 'react';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import { Blurred } from '../components/Blurred';
import { theme } from '../styles';
import { Target, TrendingUp, TrendingDown, CheckCircle2, XCircle, Lock } from 'lucide-react';

interface TrackRecord {
  total_signals: number; resolved: number; correct: number;
  accuracy: number;
  by_direction: Record<string, { total: number; correct: number; accuracy: number }>;
  recent: { question: string; direction: string; predicted_price: number; actual_outcome: string; correct: boolean; resolved_at: string }[];
}
interface Props { dark?: boolean; onAuthRequired: () => void; }

export const TrackRecordPage: React.FC<Props> = ({ onAuthRequired }) => {
  const user = useAuthStore(s => s.user);
  const tier = user?.tier || 'free';
  const isPro = tier === 'pro' || tier === 'quant' || tier === 'enterprise';
  const { data, loading } = useApi<TrackRecord>(isPro ? '/signals/track-record' : '', 60000);

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <Lock size={24} color={theme.textMuted} style={{ marginBottom: 12 }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>Track Record</h3>
        <p style={{ color: theme.textMuted, marginBottom: '1.5rem', fontSize: '0.82rem' }}>Entre para acessar</p>
        <button onClick={onAuthRequired} style={{
          padding: '0.65rem 1.5rem', borderRadius: 8, border: 'none',
          background: theme.text, color: theme.bg, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
        }}>Entrar</button>
      </div>
    );
  }

  if (!isPro) {
    return (
      <div>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Track Record</h2>
          <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>Performance histórica dos sinais de IA</p>
        </div>
        <Blurred locked label="Track Record requer plano Pro" height={280}><div /></Blurred>
      </div>
    );
  }

  const acc = data?.accuracy ?? 0;
  const accPct = (acc * 100).toFixed(1);
  const accColor = acc > 0.6 ? theme.green : acc > 0.4 ? theme.yellow : theme.red;
  const recent = data?.recent || [];
  const byDir = data?.by_direction || {};

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Track Record</h2>
        <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>Performance histórica dos sinais de IA</p>
      </div>

      {loading && !data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 80, borderRadius: 12, border: `1px solid ${theme.border}`, background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`, backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite ${i * 0.1}s` }} />
          ))}
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
            {[
              { label: 'Acurácia', value: `${accPct}%`, color: accColor, big: true },
              { label: 'Total Sinais', value: `${data?.total_signals || 0}`, color: theme.text },
              { label: 'Resolvidos', value: `${data?.resolved || 0}`, color: theme.blue },
              { label: 'Corretos', value: `${data?.correct || 0}`, color: theme.green },
            ].map((s, i) => (
              <div key={s.label} style={{
                padding: '1rem', background: theme.card, borderRadius: 14,
                border: `1px solid ${theme.border}`, textAlign: 'center',
                animation: `fadeIn 0.3s ease ${i * 0.06}s both`,
              }}>
                <div style={{ fontSize: s.big ? '1.8rem' : '1.3rem', fontWeight: 800, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontSize: '0.68rem', color: theme.textMuted, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Accuracy ring */}
          <div style={{
            background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16,
            padding: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 24,
            animation: 'slideUp 0.4s ease 0.1s both',
          }}>
            <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
              <svg width="90" height="90" viewBox="0 0 90 90">
                <circle cx="45" cy="45" r="38" fill="none" stroke={theme.border} strokeWidth="6" />
                <circle cx="45" cy="45" r="38" fill="none" stroke={accColor} strokeWidth="6"
                  strokeDasharray={`${acc * 238.76} 238.76`} strokeLinecap="round"
                  transform="rotate(-90 45 45)" style={{ transition: 'stroke-dasharray 1s ease' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={20} color={accColor} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 8 }}>Performance Geral</div>
              <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
                A IA acertou {data?.correct || 0} de {data?.resolved || 0} sinais resolvidos.
                {acc > 0.6 ? ' Performance acima da média.' : acc > 0.4 ? ' Performance na média.' : ' Modelos em fase de aprendizado.'}
              </div>
            </div>
          </div>

          {/* By direction */}
          {Object.keys(byDir).length > 0 && (
            <div style={{
              background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16,
              padding: '1.5rem', marginBottom: '1rem',
              animation: 'slideUp 0.4s ease 0.15s both',
            }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Por Direção</div>
              <div style={{ display: 'flex', gap: 12 }}>
                {Object.entries(byDir).map(([dir, stats]) => {
                  const dirColor = dir === 'YES' ? theme.green : dir === 'NO' ? theme.red : theme.yellow;
                  return (
                    <div key={dir} style={{ flex: 1, padding: '0.85rem', borderRadius: 12, background: theme.bg, border: `1px solid ${theme.border}`, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: dirColor, marginBottom: 6 }}>{dir}</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: theme.text }}>{(stats.accuracy * 100).toFixed(0)}%</div>
                      <div style={{ fontSize: '0.6rem', color: theme.textMuted, marginTop: 2 }}>{stats.correct}/{stats.total}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent signals */}
          {recent.length > 0 && (
            <div style={{
              background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16,
              padding: '1.5rem', animation: 'slideUp 0.4s ease 0.2s both',
            }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Sinais Recentes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {recent.map((r, i) => {
                  const dirColor = r.direction === 'YES' ? theme.green : theme.red;
                  const DirIcon = r.direction === 'YES' ? TrendingUp : TrendingDown;
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.85rem',
                      borderRadius: 10, borderLeft: `3px solid ${r.correct ? theme.green : theme.red}`,
                      background: theme.bg, animation: `fadeIn 0.3s ease ${i * 0.04}s both`,
                    }}>
                      {r.correct ? <CheckCircle2 size={14} color={theme.green} /> : <XCircle size={14} color={theme.red} />}
                      <DirIcon size={13} color={dirColor} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.question}</div>
                        <div style={{ fontSize: '0.6rem', color: theme.textMuted, marginTop: 2 }}>
                          Previu {r.direction} · Resultado: {r.actual_outcome} · {new Date(r.resolved_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data?.total_signals === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: theme.textMuted }}>
              <Target size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
              <p style={{ fontSize: '0.85rem' }}>Nenhum sinal resolvido ainda. O track record será preenchido conforme os mercados fecham.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
