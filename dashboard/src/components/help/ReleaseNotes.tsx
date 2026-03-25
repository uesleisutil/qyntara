import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface ReleaseNotesProps {
  darkMode?: boolean;
}

interface ReleaseEntry {
  version: string;
  date: string;
  highlights: string[];
}

const releases: ReleaseEntry[] = [
  {
    version: '2.0.1',
    date: '2026-03-15',
    highlights: [
      'In-app feedback widget for submitting ratings and comments',
      'User adoption tracking (DAU, session duration, feature usage)',
      'Launch monitoring runbook and user guide documentation',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-03-12',
    highlights: [
      '4 new tabs: Data Quality, Drift Detection, Explainability, Backtesting',
      'Enhanced Recommendations with filters, comparison, alerts, and export',
      'Enhanced Performance with confusion matrix, benchmarks, and feature importance',
      'Enhanced Validation with scatter plots, temporal accuracy, and outlier analysis',
      'Enhanced Costs with trends, budget alerts, optimization, and ROI calculator',
      'Dark mode, WCAG 2.1 AA accessibility, real-time WebSocket updates',
      'REST API with 15+ endpoints and API key authentication',
      'Guided tours, FAQ, and technical glossary',
    ],
  },
  {
    version: '1.0.0',
    date: '2025-01-15',
    highlights: [
      'Initial release with 4 tabs: Recommendations, Performance, Validation, Costs',
      'DL model (Transformer + BiLSTM)',
      'Automated daily ranking and validation pipeline',
    ],
  },
];

export const ReleaseNotes: React.FC<ReleaseNotesProps> = ({ darkMode = false }) => {
  const theme = {
    bg: darkMode ? '#0f1117' : '#f8f9fb',
    cardBg: darkMode ? '#1a1d27' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f1117',
    textSecondary: darkMode ? '#9ba1b0' : '#5f6577',
    border: darkMode ? '#2a2e3a' : '#e0e2e8',
    accent: '#3b82f6',
    accentBg: darkMode ? '#1a1d27' : '#f1f2f6',
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <Sparkles size={24} color={theme.accent} />
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: theme.text }}>
          Release Notes
        </h2>
      </div>

      {releases.map((release, idx) => (
        <div
          key={release.version}
          style={{
            marginBottom: '1.5rem',
            padding: '1.25rem',
            backgroundColor: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            borderLeft: idx === 0 ? `4px solid ${theme.accent}` : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <span
              style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: theme.accentBg,
                color: theme.accent,
                borderRadius: '9999px',
                fontSize: '0.8125rem',
                fontWeight: '600',
              }}
            >
              v{release.version}
            </span>
            <span style={{ fontSize: '0.8125rem', color: theme.textSecondary }}>
              {release.date}
            </span>
            {idx === 0 && (
              <span
                style={{
                  padding: '0.125rem 0.5rem',
                  backgroundColor: '#dcfce7',
                  color: '#16a34a',
                  borderRadius: '9999px',
                  fontSize: '0.6875rem',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                }}
              >
                Latest
              </span>
            )}
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {release.highlights.map((item, i) => (
              <li
                key={i}
                style={{
                  color: theme.textSecondary,
                  fontSize: '0.875rem',
                  lineHeight: '1.7',
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <a
          href="https://github.com/uesleisutil/qyntara/blob/main/CHANGELOG.md"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            color: theme.accent,
            fontSize: '0.875rem',
            textDecoration: 'none',
          }}
        >
          View full changelog <ArrowRight size={14} />
        </a>
      </div>
    </div>
  );
};

export default ReleaseNotes;
