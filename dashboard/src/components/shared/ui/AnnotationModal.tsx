import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { ANNOTATION_CATEGORIES } from '../../../types/annotations';

export interface AnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (text: string, category?: string) => void;
  initialText?: string;
  initialCategory?: string;
  date: string;
  darkMode?: boolean;
}

export const AnnotationModal: React.FC<AnnotationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialText = '',
  initialCategory,
  date,
  darkMode = false
}) => {
  const [text, setText] = useState(initialText);
  const [category, setCategory] = useState(initialCategory || 'note');

  const theme = {
    bg: darkMode ? '#0e0c1e' : '#f8fafc',
    cardBg: darkMode ? '#1e1b40' : 'white',
    text: darkMode ? '#f1f5f9' : '#0c0a1a',
    textSecondary: darkMode ? '#b8b5d0' : '#64748b',
    border: darkMode ? '#363258' : '#e2e8f0',
    hover: darkMode ? '#363258' : '#f1f5f9',
    inputBg: darkMode ? '#0e0c1e' : 'white'
  };

  if (!isOpen) return null;

  const handleSave = () => {
    if (text.trim()) {
      onSave(text.trim(), category);
      setText('');
      setCategory('note');
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
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
        onKeyDown={handleKeyDown}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '500px',
          backgroundColor: theme.cardBg,
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column'
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
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: theme.text }}>
              Add Annotation
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: theme.textSecondary }}>
              {new Date(date).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={onClose}
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
            aria-label="Close annotation modal"
          >
            <X size={20} color={theme.textSecondary} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="annotation-category"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: theme.text
              }}
            >
              Category
            </label>
            <select
              id="annotation-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem',
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                color: theme.text,
                cursor: 'pointer'
              }}
            >
              {ANNOTATION_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="annotation-text"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: theme.text
              }}
            >
              Annotation Text *
            </label>
            <textarea
              id="annotation-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your annotation..."
              autoFocus
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                color: theme.text,
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: theme.textSecondary }}>
              Press Ctrl+Enter to save
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: `1px solid ${theme.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: 'transparent',
              color: theme.textSecondary,
              border: `1px solid ${theme.border}`,
              borderRadius: '0.5rem',
              fontSize: '0.9375rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!text.trim()}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: text.trim() ? '#8b5cf6' : theme.border,
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.9375rem',
              fontWeight: '500',
              cursor: text.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
              opacity: text.trim() ? 1 : 0.5
            }}
            onMouseEnter={(e) => {
              if (text.trim()) {
                e.currentTarget.style.backgroundColor = '#7c3aed';
              }
            }}
            onMouseLeave={(e) => {
              if (text.trim()) {
                e.currentTarget.style.backgroundColor = '#8b5cf6';
              }
            }}
          >
            <Save size={16} />
            Save Annotation
          </button>
        </div>
      </div>
    </>
  );
};

export default AnnotationModal;
