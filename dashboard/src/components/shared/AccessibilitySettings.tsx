/**
 * Accessibility Settings Component
 * 
 * Central component for managing all accessibility settings
 * Requirements 67-70: WCAG Compliance, Screen Reader Support, Font Sizes, Tooltips
 */

import { useState } from 'react';
import { FontSizeSettings } from './FontSizeSettings';
import { runAccessibilityAudit, logAccessibilityViolations } from '../../utils/accessibilityAudit';

export function AccessibilitySettings() {
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [auditResults, setAuditResults] = useState<any>(null);
  
  const handleRunAudit = async () => {
    setIsRunningAudit(true);
    try {
      const results = await runAccessibilityAudit();
      setAuditResults(results);
      logAccessibilityViolations(results.violations);
    } catch (error) {
      console.error('Failed to run accessibility audit:', error);
    } finally {
      setIsRunningAudit(false);
    }
  };
  
  return (
    <div className="accessibility-settings">
      <h2 className="settings-title">Accessibility Settings</h2>
      <p className="settings-intro">
        Customize the dashboard to meet your accessibility needs. All settings are saved automatically.
      </p>
      
      <section className="settings-section">
        <FontSizeSettings />
      </section>
      
      <section className="settings-section">
        <h3 className="section-title">Keyboard Navigation</h3>
        <div className="keyboard-shortcuts">
          <p className="section-description">
            The dashboard is fully keyboard accessible. Use these shortcuts:
          </p>
          <ul className="shortcuts-list">
            <li><kbd>Tab</kbd> - Navigate forward through interactive elements</li>
            <li><kbd>Shift + Tab</kbd> - Navigate backward</li>
            <li><kbd>Enter</kbd> or <kbd>Space</kbd> - Activate buttons and links</li>
            <li><kbd>Escape</kbd> - Close modals and dialogs</li>
            <li><kbd>Arrow keys</kbd> - Navigate within charts and tables</li>
          </ul>
        </div>
      </section>
      
      <section className="settings-section">
        <h3 className="section-title">Screen Reader Support</h3>
        <div className="screen-reader-info">
          <p className="section-description">
            This dashboard is optimized for screen readers with:
          </p>
          <ul className="features-list">
            <li>ARIA landmarks for easy navigation</li>
            <li>Descriptive labels for all interactive elements</li>
            <li>Live regions for dynamic content updates</li>
            <li>Text alternatives for all charts and visualizations</li>
            <li>Proper heading hierarchy</li>
          </ul>
        </div>
      </section>
      
      <section className="settings-section">
        <h3 className="section-title">Color and Contrast</h3>
        <div className="contrast-info">
          <p className="section-description">
            All text meets WCAG 2.1 Level AA contrast requirements:
          </p>
          <ul className="features-list">
            <li>Normal text: 4.5:1 contrast ratio minimum</li>
            <li>Large text: 3:1 contrast ratio minimum</li>
            <li>Color is not the only means of conveying information</li>
            <li>Focus indicators are clearly visible</li>
          </ul>
        </div>
      </section>
      
      {process.env.NODE_ENV === 'development' && (
        <section className="settings-section">
          <h3 className="section-title">Accessibility Audit</h3>
          <p className="section-description">
            Run an automated accessibility audit to check for WCAG compliance issues.
          </p>
          <button
            onClick={handleRunAudit}
            disabled={isRunningAudit}
            className="audit-button"
            aria-busy={isRunningAudit}
          >
            {isRunningAudit ? 'Running Audit...' : 'Run Accessibility Audit'}
          </button>
          
          {auditResults && (
            <div className="audit-results" role="region" aria-label="Audit results">
              <h4>Audit Results</h4>
              <div className="results-summary">
                <div className="result-item">
                  <span className="result-label">Violations:</span>
                  <span className={`result-value ${auditResults.violations.length === 0 ? 'success' : 'error'}`}>
                    {auditResults.violations.length}
                  </span>
                </div>
                <div className="result-item">
                  <span className="result-label">Passes:</span>
                  <span className="result-value success">{auditResults.passes}</span>
                </div>
                <div className="result-item">
                  <span className="result-label">Incomplete:</span>
                  <span className="result-value">{auditResults.incomplete}</span>
                </div>
              </div>
              {auditResults.violations.length > 0 && (
                <p className="audit-note">
                  Check the browser console for detailed violation information.
                </p>
              )}
            </div>
          )}
        </section>
      )}
      
      <style>{`
        .accessibility-settings {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        .settings-title {
          font-size: calc(2rem * var(--font-size-scale, 1));
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: var(--text-primary, #1a2e26);
        }
        
        .settings-intro {
          font-size: calc(1rem * var(--font-size-scale, 1));
          color: var(--text-secondary, #5a7268);
          margin-bottom: 2rem;
        }
        
        .settings-section {
          margin-bottom: 2rem;
        }
        
        .section-title {
          font-size: calc(1.5rem * var(--font-size-scale, 1));
          font-weight: 600;
          margin-bottom: 1rem;
          color: var(--text-primary, #1a2e26);
        }
        
        .section-description {
          font-size: calc(1rem * var(--font-size-scale, 1));
          color: var(--text-secondary, #5a7268);
          margin-bottom: 1rem;
        }
        
        .shortcuts-list,
        .features-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .shortcuts-list li,
        .features-list li {
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          background: var(--bg-secondary, #f6faf8);
          border-radius: 0.375rem;
          font-size: calc(0.875rem * var(--font-size-scale, 1));
          color: var(--text-primary, #1a2e26);
        }
        
        kbd {
          display: inline-block;
          padding: 0.125rem 0.375rem;
          background: var(--bg-primary, #ffffff);
          border: 1px solid var(--border-color, #d4e5dc);
          border-radius: 0.25rem;
          font-family: monospace;
          font-size: 0.875em;
          font-weight: 600;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        
        .audit-button {
          padding: 0.75rem 1.5rem;
          background: var(--primary-color, #4a8e77);
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-size: calc(1rem * var(--font-size-scale, 1));
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .audit-button:hover:not(:disabled) {
          background: #4a9e90;
        }
        
        .audit-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .audit-button:focus {
          outline: 3px solid var(--focus-color, #e0b85c);
          outline-offset: 2px;
        }
        
        .audit-results {
          margin-top: 1.5rem;
          padding: 1.5rem;
          background: var(--bg-secondary, #f6faf8);
          border-radius: 0.5rem;
          border: 1px solid var(--border-color, #d4e5dc);
        }
        
        .audit-results h4 {
          font-size: calc(1.125rem * var(--font-size-scale, 1));
          font-weight: 600;
          margin-bottom: 1rem;
          color: var(--text-primary, #1a2e26);
        }
        
        .results-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .result-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem;
          background: var(--bg-primary, #ffffff);
          border-radius: 0.375rem;
        }
        
        .result-label {
          font-size: calc(0.875rem * var(--font-size-scale, 1));
          color: var(--text-secondary, #5a7268);
          margin-bottom: 0.5rem;
        }
        
        .result-value {
          font-size: calc(1.5rem * var(--font-size-scale, 1));
          font-weight: 700;
          color: var(--text-primary, #1a2e26);
        }
        
        .result-value.success {
          color: #4ead8a;
        }
        
        .result-value.error {
          color: #e07070;
        }
        
        .audit-note {
          font-size: calc(0.875rem * var(--font-size-scale, 1));
          color: var(--text-secondary, #5a7268);
          font-style: italic;
        }
        
        @media (max-width: 768px) {
          .accessibility-settings {
            padding: 1rem;
          }
          
          .results-summary {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
