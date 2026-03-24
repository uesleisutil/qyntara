/**
 * Notification Preferences Component
 * 
 * UI for configuring email and SMS notification preferences.
 * Implements Requirements 46.1-46.10 (Email and SMS Integration)
 */

import React, { useState } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { NotificationCategory } from '../../types/notifications';

interface NotificationPreferencesProps {
  onClose?: () => void;
}

const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ onClose }) => {
  const { preferences, updatePreferences } = useNotifications();
  
  const [email, setEmail] = useState(preferences.email || '');
  const [phone, setPhone] = useState(preferences.phone || '');
  const [emailTypes, setEmailTypes] = useState<NotificationCategory[]>(preferences.emailTypes);
  const [smsTypes, setSmsTypes] = useState<NotificationCategory[]>(preferences.smsTypes);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(preferences.quietHours.enabled);
  const [quietStart, setQuietStart] = useState(preferences.quietHours.start);
  const [quietEnd, setQuietEnd] = useState(preferences.quietHours.end);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const categories: { value: NotificationCategory; label: string; description: string }[] = [
    { value: 'drift', label: 'Data Drift', description: 'Feature distribution changes detected' },
    { value: 'anomaly', label: 'Data Anomalies', description: 'Data quality issues and outliers' },
    { value: 'cost', label: 'Cost Alerts', description: 'Budget warnings and cost spikes' },
    { value: 'degradation', label: 'Performance Degradation', description: 'Model performance decline' },
    { value: 'system', label: 'System Health', description: 'Infrastructure and availability issues' },
  ];

  const handleEmailTypeToggle = (category: NotificationCategory) => {
    setEmailTypes((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleSmsTypeToggle = (category: NotificationCategory) => {
    setSmsTypes((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    
    try {
      await updatePreferences({
        email: email || undefined,
        phone: phone || undefined,
        emailTypes,
        smsTypes,
        quietHours: {
          enabled: quietHoursEnabled,
          start: quietStart,
          end: quietEnd,
        },
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to save preferences:', err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '48rem',
        margin: '0 auto',
        padding: '1.5rem',
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        border: '1px solid #d4e5dc',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>
          Notification Preferences
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              padding: '0.5rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '0.25rem',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="15" y1="5" x2="5" y2="15" />
              <line x1="5" y1="5" x2="15" y2="15" />
            </svg>
          </button>
        )}
      </div>

      {/* Email Configuration (Req 46.2) */}
      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
          Email Notifications
        </h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="email"
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              marginBottom: '0.5rem',
              color: '#2a4038',
            }}
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@example.com"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              border: '1px solid #bdd4c8',
              borderRadius: '0.375rem',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#5a9e87';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#bdd4c8';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Email Alert Types (Req 46.4) */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              marginBottom: '0.5rem',
              color: '#2a4038',
            }}
          >
            Send email for these alert types:
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {categories.map((category) => (
              <label
                key={category.value}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  border: '1px solid #d4e5dc',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f6faf8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <input
                  type="checkbox"
                  checked={emailTypes.includes(category.value)}
                  onChange={() => handleEmailTypeToggle(category.value)}
                  style={{
                    marginTop: '0.125rem',
                    width: '1rem',
                    height: '1rem',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>
                    {category.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#5a7268', marginTop: '0.125rem' }}>
                    {category.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* SMS Configuration (Req 46.3) */}
      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
          SMS Notifications
        </h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="phone"
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              marginBottom: '0.5rem',
              color: '#2a4038',
            }}
          >
            Phone Number
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 123-4567"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              border: '1px solid #bdd4c8',
              borderRadius: '0.375rem',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#5a9e87';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#bdd4c8';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <p style={{ fontSize: '0.75rem', color: '#5a7268', marginTop: '0.25rem' }}>
            SMS notifications are limited to critical alerts only (Req 46.8)
          </p>
        </div>

        {/* SMS Alert Types (Req 46.5) */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              marginBottom: '0.5rem',
              color: '#2a4038',
            }}
          >
            Send SMS for these critical alert types:
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {categories.map((category) => (
              <label
                key={category.value}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  border: '1px solid #d4e5dc',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f6faf8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <input
                  type="checkbox"
                  checked={smsTypes.includes(category.value)}
                  onChange={() => handleSmsTypeToggle(category.value)}
                  style={{
                    marginTop: '0.125rem',
                    width: '1rem',
                    height: '1rem',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>
                    {category.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#5a7268', marginTop: '0.125rem' }}>
                    {category.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* Quiet Hours (Req 46.9) */}
      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
          Quiet Hours
        </h3>
        
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={quietHoursEnabled}
            onChange={(e) => setQuietHoursEnabled(e.target.checked)}
            style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
            Enable quiet hours (non-critical notifications will be suppressed)
          </span>
        </label>

        {quietHoursEnabled && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="quietStart"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: '#2a4038',
                }}
              >
                Start Time
              </label>
              <input
                id="quietStart"
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  border: '1px solid #bdd4c8',
                  borderRadius: '0.375rem',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="quietEnd"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: '#2a4038',
                }}
              >
                End Time
              </label>
              <input
                id="quietEnd"
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  border: '1px solid #bdd4c8',
                  borderRadius: '0.375rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Save Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '0.625rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: 'white',
            backgroundColor: saving ? '#8fa89c' : '#5a9e87',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!saving) {
              e.currentTarget.style.backgroundColor = '#4a8e77';
            }
          }}
          onMouseLeave={(e) => {
            if (!saving) {
              e.currentTarget.style.backgroundColor = '#5a9e87';
            }
          }}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>

        {/* Save Status (Req 46.10) */}
        {saveStatus === 'success' && (
          <span style={{ fontSize: '0.875rem', color: '#4ead8a' }}>
            ✓ Preferences saved successfully
          </span>
        )}
        {saveStatus === 'error' && (
          <span style={{ fontSize: '0.875rem', color: '#e07070' }}>
            ✗ Failed to save preferences
          </span>
        )}
      </div>
    </div>
  );
};

export default NotificationPreferences;
