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
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const spinner = (
    <div className={`inline-flex flex-col items-center gap-3 ${centered ? 'justify-center' : ''}`}>
      <div
        className={`${sizeClasses[size]} border-blue-600 border-t-transparent rounded-full animate-spin`}
        role="status"
        aria-label="Loading"
      />
      {text && (
        <p className={`${textSizeClasses[size]} text-gray-600 font-medium`}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  if (centered) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[200px]">
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
