import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
  darkMode?: boolean;
  size?: number;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, darkMode = false, size = 14 }) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; position: 'above' | 'below' }>({ top: 0, left: 0, position: 'above' });
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

  // Adjust horizontal overflow after portal renders
  useEffect(() => {
    if (!open || !tipRef.current) return;
    const tip = tipRef.current;
    const tipRect = tip.getBoundingClientRect();
    if (tipRect.right > window.innerWidth - 12) {
      tip.style.left = `${coords.left - (tipRect.right - window.innerWidth + 16)}px`;
    } else if (tipRect.left < 12) {
      tip.style.left = '12px';
    }
  }, [open, coords]);

  const calcCoords = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pos = rect.top < 100 ? 'below' : 'above';
    setCoords({
      top: pos === 'above' ? rect.top - 8 : rect.bottom + 8,
      left: rect.left + rect.width / 2,
      position: pos,
    });
  }, []);

  const show = () => { calcCoords(); setOpen(true); };
  const hide = () => setOpen(false);

  const bgColor = darkMode ? '#363258' : '#1a1836';

  const tooltip = open ? ReactDOM.createPortal(
    <div ref={tipRef} style={{
      position: 'fixed',
      top: coords.position === 'above' ? undefined : coords.top,
      bottom: coords.position === 'above' ? `${window.innerHeight - coords.top}px` : undefined,
      left: coords.left,
      transform: 'translateX(-50%)',
      padding: '0.6rem 0.75rem', borderRadius: 8,
      background: bgColor, color: '#f1f5f9',
      fontSize: '0.75rem', lineHeight: 1.5, maxWidth: 260, minWidth: 180,
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)', zIndex: 99999, whiteSpace: 'normal',
      pointerEvents: 'none', wordBreak: 'break-word',
    }}>
      {text}
      <div style={{
        position: 'absolute',
        ...(coords.position === 'above'
          ? { top: '100%', borderTop: `6px solid ${bgColor}`, borderBottom: 'none' }
          : { bottom: '100%', borderBottom: `6px solid ${bgColor}`, borderTop: 'none' }),
        left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
      }} />
    </div>,
    document.body
  ) : null;

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
          color: darkMode ? '#64748b' : '#9895b0', display: 'inline-flex',
          transition: 'color 0.15s', lineHeight: 1,
          WebkitAppearance: 'none', minHeight: 'auto',
        }}
      >
        <HelpCircle size={size} />
      </button>
      {tooltip}
    </div>
  );
};

export default InfoTooltip;
