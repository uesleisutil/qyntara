import React from 'react';
import { AlertTriangle, XCircle, Wifi, Lock, FileWarning, Settings, X } from 'lucide-react';

/**
 * ErrorBanner component displays prominent error messages with appropriate icons
 * and allows users to dismiss the error.
 * 
 * @param {Object} props
 * @param {string} props.error - The error message or error object
 * @param {string} props.errorType - Type of error: 'network', 'auth', 'parsing', 'config', or 'general'
 * @param {Function} props.onDismiss - Callback function when error is dismissed
 */
const ErrorBanner = ({ error, errorType = 'general', onDismiss }) => {
  if (!error) return null;

  // Determine icon based on error type
  const getIcon = () => {
    switch (errorType) {
      case 'network':
        return <Wifi size={20} />;
      case 'auth':
        return <Lock size={20} />;
      case 'parsing':
        return <FileWarning size={20} />;
      case 'config':
        return <Settings size={20} />;
      default:
        return <AlertTriangle size={20} />;
    }
  };

  // Get error message string
  const errorMessage = typeof error === 'string' ? error : error.message || 'An error occurred';

  return (
    <div className="error-banner" role="alert">
      <div className="error-banner-content">
        <div className="error-banner-icon">
          {getIcon()}
        </div>
        <div className="error-banner-message">
          {errorMessage}
        </div>
        {onDismiss && (
          <button 
            className="error-banner-dismiss"
            onClick={onDismiss}
            aria-label="Dismiss error"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorBanner;
