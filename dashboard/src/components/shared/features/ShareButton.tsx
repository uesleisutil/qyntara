import React, { useState } from 'react';
import { Share2, MessageCircle, Copy, Check } from 'lucide-react';
import ReactDOM from 'react-dom';

interface ShareButtonProps {
  text: string;
  darkMode: boolean;
  size?: number;
}

const ShareButton: React.FC<ShareButtonProps> = ({ text, darkMode, size = 14 }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [btnRect, setBtnRect] = useState<DOMRect | null>(null);

  const siteUrl = 'https://uesleisutil.github.io/b3-tactical-ranking/';
  const fullText = `${text}\n\n${siteUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(siteUrl)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    setBtnRect(e.currentTarget.getBoundingClientRect());
    setOpen(!open);
  };

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: (btnRect?.bottom || 0) + 6,
    right: Math.max(8, window.innerWidth - (btnRect?.right || 0)),
    zIndex: 9999,
    background: darkMode ? '#1e1b40' : '#fff',
    border: `1px solid ${darkMode ? '#363258' : '#e2e8f0'}`,
    borderRadius: 10, padding: '0.35rem', minWidth: 180,
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
    padding: '0.5rem 0.65rem', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: '0.8rem', background: 'transparent', textDecoration: 'none',
    color: darkMode ? '#f1f5f9' : '#0c0a1a', transition: 'background 0.1s',
    WebkitAppearance: 'none' as any,
  };

  return (
    <>
      <button onClick={handleToggle} style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        padding: '0.45rem 0.75rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 500,
        border: `1px solid ${darkMode ? '#363258' : '#e2e8f0'}`,
        background: 'transparent', color: darkMode ? '#b8b5d0' : '#64748b',
        cursor: 'pointer', WebkitAppearance: 'none' as any, transition: 'all 0.15s',
        minHeight: 'auto',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.color = '#8b5cf6'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = darkMode ? '#363258' : '#e2e8f0'; e.currentTarget.style.color = darkMode ? '#b8b5d0' : '#64748b'; }}
      >
        <Share2 size={size} /> Compartilhar
      </button>

      {open && ReactDOM.createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div style={menuStyle}>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={itemStyle}
              onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#363258' : '#f1f5f9'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <MessageCircle size={15} color="#25d366" /> WhatsApp
            </a>
            <a href={twitterUrl} target="_blank" rel="noopener noreferrer" style={itemStyle}
              onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#363258' : '#f1f5f9'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Share2 size={15} color="#1da1f2" /> Twitter / X
            </a>
            <button onClick={handleCopy} style={itemStyle}
              onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#363258' : '#f1f5f9'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              {copied ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
              {copied ? 'Copiado!' : 'Copiar texto'}
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default ShareButton;
