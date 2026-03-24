import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { useKeyboard } from '../../../contexts/KeyboardContext';

export interface KeyboardShortcutsHelpProps {
  darkMode?: boolean;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  darkMode = false
}) => {
  const { shortcuts, showHelp, toggleHelp } = useKeyboard();

  const theme = {
    bg: darkMode ? '#0e0c1e' : '#f8fafc',
    cardBg: darkMode ? '#1e1b40' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#b8b5d0' : '#64748b',
    border: darkMode ? '#363258' : '#e2e8f0',
    hover: darkMode ? '#363258' : '#f1f5f9',
    keyBg: darkMode ? '#363258' : '#f1f5f9'
  };

  if (!showHelp) return null;

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof shortcuts>);

  const categoryLabels = {
    navigation: 'Navigation',
    actions: 'Actions',
    ui: 'User Interface',
    data: 'Data Operations'
  };

  const formatKey = (shortcut: typeof shortcuts[0]): string => {
    const parts: string[] = [];
    if (shortcut.ctrlKey) parts.push('Ctrl');
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.altKey) parts.push('Alt');
    if (shortcut.metaKey) parts.push('⌘');
    parts.push(shortcut.key.toUpperCase());
    return parts.join(' + ');
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={toggleHelp}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          backdropFilter: 'blur(4px)'
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          backgroundColor: theme.cardBg,
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Keyboard size={24} color="#8b5cf6" />
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: theme.text }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={toggleHelp}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.5rem',
              cursor: 'pointer',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="Close keyboard shortcuts help"
          >
            <X size={20} color={theme.textSecondary} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem'
          }}
        >
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} style={{ marginBottom: '2rem' }}>
              <h3
                style={{
                  margin: '0 0 1rem 0',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: theme.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                {categoryLabels[category as keyof typeof categoryLabels] || category}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {categoryShortcuts.map((shortcut) => (
                  <div
                    key={shortcut.action}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      backgroundColor: theme.bg,
                      borderRadius: '0.5rem',
                      border: `1px solid ${theme.border}`
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.9375rem',
                        color: theme.text,
                        fontWeight: '500'
                      }}
                    >
                      {shortcut.description}
                    </span>
                    <kbd
                      style={{
                        padding: '0.375rem 0.75rem',
                        backgroundColor: theme.keyBg,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '0.375rem',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        color: theme.text,
                        fontFamily: 'monospace',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      {formatKey(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: `1px solid ${theme.border}`,
            backgroundColor: theme.bg,
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <p style={{ margin: 0, fontSize: '0.875rem', color: theme.textSecondary }}>
            Press <kbd style={{ 
              padding: '0.25rem 0.5rem',
              backgroundColor: theme.keyBg,
              border: `1px solid ${theme.border}`,
              borderRadius: '0.25rem',
              fontFamily: 'monospace'
            }}>?</kbd> to toggle this help panel
          </p>
        </div>
      </div>
    </>
  );
};

export default KeyboardShortcutsHelp;
