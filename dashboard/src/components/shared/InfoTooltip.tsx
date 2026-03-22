import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
  darkMode?: boolean;
  size?: number;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, darkMode = false, size = 14 }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [open]);

  // Adjust position if tooltip goes off-screen
  useEffect(() => {
    if (!open || !tipRef.current) return;
    const rect = tipRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      tipRef.current.style.left = 'auto';
      tipRef.current.style.right = '0';
    }
    if (rect.left < 8) {
      tipRef.current.style.left = '0';
      tipRef.current.style.right = 'auto';
    }
  }, [open]);

  return (
    <div ref={ref} style={{ display: 'inline-flex', position: 'relative', verticalAlign: 'middle' }}>
      <button
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label="Mais informações"
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 1,
          color: darkMode ? '#64748b' : '#94a3b8', display: 'inline-flex',
          transition: 'color 0.15s', lineHeight: 1,
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <HelpCircle size={size} />
      </button>
      {open && (
        <div ref={tipRef} style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 6, padding: '0.6rem 0.75rem', borderRadius: 8,
          background: darkMode ? '#334155' : '#1e293b', color: '#f1f5f9',
          fontSize: '0.75rem', lineHeight: 1.5, maxWidth: 260, minWidth: 180,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)', zIndex: 100, whiteSpace: 'normal',
          pointerEvents: 'none',
        }}>
          {text}
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
            borderTop: `6px solid ${darkMode ? '#334155' : '#1e293b'}`,
          }} />
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;
