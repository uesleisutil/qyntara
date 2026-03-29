import React from 'react';
import { useApi } from '../../hooks/useApi';
import { theme } from '../../styles';
import { Brain, Target, Activity, AlertTriangle, CheckCircle2, Clock, Gauge } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

export const AdminModelsPage: React.FC<{ dark?: boolean }> = () => {
  const { data } = useApi<any>('/admin/models', 30000);

  if (!data) {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
          <Brain size={20} color={theme.accent} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Modelos</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{
              height: 140, borderRadius: 14, border: `1px solid ${theme.border}`,
              background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`,
              backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite ${i * 0.15}s`,
            }} />
          ))}
        </div>
      </div>
    );
  }

  const edge = data.edge_estimator || {};
  const anomaly = data.anomaly_detector || {};
  const sentiment = data.sentiment_scorer || {};
  const summary = data.summary || {};

  const calibration = (edge.calibration_data || []).reduce((acc: any[], d: any) => {
    const bucket = acc.find((b: any) => b.bucket === d.bucket);
    if (bucket) { bucket.total++; bucket.actual_sum += d.actual; }
    else { acc.push({ bucket: d.bucket, predicted: (d.bucket + 0.5) / 10, total: 1, actual_sum: d.actual }); }
    return acc;
  }, []).map((b: any) => ({
    range: `${b.bucket * 10}-${(b.bucket + 1) * 10}%`,
    predicted: Math.round(b.predicted * 100),
    actual: Math.round((b.actual_sum / b.total) * 100),
    count: b.total,
  }));

  const models = [
    {
      name: 'Edge Estimator', icon: <Target size={20} />, color: theme.accent,
      desc: 'Transformer — estima a probabilidade real vs preço de mercado',
      metrics: [
        { label: 'Brier Score', value: edge.brier_score != null ? edge.brier_score.toFixed(4) : '—', good: edge.brier_score != null && edge.brier_score < 0.25 },
        { label: 'Acurácia', value: edge.live_accuracy != null ? `${(edge.live_accuracy * 100).toFixed(1)}%` : '—', good: edge.live_accuracy != null && edge.live_accuracy > 0.55 },
        { label: 'Predições', value: edge.total_predictions || 0 },
        { label: 'Corretas', value: edge.correct_predictions || 0 },
      ],
      trained: edge.last_trained, version: edge.version,
    },
    {
      name: 'Anomaly Detector', icon: <AlertTriangle size={20} />, color: theme.yellow,
      desc: 'Autoencoder — detecta movimentos incomuns de volume/preço (smart money)',
      metrics: [
        { label: 'Limiar', value: anomaly.threshold != null ? anomaly.threshold.toFixed(6) : '—' },
        { label: 'Detecções', value: anomaly.total_detections || 0 },
        { label: 'Verdadeiros Pos.', value: anomaly.true_positives || 0 },
        { label: 'Precisão', value: anomaly.precision != null ? `${(anomaly.precision * 100).toFixed(1)}%` : '—' },
      ],
      trained: anomaly.last_trained, version: anomaly.version,
    },
    {
      name: 'Sentiment Scorer', icon: <Activity size={20} />, color: theme.green,
      desc: 'Análise NLP de palavras-chave em artigos do Google News por mercado',
      metrics: [
        { label: 'Método', value: sentiment.method || 'keyword' },
        { label: 'Total Analisado', value: sentiment.total_scored || 0 },
        { label: 'Magnitude Média', value: sentiment.avg_magnitude != null ? sentiment.avg_magnitude.toFixed(3) : '—' },
      ],
      trained: null, version: sentiment.version,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.4s ease' }}>

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Brain size={20} color={theme.accent} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Modelos</h2>
        </div>
        <p style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
          Performance e métricas dos modelos de deep learning
        </p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {[
          { label: 'Total de Modelos', value: summary.total_models, color: theme.accent, icon: <Brain size={15} /> },
          { label: 'Treinados', value: summary.models_trained, color: theme.green, icon: <CheckCircle2 size={15} /> },
          { label: 'Total de Predições', value: summary.total_predictions, color: theme.blue, icon: <Gauge size={15} /> },
        ].map((s, i) => (
          <div key={s.label} style={{
            background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12,
            padding: '0.85rem', borderLeft: `3px solid ${s.color}`,
            animation: `fadeIn 0.3s ease ${i * 0.05}s both`,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = theme.cardHover}
          onMouseLeave={e => e.currentTarget.style.background = theme.card}>
            <div style={{ fontSize: '0.65rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <span style={{ color: s.color }}>{s.icon}</span> {s.label}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{s.value ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Model cards */}
      {models.map((m, idx) => (
        <div key={m.name} style={{
          background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14,
          padding: '1.25rem', borderLeft: `3px solid ${m.color}`,
          animation: `fadeIn 0.4s ease ${0.1 + idx * 0.08}s both`,
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = theme.borderHover}
        onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.85rem', flexWrap: 'wrap' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${m.color}12`, color: m.color,
            }}>{m.icon}</div>
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>{m.name}</span>
            <span style={{
              fontSize: '0.6rem', padding: '2px 8px', borderRadius: 6, fontWeight: 700,
              background: `${m.color}12`, color: m.color, letterSpacing: '0.03em',
            }}>v{m.version}</span>
            {m.trained ? (
              <span style={{
                fontSize: '0.68rem', color: theme.green, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto',
              }}>
                <CheckCircle2 size={13} /> Treinado em {new Date(m.trained).toLocaleDateString('pt-BR')}
              </span>
            ) : (
              <span style={{
                fontSize: '0.68rem', color: theme.textMuted, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto',
              }}>
                <Clock size={13} /> Não treinado ainda
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: '1rem', lineHeight: 1.5 }}>{m.desc}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            {m.metrics.map(mt => (
              <div key={mt.label} style={{
                padding: '0.65rem', background: theme.bg, borderRadius: 10,
                border: `1px solid ${theme.border}`, transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = theme.borderHover}
              onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
                <div style={{ fontSize: '0.62rem', color: theme.textSecondary, marginBottom: 4 }}>{mt.label}</div>
                <div style={{
                  fontSize: '0.92rem', fontWeight: 700,
                  color: (mt as any).good === false ? theme.red : (mt as any).good ? theme.green : theme.text,
                }}>{mt.value}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Calibration chart */}
      {calibration.length > 0 && (
        <div style={{
          background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14,
          padding: '1.25rem', animation: 'fadeIn 0.4s ease 0.3s both',
        }}>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '1rem' }}>
            Edge Estimator — Calibração (previsto vs real)
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={calibration}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: theme.textMuted }} />
              <YAxis tick={{ fontSize: 10, fill: theme.textMuted }} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{
                  background: theme.card, border: `1px solid ${theme.border}`,
                  borderRadius: 10, fontSize: '0.75rem', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: theme.textSecondary }}
              />
              <Bar dataKey="predicted" name="Previsto" fill={theme.accent} opacity={0.35} radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Real" fill={theme.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p style={{ fontSize: '0.7rem', color: theme.textMuted, marginTop: 8 }}>
            Calibração perfeita = barras iguais. Verde acima do roxo = modelo subestima a probabilidade.
          </p>
        </div>
      )}
    </div>
  );
};
