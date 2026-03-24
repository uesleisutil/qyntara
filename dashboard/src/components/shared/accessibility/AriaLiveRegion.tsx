/**
 * ARIA Live Region Component
 * 
 * Announces dynamic content updates to screen readers
 * Requirement 68.3: ARIA live regions for dynamic updates
 */

import React, { useEffect, useRef } from 'react';

interface AriaLiveRegionProps {
  message: string;
  priority?: 'polite' | 'assertive';
  clearAfter?: number;
}

export function AriaLiveRegion({ 
  message, 
  priority = 'polite',
  clearAfter = 5000 
}: AriaLiveRegionProps) {
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);
  const [currentMessage, setCurrentMessage] = React.useState(message);
  
  useEffect(() => {
    setCurrentMessage(message);
    
    if (clearAfter > 0) {
      timeoutRef.current = setTimeout(() => {
        setCurrentMessage('');
      }, clearAfter);
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [message, clearAfter]);
  
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {currentMessage}
    </div>
  );
}

/**
 * Global ARIA Live Region Manager
 * Provides a centralized way to announce messages
 */
interface LiveRegionManagerProps {
  children: React.ReactNode;
}

export function LiveRegionManager({ children }: LiveRegionManagerProps) {
  const [politeMessage, setPoliteMessage] = React.useState('');
  const [assertiveMessage, setAssertiveMessage] = React.useState('');
  
  // Expose announce function globally
  useEffect(() => {
    (window as any).__announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      if (priority === 'assertive') {
        setAssertiveMessage(message);
      } else {
        setPoliteMessage(message);
      }
    };
    
    return () => {
      delete (window as any).__announce;
    };
  }, []);
  
  return (
    <>
      {children}
      <AriaLiveRegion message={politeMessage} priority="polite" />
      <AriaLiveRegion message={assertiveMessage} priority="assertive" />
    </>
  );
}
