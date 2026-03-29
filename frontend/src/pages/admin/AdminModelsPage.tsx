import React from 'react';
import { useApi } from '../../hooks/useApi';
import { Brain, Target, Activity, AlertTriangle, CheckCircle2, Clock, Gauge } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';

export const AdminModelsPage: React.FC<{ dark: boolean }> = ({ dark }) => {
  const { data } = useApi<any>('/admin/models', 30000);

  const card = dark ? '#12141c' : '#fff';
  const border = dark ? '#1e2130' : '#e2e8f0';
  const textSec = dark ? '#8892a4' : '#64748b';

  if (!data) return <div style={{ textAlign: 'center', padding: '3rem', color: textSec }}>Loading model data...</div>;

  const edge = data.edge_estimator || {};
  const anomaly = data.anomaly_detector || {};
  const sentiment = data.sentiment_scorer || {};
  const summary = data.summary || {};

  // Calibration chart data
  const calibration = (edge.calibration_data || []).reduce((acc: any[], d: any) => {
    const bucket = acc.find((b: any) => b.bucket === d.bucket);
    if (bucket) {
      bucket.total++;
      bucket.actual_sum += d.actual;
    } else {
      acc.push({ bucket: d.bucket, predicted: (d.bucket + 0.5) / 10, total: 1, actual_sum: d.actual });
    }
    return acc;
  }, []).map((b: any) => ({
    range: `${b.bucket * 10}-${(b.bucket + 1) * 10}%`,
    predicted: Math.round(b.predicted * 100),
    actual: Math.round((b.actual_sum / b.total) * 100),
    count: b.total,
  }));

  const models = [
    {
      name: 'Edge Estimator', icon: <Target size={18} />, color: '#6366f1',
      desc: 'Transformer — estimates true probability vs market price',
      metrics: [
        { label: 'Brier Score', value: edge.brier_score != null ? edge.brier_score.toFixed(4) : '—', good: edge.brier_score != null && edge.brier_score < 0.25 },
        { label: 'Accuracy', value: edge.live_accuracy != null ? `${(edge.live_accuracy * 100).toFixed(1)}%` : '—', good: edge.live_accuracy != null && edge.live_accuracy > 0.55 },
        { label: 'Predictions', value: edge.total_predictions || 0 },
        { label: 'Correct', value: edge.correct_predictions || 0 },
      ],
      trained: edge.last_trained,
      version: edge.version,
    },
    {
      name: 'Anomaly Detector', icon: <AlertTriangle size={18} />, color: '#f59e0b',
      desc: 'Autoencoder — detects unusual volume/price movements (smart money)',
      metrics: [
        { label: 'Threshold', value: anomaly.threshold != null ? anomaly.threshold.toFixed(6) : '—' },
        { label: 'Detections', value: anomaly.total_detections || 0 },
        { label: 'True Positives', value: anomaly.true_positives || 0 },
        { label: 'Precision', value: anomaly.precision != null ? `${(anomaly.precision * 100).toFixed(1)}%` : '—' },
      ],
      trained: anomaly.last_trained,
      version: anomaly.version,
    },
    {
      name: 'Sentiment Scorer', icon: <Activity size={18} />, color: '#10b981',
      desc: 'NLP keyword analysis on Google News articles per market',
      metrics: [
        { label: 'Method', value: sentiment.method || 'keyword' },
        { label: 'Total Scored', value: sentiment.total_scored || 0 },
        { label: 'Avg Magnitude', value: sentiment.avg_magnitude != null ? sentiment.avg_magnitude.toFixed(3) : '—' },
      ],
      trained: null,
      version: sentiment.version,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {[
          { label: 'Total Models', value: summary.total_models, color: '#6366f1', icon: <Brain size={16} /> },
          { label: 'Trained', value: summary.models_trained, color: '#10b981', icon: <CheckCircle2 size={16} /> },
          { label: 'Total Predictions', value: summary.total_predictions, color: '#3b82f6', icon: <Gauge size={16} /> },
        ].map(s => (
          <div key={s.label} style={{
            background: card, border: `1px solid ${border}`, borderRadius: 10,
            padding: '0.75rem', borderLeft: `3px solid ${s.color}`,
          }}>
            <div style={{ fontSize: '0.65rem', color: textSec, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              {s.icon} {s.label}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{s.value ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Model cards */}
      {models.map(m => (
        <div key={m.name} style={{
          background: card, border: `1px solid ${border}`, borderRadius: 10,
          padding: '1rem', borderLeft: `3px solid ${m.color}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
            <span style={{ color: m.color }}>{m.icon}</span>
            <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{m.name}</span>
            <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4, background: `${m.color}15`, color: m.color }}>
              v{m.version}
            </span>
            {m.trained ? (
              <span style={{ fontSize: '0.65rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                <CheckCircle2 size={12} /> Trained {new Date(m.trained).toLocaleDateString()}
              </span>
            ) : (
              <span style={{ fontSize: '0.65rem', color: textSec, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                <Clock size={12} /> Not trained yet
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.75rem', color: textSec, marginBottom: '0.75rem' }}>{m.desc}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            {m.metrics.map(mt => (
              <div key={mt.label} style={{ padding: '0.5rem', background: dark ? '#0a0b0f' : '#f8fafc', borderRadius: 6 }}>
                <div style={{ fontSize: '0.62rem', color: textSec }}>{mt.label}</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: (mt as any).good === false ? '#ef4444' : (mt as any).good ? '#10b981' : undefined }}>
                  {mt.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Calibration chart */}
      {calibration.length > 0 && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Edge Estimator — Calibration (predicted vs actual)
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={calibration}>
              <CartesianGrid strokeDasharray="3 3" stroke={border} />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: textSec }} />
              <YAxis tick={{ fontSize: 10, fill: textSec }} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={{ background: card, border: `1px solid ${border}`, borderRadius: 8, fontSize: '0.75rem' }} />
              <Bar dataKey="predicted" name="Predicted" fill="#6366f1" opacity={0.4} />
              <Bar dataKey="actual" name="Actual" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
          <p style={{ fontSize: '0.68rem', color: textSec, marginTop: 4 }}>
            Perfect calibration = bars match. Green above purple = model underestimates.
          </p>
        </div>
      )}
    </div>
  );
};
