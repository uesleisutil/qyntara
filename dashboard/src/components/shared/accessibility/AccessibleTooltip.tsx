/**
 * Accessible Tooltip Component
 * 
 * Provides tooltips with full accessibility support
 * Requirement 70: Metric Tooltips
 */

import React, { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { generateA11yId } from '../../../utils/accessibility';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  pinnable?: boolean;
  glossaryLink?: string;
  definition?: string;
  formula?: string;
  interpretation?: string;
  typicalRange?: string;
}

export function AccessibleTooltip({
  content,
  children,
  position = 'top',
  pinnable = false,
  glossaryLink,
  definition,
  formula,
  interpretation,
  typicalRange
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const tooltipId = useRef(generateA11yId('tooltip'));
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);
  
  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        setIsMobile(window.matchMedia('(max-width: 768px)').matches);
      }
    };
    
    checkMobile();
    
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      window.addEventListener('resize', checkMobile);
      
      return () => {
        window.removeEventListener('resize', checkMobile);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, []);
  
  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(true);
  };
  
  const hideTooltip = () => {
    if (isPinned) return;
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 200);
  };
  
  const togglePin = () => {
    setIsPinned(!isPinned);
    if (!isPinned) {
      setIsVisible(true);
    }
  };
  
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && isPinned) {
      setIsPinned(false);
      setIsVisible(false);
    }
  };
  
  // Build comprehensive tooltip content
  const tooltipContent = (
    <div className="tooltip-content">
      {definition && (
        <div className="tooltip-section">
          <strong>Definition:</strong> {definition}
        </div>
      )}
      {formula && (
        <div className="tooltip-section">
          <strong>Formula:</strong> <code>{formula}</code>
        </div>
      )}
      {interpretation && (
        <div className="tooltip-section">
          <strong>Interpretation:</strong> {interpretation}
        </div>
      )}
      {typicalRange && (
        <div className="tooltip-section">
          <strong>Typical Range:</strong> {typicalRange}
        </div>
      )}
      {!definition && !formula && !interpretation && !typicalRange && content}
      {glossaryLink && (
        <div className="tooltip-section">
          <a href={glossaryLink} target="_blank" rel="noopener noreferrer" className="tooltip-link">
            View in Glossary
          </a>
        </div>
      )}
      {pinnable && (
        <button
          onClick={togglePin}
          className="tooltip-pin-button"
          aria-label={isPinned ? 'Unpin tooltip' : 'Pin tooltip'}
        >
          {isPinned ? '📌 Pinned' : '📍 Pin'}
        </button>
      )}
    </div>
  );
  
  return (
    <div
      className="tooltip-wrapper"
      onMouseEnter={!isMobile ? showTooltip : undefined}
      onMouseLeave={!isMobile ? hideTooltip : undefined}
      onClick={isMobile ? showTooltip : undefined}
      onKeyDown={handleKeyDown}
    >
      <div
        aria-describedby={isVisible ? tooltipId.current : undefined}
        className="tooltip-trigger"
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          id={tooltipId.current}
          role="tooltip"
          className={`tooltip tooltip-${position} ${isPinned ? 'tooltip-pinned' : ''}`}
          aria-hidden={!isVisible}
        >
          {tooltipContent}
        </div>
      )}
      
      <style>{`
        .tooltip-wrapper {
          position: relative;
          display: inline-block;
        }
        
        .tooltip {
          position: absolute;
          z-index: 1000;
          background: var(--tooltip-bg, #1a1a1a);
          color: var(--tooltip-text, #ffffff);
          padding: 0.75rem;
          border-radius: 0.375rem;
          font-size: calc(0.875rem * var(--font-size-scale, 1));
          max-width: 300px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          pointer-events: auto;
        }
        
        .tooltip-pinned {
          pointer-events: auto;
        }
        
        .tooltip-top {
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 0.5rem;
        }
        
        .tooltip-bottom {
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 0.5rem;
        }
        
        .tooltip-left {
          right: 100%;
          top: 50%;
          transform: translateY(-50%);
          margin-right: 0.5rem;
        }
        
        .tooltip-right {
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          margin-left: 0.5rem;
        }
        
        .tooltip-section {
          margin-bottom: 0.5rem;
        }
        
        .tooltip-section:last-child {
          margin-bottom: 0;
        }
        
        .tooltip-section strong {
          display: block;
          margin-bottom: 0.25rem;
          font-weight: 600;
        }
        
        .tooltip-section code {
          background: rgba(255, 255, 255, 0.1);
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-family: monospace;
          font-size: 0.875em;
        }
        
        .tooltip-link {
          color: var(--tooltip-link, #60a5fa);
          text-decoration: underline;
        }
        
        .tooltip-link:hover {
          color: var(--tooltip-link-hover, #93c5fd);
        }
        
        .tooltip-pin-button {
          margin-top: 0.5rem;
          padding: 0.25rem 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.25rem;
          color: inherit;
          font-size: 0.75rem;
          cursor: pointer;
          width: 100%;
        }
        
        .tooltip-pin-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
      `}</style>
    </div>
  );
}

/**
 * Hook to manage tooltip visibility
 * @returns State and handlers for tooltip
 */
export function useTooltip() {
  const [isVisible, setIsVisible] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);
  
  const show = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(true);
  }, []);
  
  const hide = useCallback(() => {
    if (isPinned) return;
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 200);
  }, [isPinned]);
  
  const togglePin = useCallback(() => {
    setIsPinned(prev => !prev);
    if (!isPinned) {
      setIsVisible(true);
    }
  }, [isPinned]);
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return {
    isVisible,
    isPinned,
    show,
    hide,
    togglePin
  };
}
