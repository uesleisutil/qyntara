import PropTypes from 'prop-types';

/**
 * LoadingSpinner - Animated loading spinner
 * 
 * Features:
 * - Multiple sizes (sm, md, lg)
 * - Optional loading text
 * - Smooth CSS animations
 * - Centered or inline display
 */
const LoadingSpinner = ({ 
  size = 'md', 
  text = '', 
  centered = false,
  fullScreen = false 
}) => {
  const sizes = {
    sm: { width: '16px', height: '16px', borderWidth: '2px' },
    md: { width: '32px', height: '32px', borderWidth: '3px' },
    lg: { width: '48px', height: '48px', borderWidth: '4px' }
  };

  const textSizes = {
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem'
  };

  const spinnerStyle = {
    ...sizes[size],
    border: `${sizes[size].borderWidth} solid #8b5cf6`,
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    display: 'inline-block'
  };

  const containerStyle = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    ...(centered && { justifyContent: 'center' })
  };

  const textStyle = {
    fontSize: textSizes[size],
    color: '#64748b',
    fontWeight: '500',
    margin: 0
  };

  const spinner = (
    <div style={containerStyle}>
      <div
        style={spinnerStyle}
        role="status"
        aria-label="Loading"
      />
      {text && (
        <p style={textStyle}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50
      }}>
        {spinner}
      </div>
    );
  }

  if (centered) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: '200px'
      }}>
        {spinner}
      </div>
    );
  }

  return spinner;
};

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  text: PropTypes.string,
  centered: PropTypes.bool,
  fullScreen: PropTypes.bool
};

export default LoadingSpinner;
