import React from 'react';
import { useApi } from '../../hooks/useApi';
import { theme } from '../../styles';
import { Brain, Target, Activity, AlertTriangle, CheckCircle2, Clock, Gauge } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const AdminModelsPage: React.FC<{ dark?: boolean }> = () => {
  const { data } = useApi<any>('/admin/models', 30000);

  if (!data) {
    return (
      <div>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Modelos</h2>
          <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>Carregando...</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 120, borderRadius: 12, border: `1px solid ${theme.border}`, background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`, backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite ${i * 0.1}s` }} />
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
  }));

  const models = [
    { name: 'Edge Estimator', icon: <Target size={18} />, color: theme.accent,
      desc: 'Transformer — probabilidade real vs preço de mercado',
      metrics: [
        { l: 'Brier Score', v: edge.brier_score != null ? edge.brier_score.toFixed(4) : '—', good: edge.brier_score != null && edge.brier_score < 0.25 },
        { l: 'Acurácia', v: edge.live_accuracy != null ? `${(edge.live_accuracy * 100).toFixed(1)}%` : '—', good: edge.live_accuracy != null && edge.live_accuracy > 0.55 },
        { l: 'Predições', v: edge.total_predictions || 0 },
        { l: 'Corretas', v: edge.correct_predictions || 0 },
      ], trained: edge.last_trained, version: edge.version },
    { name: 'Anomaly Detector', icon: <AlertTriangle size={18} />, color: theme.yellow,
      desc: 'Autoencoder — movimentos incomuns de volume/preço',
      metrics: [
        { l: 'Limiar', v: anomaly.threshold != null ? anomaly.threshold.toFixed(6) : '—' },
        { l: 'Detecções', v: anomaly.total_detections || 0 },
        { l: 'Verdadeiros Pos.', v: anomaly.true_positives || 0 },
        { l: 'Precisão', v: anomaly.precision != null ? `${(anomaly.precision * 100).toFixed(1)}%` : '—' },
      ], trained: anomaly.last_trained, version: anomaly.version },
    { name: 'Sentiment Scorer', icon: <Activity size={18} />, color: theme.green,
      desc: 'NLP — análise de notícias por mercado',
      metrics: [
        { l: 'Método', v: sentiment.method || 'keyword' },
        { l: 'Analisados', v: sentiment.total_scored || 0 },
        { l: 'Magnitude', v: sentiment.avg_magnitude != null ? sentiment.avg_magnitude.toFixed(3) : '—' },
      ], trained: null, version: sentiment.version },
  ];

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Modelos</h2>
        <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>Performance e métricas de deep learning</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: '1.5rem' }}>
        {[
          { l: 'Modelos', v: summary.total_models, c: theme.accent, ic: <Brain size={13} /> },
          { l: 'Treinados', v: summary.models_trained, c: theme.green, ic: <CheckCircle2 size={13} /> },
          { l: 'Predições', v: summary.total_predictions, c: theme.blue, ic: <Gauge size={13} /> },
        ].map(s => (
          <div key={s.l} style={{
            padding: '0.75rem', borderRadius: 10, borderLeft: `3px solid ${s.c}`,
            background: theme.card, transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = theme.cardHover}
          onMouseLeave={e => e.currentTarget.style.background = theme.card}>
            <div style={{ fontSize: '0.6rem', color: theme.textMuted, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span style={{ color: s.c }}>{s.ic}</span> {s.l}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{s.v ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Model cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {models.map(m => (
          <div key={m.name} style={{
            padding: '1.25rem', borderRadius: 12, borderLeft: `3px solid ${m.color}`,
            background: theme.card, transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = theme.cardHover}
          onMouseLeave={e => e.currentTarget.style.background = theme.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ color: m.color }}>{m.icon}</span>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{m.name}</span>
              <span style={{ fontSize: '0.55rem', padding: '1px 6px', borderRadius: 4, background: `${m.color}12`, color: m.color, fontWeight: 700 }}>v{m.version}</span>
              <span style={{ fontSize: '0.62rem', color: m.trained ? theme.green : theme.textMuted, display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                {m.trained ? <><CheckCircle2 size={11} /> Treinado {new Date(m.trained).toLocaleDateString('pt-BR')}</> : <><Clock size={11} /> Não treinado</>}
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: theme.textMuted, marginBottom: '0.75rem' }}>{m.desc}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6 }}>
              {m.metrics.map(mt => (
                <div key={mt.l} style={{ padding: '0.5rem', borderRadius: 8, background: theme.bg, border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: '0.58rem', color: theme.textMuted, marginBottom: 3 }}>{mt.l}</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: (mt as any).good === false ? theme.red : (mt as any).good ? theme.green : theme.text }}>{mt.v}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Calibration */}
      {calibration.length > 0 && (
        <div style={{ background: theme.card, borderRadius: 12, padding: '1rem', marginTop: '1rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.75rem' }}>Calibração — previsto vs real</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={calibration}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis dataKey="range" tick={{ fontSize: 9, fill: theme.textMuted }} />
              <YAxis tick={{ fontSize: 9, fill: theme.textMuted }} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: '0.72rem' }} />
              <Bar dataKey="predicted" name="Previsto" fill={theme.accent} opacity={0.3} radius={[3, 3, 0, 0]} />
              <Bar dataKey="actual" name="Real" fill={theme.green} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p style={{ fontSize: '0.62rem', color: theme.textMuted, marginTop: 6 }}>Barras iguais = calibração perfeita</p>
        </div>
      )}
    </div>
  );
};
