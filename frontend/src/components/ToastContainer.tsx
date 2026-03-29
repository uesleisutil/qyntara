import React from 'react';
import { useToastStore } from '../store/toastStore';
import { theme } from '../styles';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const icons = {
  success: <CheckCircle2 size={16} color={theme.green} />,
  error: <XCircle size={16} color={theme.red} />,
  info: <Info size={16} color={theme.accent} />,
};
const colors = {
  success: { bg: theme.greenBg, border: `${theme.green}25`, text: theme.green },
  error: { bg: theme.redBg, border: `${theme.red}25`, text: theme.red },
  info: { bg: theme.accentBg, border: `${theme.accentBorder}`, text: theme.accent },
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();
  if (!toasts.length) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380,
    }}>
      {toasts.map(t => {
        const c = colors[t.type];
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '0.7rem 1rem', borderRadius: 12,
            background: theme.card, border: `1px solid ${c.border}`,
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            animation: 'slideUp 0.3s ease',
            cursor: 'pointer',
          }} onClick={() => removeToast(t.id)}>
            {icons[t.type]}
            <span style={{ flex: 1, fontSize: '0.82rem', color: theme.text, lineHeight: 1.4 }}>{t.message}</span>
            <X size={14} color={theme.textMuted} style={{ flexShrink: 0 }} />
          </div>
        );
      })}
    </div>
  );
};
