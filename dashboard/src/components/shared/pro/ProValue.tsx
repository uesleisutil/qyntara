import React from 'react';
import { Lock } from 'lucide-react';

interface Props {
  isPro: boolean;
  children: React.ReactNode;
  /** inline style applied to the wrapper span */
  style?: React.CSSProperties;
  /** placeholder shown to free users (default: •••••) */
  placeholder?: string;
}

/**
 * ProValue — renders real content only for Pro users.
 * Free users see a masked placeholder + clickable lock icon.
 * The real value is NEVER in the DOM for free users.
 */
const ProValue: React.FC<Props> = ({ isPro, children, style, placeholder = '•••••' }) => {
  if (isPro) return <span style={style}>{children}</span>;

  return (
    <span style={{ ...style, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
      <span style={{ color: '#64748b', filter: 'blur(4px)', userSelect: 'none', pointerEvents: 'none' }} aria-hidden="true">
        {placeholder}
      </span>
      <Lock
        size={11}
        color="#f59e0b"
        style={{ cursor: 'pointer', flexShrink: 0, opacity: 0.8 }}
        onClick={() => { window.location.hash = '#/dashboard/upgrade'; }}
        role="link"
        aria-label="Assine o Pro para ver este valor"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') window.location.hash = '#/dashboard/upgrade'; }}
      />
    </span>
  );
};

export default ProValue;
