import { Component } from 'react';
import PropTypes from 'prop-types';

/**
 * ErrorBoundary - React error boundary for graceful error handling
 * 
 * Features:
 * - Catches JavaScript errors in child components
 * - Displays fallback UI
 * - Logs error details
 * - Optional retry functionality
 * - Custom fallback component support
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          resetError: this.handleReset
        });
      }

      // Default fallback UI
      return (
        <div style={{
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            maxWidth: '28rem',
            width: '100%',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            padding: '1.5rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem'
            }}>
              <div style={{ flexShrink: 0 }}>
                <svg
                  style={{ width: '1.5rem', height: '1.5rem', color: '#dc2626' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: '#7f1d1d',
                  marginBottom: '0.5rem'
                }}>
                  {this.props.title || 'Algo deu errado'}
                </h3>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#991b1b',
                  marginBottom: '1rem'
                }}>
                  {this.props.message || 'Ocorreu um erro inesperado. Por favor, tente novamente.'}
                </p>
                
                {this.props.showDetails && this.state.error && (
                  <details style={{ marginBottom: '1rem' }}>
                    <summary style={{
                      fontSize: '0.875rem',
                      color: '#991b1b',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}>
                      Detalhes do erro
                    </summary>
                    <pre style={{
                      marginTop: '0.5rem',
                      fontSize: '0.75rem',
                      color: '#991b1b',
                      backgroundColor: '#fee2e2',
                      padding: '0.75rem',
                      borderRadius: '0.25rem',
                      overflow: 'auto',
                      maxHeight: '10rem'
                    }}>
                      {this.state.error.toString()}
                      {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}

                {this.props.showReset && (
                  <button
                    onClick={this.handleReset}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      borderRadius: '0.5rem',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '0.875rem'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#b91c1c'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#dc2626'}
                  >
                    Tentar Novamente
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.func,
  onError: PropTypes.func,
  onReset: PropTypes.func,
  title: PropTypes.string,
  message: PropTypes.string,
  showDetails: PropTypes.bool,
  showReset: PropTypes.bool
};

ErrorBoundary.defaultProps = {
  showDetails: false,
  showReset: true
};

export default ErrorBoundary;
