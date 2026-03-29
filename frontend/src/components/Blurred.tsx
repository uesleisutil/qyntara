import React from 'react';
import { theme } from '../styles';
import { Lock } from 'lucide-react';

/**
 * Blurred content gate.
 * 
 * SECURITY: When locked, the real `children` are NOT rendered in the DOM at all.
 * Instead, placeholder gibberish is shown with CSS blur + user-select:none.
 * This means the real data cannot be found in page source, DevTools, or copy/paste.
 * 
 * The actual data only renders when `locked` is false (i.e., user has the right tier).
 */
interface Props {
  locked: boolean;
  children: React.ReactNode;
  label?: string;
  height?: number | string;
  inline?: boolean;
}

// Deterministic fake text that looks like data but is meaningless
const PLACEHOLDER_LINES = [
  '████████ ██████ ████ ██████████',
  '██████ ████████████ ██████',
  '████ ██████ ████████ ██████████ ████',
  '██████████ ████ ██████ ████████',
  '████████ ██████████ ████ ██████',
];

export const Blurred: React.FC<Props> = ({ locked, children, label, height, inline }) => {
  // If not locked, render children normally
  if (!locked) return <>{children}</>;

  // When locked: render fake placeholder, NOT the real children
  if (inline) {
    return (
      <span
        aria-hidden="true"
        style={{
          filter: 'blur(6px)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          pointerEvents: 'none',
          color: theme.textMuted,
          fontSize: 'inherit',
        }}
        onCopy={e => e.preventDefault()}
      >
        ██████
      </span>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Fake blurred content — NOT the real data */}
      <div
        aria-hidden="true"
        style={{
          filter: 'blur(8px)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          pointerEvents: 'none',
          minHeight: height || 120,
          overflow: 'hidden',
          padding: '1rem',
          color: theme.textMuted,
          fontSize: '0.8rem',
          lineHeight: 2,
        }}
        onCopy={e => e.preventDefault()}
      >
        {PLACEHOLDER_LINES.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

      {/* Overlay with lock message */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: `${theme.bg}90`,
        borderRadius: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: theme.accentBg, color: theme.accent, marginBottom: 10,
        }}>
          <Lock size={20} />
        </div>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, marginBottom: 4 }}>
          {label || 'Conteúdo bloqueado'}
        </span>
        <span style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
          Faça upgrade para desbloquear
        </span>
      </div>
    </div>
  );
};
