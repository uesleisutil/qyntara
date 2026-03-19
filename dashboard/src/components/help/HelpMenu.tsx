import React, { useState, useEffect } from 'react';
import { HelpCircle, BookOpen, MessageCircle, Play, X, Star, Sparkles } from 'lucide-react';
import { GuidedTour } from './GuidedTour';
import { FAQ } from './FAQ';
import { Glossary } from './Glossary';
import { FeedbackWidget } from './FeedbackWidget';
import { ReleaseNotes } from './ReleaseNotes';

interface HelpMenuProps {
  darkMode?: boolean;
}

type HelpView = 'menu' | 'faq' | 'glossary' | 'feedback' | 'release-notes' | null;

export const HelpMenu: React.FC<HelpMenuProps> = ({ darkMode = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<HelpView>('menu');
  const [runTour, setRunTour] = useState(false);
  const [tourType, setTourType] = useState<'main' | 'advanced'>('main');
  const [hasCompletedTour, setHasCompletedTour] = useState(() => {
    return localStorage.getItem('tourCompleted') === 'true';
  });

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    hover: darkMode ? '#334155' : '#f8fafc',
    accent: '#3b82f6',
  };

  // Check if this is the first visit
  useEffect(() => {
    const isFirstVisit = !localStorage.getItem('hasVisited');
    if (isFirstVisit) {
      localStorage.setItem('hasVisited', 'true');
      // Offer tour after a short delay
      setTimeout(() => {
        if (window.confirm('Welcome to the B3 Tactical Ranking Dashboard! Would you like to take a guided tour?')) {
          setRunTour(true);
        }
      }, 1000);
    }
  }, []);

  const handleTourComplete = () => {
    setRunTour(false);
    localStorage.setItem('tourCompleted', 'true');
    setHasCompletedTour(true);
  };

  const handleTourSkip = () => {
    setRunTour(false);
  };

  const startTour = (type: 'main' | 'advanced') => {
    setTourType(type);
    setRunTour(true);
    setIsOpen(false);
  };

  const openView = (view: HelpView) => {
    setCurrentView(view);
    if (view !== 'menu') {
      setIsOpen(true);
    }
  };

  const closeHelp = () => {
    setIsOpen(false);
    setCurrentView('menu');
  };

  return (
    <>
      {/* Help Button */}
      <button
        data-tour="help-menu"
        onClick={() => {
          setIsOpen(!isOpen);
          setCurrentView('menu');
        }}
        style={{
          padding: '0.75rem',
          backgroundColor: darkMode ? '#334155' : '#f1f5f9',
          border: 'none',
          borderRadius: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          boxShadow: darkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
          position: 'relative',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        title="Help & Documentation"
      >
        <HelpCircle size={20} color={theme.accent} />
        {!hasCompletedTour && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              width: '12px',
              height: '12px',
              backgroundColor: '#ef4444',
              borderRadius: '50%',
              border: `2px solid ${theme.cardBg}`,
            }}
          />
        )}
      </button>

      {/* Help Menu Dropdown */}
      {isOpen && currentView === 'menu' && (
        <div
          style={{
            position: 'fixed',
            top: '5rem',
            right: '2rem',
            width: '320px',
            backgroundColor: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            boxShadow: darkMode ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: `1px solid ${theme.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: theme.text }}>
              Help & Documentation
            </h3>
            <button
              onClick={closeHelp}
              style={{
                padding: '0.25rem',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: theme.textSecondary,
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Menu Items */}
          <div style={{ padding: '0.5rem' }}>
            {/* Guided Tours */}
            <div style={{ marginBottom: '0.5rem' }}>
              <button
                onClick={() => startTour('main')}
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'left',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  style={{
                    padding: '0.5rem',
                    backgroundColor: darkMode ? '#1e3a5f' : '#eff6ff',
                    borderRadius: '8px',
                  }}
                >
                  <Play size={18} color={theme.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: theme.text, marginBottom: '0.125rem' }}>
                    Start Main Tour
                  </div>
                  <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
                    Learn the basics of the dashboard
                  </div>
                </div>
              </button>
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <button
                onClick={() => startTour('advanced')}
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'left',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  style={{
                    padding: '0.5rem',
                    backgroundColor: darkMode ? '#1e3a5f' : '#eff6ff',
                    borderRadius: '8px',
                  }}
                >
                  <Play size={18} color={theme.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: theme.text, marginBottom: '0.125rem' }}>
                    Advanced Features Tour
                  </div>
                  <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
                    Explore powerful analysis tools
                  </div>
                </div>
              </button>
            </div>

            {/* FAQ */}
            <div style={{ marginBottom: '0.5rem' }}>
              <button
                onClick={() => openView('faq')}
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'left',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  style={{
                    padding: '0.5rem',
                    backgroundColor: darkMode ? '#1e3a5f' : '#eff6ff',
                    borderRadius: '8px',
                  }}
                >
                  <MessageCircle size={18} color={theme.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: theme.text, marginBottom: '0.125rem' }}>
                    FAQ
                  </div>
                  <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
                    Frequently asked questions
                  </div>
                </div>
              </button>
            </div>

            {/* Glossary */}
            <div style={{ marginBottom: '0.5rem' }}>
              <button
                onClick={() => openView('glossary')}
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'left',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  style={{
                    padding: '0.5rem',
                    backgroundColor: darkMode ? '#1e3a5f' : '#eff6ff',
                    borderRadius: '8px',
                  }}
                >
                  <BookOpen size={18} color={theme.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: theme.text, marginBottom: '0.125rem' }}>
                    Technical Glossary
                  </div>
                  <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
                    Definitions and formulas
                  </div>
                </div>
              </button>
            </div>

            {/* Feedback */}
            <div style={{ marginBottom: '0.5rem' }}>
              <button
                onClick={() => openView('feedback')}
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'left',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  style={{
                    padding: '0.5rem',
                    backgroundColor: darkMode ? '#1e3a5f' : '#eff6ff',
                    borderRadius: '8px',
                  }}
                >
                  <Star size={18} color={theme.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: theme.text, marginBottom: '0.125rem' }}>
                    Feedback
                  </div>
                  <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
                    Rate and share your thoughts
                  </div>
                </div>
              </button>
            </div>

            {/* Release Notes */}
            <div style={{ marginBottom: '0.5rem' }}>
              <button
                onClick={() => openView('release-notes')}
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'left',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  style={{
                    padding: '0.5rem',
                    backgroundColor: darkMode ? '#1e3a5f' : '#eff6ff',
                    borderRadius: '8px',
                  }}
                >
                  <Sparkles size={18} color={theme.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: theme.text, marginBottom: '0.125rem' }}>
                    Release Notes
                  </div>
                  <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
                    What's new in the dashboard
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Views */}
      {isOpen && currentView === 'faq' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.bg,
            zIndex: 9999,
            overflow: 'auto',
          }}
        >
          <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: theme.cardBg, borderBottom: `1px solid ${theme.border}`, padding: '1rem 2rem' }}>
            <button
              onClick={closeHelp}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: theme.text,
                fontSize: '0.875rem',
                fontWeight: '600',
              }}
            >
              <X size={16} />
              Close
            </button>
          </div>
          <FAQ darkMode={darkMode} />
        </div>
      )}

      {isOpen && currentView === 'glossary' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.bg,
            zIndex: 9999,
            overflow: 'auto',
          }}
        >
          <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: theme.cardBg, borderBottom: `1px solid ${theme.border}`, padding: '1rem 2rem' }}>
            <button
              onClick={closeHelp}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: theme.text,
                fontSize: '0.875rem',
                fontWeight: '600',
              }}
            >
              <X size={16} />
              Close
            </button>
          </div>
          <Glossary darkMode={darkMode} />
        </div>
      )}

      {/* Feedback View */}
      {isOpen && currentView === 'feedback' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.bg,
            zIndex: 9999,
            overflow: 'auto',
          }}
        >
          <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: theme.cardBg, borderBottom: `1px solid ${theme.border}`, padding: '1rem 2rem' }}>
            <button
              onClick={closeHelp}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: theme.text,
                fontSize: '0.875rem',
                fontWeight: '600',
              }}
            >
              <X size={16} />
              Close
            </button>
          </div>
          <FeedbackWidget darkMode={darkMode} onClose={closeHelp} />
        </div>
      )}

      {/* Release Notes View */}
      {isOpen && currentView === 'release-notes' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.bg,
            zIndex: 9999,
            overflow: 'auto',
          }}
        >
          <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: theme.cardBg, borderBottom: `1px solid ${theme.border}`, padding: '1rem 2rem' }}>
            <button
              onClick={closeHelp}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: theme.text,
                fontSize: '0.875rem',
                fontWeight: '600',
              }}
            >
              <X size={16} />
              Close
            </button>
          </div>
          <ReleaseNotes darkMode={darkMode} />
        </div>
      )}

      {/* Guided Tour Component */}
      <GuidedTour
        run={runTour}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
        tourType={tourType}
      />
    </>
  );
};

export default HelpMenu;
