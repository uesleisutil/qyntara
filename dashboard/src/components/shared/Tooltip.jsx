import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Tooltip - Reusable tooltip component
 * 
 * Features:
 * - Multiple positions (top, bottom, left, right)
 * - Auto-positioning to stay in viewport
 * - Hover and focus triggers
 * - Smooth animations
 * - Accessible (ARIA attributes)
 */
const Tooltip = ({ 
  children, 
  content, 
  position = 'top',
  delay = 200,
  disabled = false 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const timeoutRef = useRef(null);
  const tooltipRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showTooltip = () => {
    if (disabled) return;
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      adjustPosition();
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const adjustPosition = () => {
    if (!tooltipRef.current || !triggerRef.current) return;

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newPosition = position;

    // Check if tooltip goes out of viewport and adjust
    if (position === 'top' && tooltipRect.top < 0) {
      newPosition = 'bottom';
    } else if (position === 'bottom' && tooltipRect.bottom > viewportHeight) {
      newPosition = 'top';
    } else if (position === 'left' && tooltipRect.left < 0) {
      newPosition = 'right';
    } else if (position === 'right' && tooltipRect.right > viewportWidth) {
      newPosition = 'left';
    }

    setActualPosition(newPosition);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 border-t-transparent border-b-transparent border-l-transparent'
  };

  if (!content) return children;

  return (
    <div className="relative inline-block">
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        aria-describedby={isVisible ? 'tooltip' : undefined}
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          id="tooltip"
          role="tooltip"
          className={`absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap pointer-events-none transition-opacity duration-200 ${positionClasses[actualPosition]}`}
        >
          {content}
          <div
            className={`absolute w-0 h-0 border-4 ${arrowClasses[actualPosition]}`}
          />
        </div>
      )}
    </div>
  );
};

Tooltip.propTypes = {
  children: PropTypes.node.isRequired,
  content: PropTypes.node,
  position: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  delay: PropTypes.number,
  disabled: PropTypes.bool
};

export default Tooltip;
