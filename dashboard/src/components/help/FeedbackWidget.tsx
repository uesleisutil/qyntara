/**
 * FeedbackWidget
 *
 * In-app feedback form that lets users submit a rating (1-5 stars)
 * and free-text comments. Submits to /api/feedback endpoint.
 *
 * Requirements: 91.6 (user satisfaction through in-app surveys)
 */

import React, { useState } from 'react';
import { Star, Send, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../../services/api';

interface FeedbackWidgetProps {
  darkMode?: boolean;
  onClose?: () => void;
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ darkMode = false, onClose }) => {
  const [rating, setRating] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [category, setCategory] = useState('general');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    accent: '#3b82f6',
    inputBg: darkMode ? '#0f172a' : '#f8fafc',
  };

  const categories = [
    { value: 'general', label: 'General' },
    { value: 'bug', label: 'Bug Report' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'usability', label: 'Usability' },
    { value: 'performance', label: 'Performance' },
  ];

  const handleSubmit = async () => {
    if (rating === 0) return;

    setSubmitState('submitting');
    setErrorMessage('');

    try {
      await api.post('/api/feedback', {
        rating,
        comment: comment.trim(),
        category,
        page: window.location.pathname,
        timestamp: new Date().toISOString(),
      });
      setSubmitState('success');
    } catch (err) {
      setSubmitState('error');
      setErrorMessage('Failed to submit feedback. Please try again.');
    }
  };

  if (submitState === 'success') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <CheckCircle size={48} color="#22c55e" style={{ marginBottom: '1rem' }} />
        <h3 style={{ color: theme.text, margin: '0 0 0.5rem', fontSize: '1.125rem' }}>
          Thank you!
        </h3>
        <p style={{ color: theme.textSecondary, fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
          Your feedback helps us improve the dashboard.
        </p>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: theme.accent,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2rem' }}>
      <h2 style={{ color: theme.text, margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: '700' }}>
        Share Your Feedback
      </h2>
      <p style={{ color: theme.textSecondary, fontSize: '0.8125rem', margin: '0 0 1.5rem' }}>
        How is your experience with the dashboard?
      </p>

      {/* Star Rating */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', color: theme.text, marginBottom: '0.5rem' }}>
          Rating <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <div style={{ display: 'flex', gap: '0.25rem' }} role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={rating === star}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem',
                transition: 'transform 0.15s',
                transform: hoveredStar === star ? 'scale(1.2)' : 'scale(1)',
              }}
            >
              <Star
                size={28}
                color="#f59e0b"
                fill={star <= (hoveredStar || rating) ? '#f59e0b' : 'none'}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label
          htmlFor="feedback-category"
          style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', color: theme.text, marginBottom: '0.375rem' }}
        >
          Category
        </label>
        <select
          id="feedback-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            width: '100%',
            padding: '0.625rem 0.75rem',
            backgroundColor: theme.inputBg,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            fontSize: '0.875rem',
            outline: 'none',
          }}
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Comment */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label
          htmlFor="feedback-comment"
          style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', color: theme.text, marginBottom: '0.375rem' }}
        >
          Comments
        </label>
        <textarea
          id="feedback-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us what you think..."
          rows={4}
          maxLength={2000}
          style={{
            width: '100%',
            padding: '0.625rem 0.75rem',
            backgroundColor: theme.inputBg,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            fontSize: '0.875rem',
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ textAlign: 'right', fontSize: '0.6875rem', color: theme.textSecondary, marginTop: '0.25rem' }}>
          {comment.length}/2000
        </div>
      </div>

      {/* Error */}
      {submitState === 'error' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 0.75rem',
            backgroundColor: darkMode ? '#450a0a' : '#fef2f2',
            border: `1px solid ${darkMode ? '#7f1d1d' : '#fecaca'}`,
            borderRadius: '8px',
            marginBottom: '1rem',
          }}
          role="alert"
        >
          <AlertCircle size={16} color="#ef4444" />
          <span style={{ color: '#ef4444', fontSize: '0.8125rem' }}>{errorMessage}</span>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={rating === 0 || submitState === 'submitting'}
        style={{
          width: '100%',
          padding: '0.75rem',
          backgroundColor: rating === 0 ? (darkMode ? '#334155' : '#e2e8f0') : theme.accent,
          color: rating === 0 ? theme.textSecondary : 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: rating === 0 ? 'not-allowed' : 'pointer',
          fontSize: '0.9375rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          opacity: submitState === 'submitting' ? 0.7 : 1,
        }}
      >
        <Send size={16} />
        {submitState === 'submitting' ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </div>
  );
};

export default FeedbackWidget;
