import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
  darkMode?: boolean;
  size?: number;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, darkMode = false, size = 14 }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<'above' | 'below'>('above');
  const ref = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const adjustPosition = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    // If less than 80px above the button, show below instead
    setPosition(rect.top < 80 ? 'below' : 'above');
  }, []);

  // Adjust horizontal overflow
  useEffect(() => {
    if (!open || !tipRef.current) return;
    const tip = tipRef.current;
    // Reset first
    tip.style.left = '50%';
    tip.style.right = 'auto';
    tip.style.transform = 'translateX(-50%)';

    const tipRect = tip.getBoundingClientRect();
    if (tipRect.right > window.innerWidth - 12) {
      tip.style.left = 'auto';
      tip.style.right = '-8px';
      tip.style.transform = 'none';
    } else if (tipRect.left < 12) {
      tip.style.left = '-8px';
      tip.style.right = 'auto';
      tip.style.transform = 'none';
    }
  }, [open, position]);

  const show = () => { adjustPosition(); setOpen(true); };
  const hide = () => setOpen(false);

  const bgColor = darkMode ? '#334155' : '#1e293b';

  return (
    <div ref={ref} style={{ display: 'inline-flex', position: 'relative', verticalAlign: 'middle' }}>
      <button
        onClick={() => { if (open) hide(); else show(); }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-label="Mais informações"
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
          color: darkMode ? '#64748b' : '#94a3b8', display: 'inline-flex',
          transition: 'color 0.15s', lineHeight: 1,
          WebkitAppearance: 'none', minHeight: 'auto',
        }}
      >
        <HelpCircle size={size} />
      </button>
      {open && (
        <div ref={tipRef} style={{
          position: 'absolute',
          ...(position === 'above'
            ? { bottom: '100%', marginBottom: 6 }
            : { top: '100%', marginTop: 6 }),
          left: '50%', transform: 'translateX(-50%)',
          padding: '0.6rem 0.75rem', borderRadius: 8,
          background: bgColor, color: '#f1f5f9',
          fontSize: '0.75rem', lineHeight: 1.5, maxWidth: 260, minWidth: 180,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)', zIndex: 9999, whiteSpace: 'normal',
          pointerEvents: 'none', wordBreak: 'break-word',
        }}>
          {text}
          {/* Arrow */}
          <div style={{
            position: 'absolute',
            ...(position === 'above'
              ? { top: '100%', borderTop: `6px solid ${bgColor}`, borderBottom: 'none' }
              : { bottom: '100%', borderBottom: `6px solid ${bgColor}`, borderTop: 'none' }),
            left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
          }} />
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;
