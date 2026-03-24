import React from 'react';
import { Settings2, X, Eye, EyeOff, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

export interface WidgetConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  /** Some widgets are always visible */
  locked?: boolean;
  /** Pro-only widgets */
  proOnly?: boolean;
}

interface WidgetPreferencesProps {
  open: boolean;
  onClose: () => void;
  widgets: WidgetConfig[];
  onToggle: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  darkMode: boolean;
  theme: Record<string, string>;
  isPro: boolean;
}

const WidgetPreferences: React.FC<WidgetPreferencesProps> = ({
  open, onClose, widgets, onToggle, onReorder, darkMode, theme, isPro,
}) => {
  if (!open) return null;

  const moveUp = (i: number) => { if (i > 0) onReorder(i, i - 1); };
  const moveDown = (i: number) => { if (i < widgets.length - 1) onReorder(i, i + 1); };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 999, backdropFilter: 'blur(2px)',
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(360px, 90vw)',
        background: darkMode ? '#0c0a1a' : '#ffffff',
        borderLeft: `1px solid ${theme.border}`,
        zIndex: 1000, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 30px rgba(0,0,0,0.2)',
        animation: 'slideIn 0.2s ease-out',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '1rem 1.2rem', borderBottom: `1px solid ${theme.border}`,
        }}>
          <Settings2 size={18} color="#8b5cf6" />
          <span style={{ fontSize: '1rem', fontWeight: 700, color: theme.text, flex: 1 }}>
            Personalizar Dashboard
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary,
            padding: 4, borderRadius: 6,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <div style={{ padding: '0.75rem 1.2rem', fontSize: '0.78rem', color: theme.textSecondary }}>
          Ative ou desative widgets e reordene arrastando. Suas preferências são salvas automaticamente.
        </div>

        {/* Widget list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 1.2rem 1rem' }}>
          {widgets.map((w, i) => {
            const disabled = w.proOnly && !isPro;
            return (
              <div key={w.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.65rem 0.5rem', borderRadius: 10,
                marginBottom: '0.35rem',
                background: w.enabled
                  ? (darkMode ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.04)')
                  : 'transparent',
                border: `1px solid ${w.enabled ? (darkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)') : 'transparent'}`,
                opacity: disabled ? 0.45 : 1,
                transition: 'all 0.15s',
              }}>
                {/* Reorder */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <button onClick={() => moveUp(i)} disabled={i === 0}
                    style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', padding: 0, color: theme.textSecondary, opacity: i === 0 ? 0.2 : 0.5, lineHeight: 1 }}>
                    <ChevronUp size={13} />
                  </button>
                  <button onClick={() => moveDown(i)} disabled={i === widgets.length - 1}
                    style={{ background: 'none', border: 'none', cursor: i === widgets.length - 1 ? 'default' : 'pointer', padding: 0, color: theme.textSecondary, opacity: i === widgets.length - 1 ? 0.2 : 0.5, lineHeight: 1 }}>
                    <ChevronDown size={13} />
                  </button>
                </div>

                <GripVertical size={14} color={theme.textSecondary} style={{ opacity: 0.3 }} />

                {/* Icon */}
                <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', flexShrink: 0 }}>
                  {w.icon}
                </div>

                {/* Label */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text }}>{w.label}</div>
                  {disabled && (
                    <div style={{ fontSize: '0.68rem', color: '#f59e0b' }}>Disponível no plano Pro</div>
                  )}
                </div>

                {/* Toggle */}
                <button
                  onClick={() => !disabled && !w.locked && onToggle(w.id)}
                  disabled={disabled || w.locked}
                  style={{
                    background: 'none', border: 'none', cursor: disabled || w.locked ? 'default' : 'pointer',
                    color: w.enabled ? '#8b5cf6' : theme.textSecondary, padding: 4,
                    opacity: w.locked ? 0.3 : 1,
                  }}
                  title={w.locked ? 'Sempre visível' : w.enabled ? 'Desativar' : 'Ativar'}
                >
                  {w.enabled ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.75rem 1.2rem', borderTop: `1px solid ${theme.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.72rem', color: theme.textSecondary }}>
            {widgets.filter(w => w.enabled).length} de {widgets.length} widgets ativos
          </span>
          <button onClick={onClose} style={{
            padding: '0.45rem 1rem', borderRadius: 8, border: 'none',
            background: '#8b5cf6', color: 'white', fontSize: '0.8rem',
            fontWeight: 600, cursor: 'pointer',
          }}>
            Pronto
          </button>
        </div>
      </div>
    </>
  );
};

export default WidgetPreferences;
