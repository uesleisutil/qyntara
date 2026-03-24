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

  const positionStyles = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '0.5rem' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '0.5rem' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '0.5rem' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '0.5rem' }
  };

  const arrowStyles = {
    top: { top: '100%', left: '50%', transform: 'translateX(-50%)', borderTop: '4px solid #1a2e26', borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '4px solid transparent' },
    bottom: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', borderBottom: '4px solid #1a2e26', borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid transparent' },
    left: { left: '100%', top: '50%', transform: 'translateY(-50%)', borderLeft: '4px solid #1a2e26', borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderRight: '4px solid transparent' },
    right: { right: '100%', top: '50%', transform: 'translateY(-50%)', borderRight: '4px solid #1a2e26', borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '4px solid transparent' }
  };

  if (!content) return children;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
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
          style={{
            position: 'absolute',
            zIndex: 50,
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            color: 'white',
            backgroundColor: '#1a2e26',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            transition: 'opacity 0.2s',
            ...positionStyles[actualPosition]
          }}
        >
          {content}
          <div
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              ...arrowStyles[actualPosition]
            }}
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
