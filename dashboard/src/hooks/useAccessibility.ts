/**
 * Accessibility Hooks
 * 
 * Custom hooks for managing accessibility features
 */

import { useEffect, useRef, useCallback } from 'react';
import { announceToScreenReader, trapFocus, getFocusableElements } from '../utils/accessibility';

/**
 * Hook to manage focus trap for modals
 * @param isOpen - Whether the modal is open
 * @returns Ref to attach to the modal container
 */
export function useFocusTrap<T extends HTMLElement>(isOpen: boolean) {
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    
    // Store the element that had focus before modal opened
    previousFocusRef.current = document.activeElement as HTMLElement;
    
    // Focus the first focusable element in the modal
    const focusableElements = getFocusableElements(containerRef.current);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
    
    // Handle Tab key to trap focus
    const handleKeyDown = (event: KeyboardEvent) => {
      if (containerRef.current) {
        trapFocus(containerRef.current, event);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      
      // Restore focus to the element that had it before modal opened
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);
  
  return containerRef;
}

/**
 * Hook to announce messages to screen readers
 * @returns Function to announce messages
 */
export function useScreenReaderAnnouncement() {
  return useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announceToScreenReader(message, priority);
  }, []);
}

/**
 * Hook to manage keyboard navigation
 * @param onEscape - Callback when Escape key is pressed
 * @param onEnter - Callback when Enter key is pressed
 */
export function useKeyboardNavigation(
  onEscape?: () => void,
  onEnter?: () => void
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscape) {
        onEscape();
      } else if (event.key === 'Enter' && onEnter) {
        onEnter();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onEscape, onEnter]);
}

/**
 * Hook to manage skip links
 * @param targetId - ID of the element to skip to
 * @returns Function to handle skip link click
 */
export function useSkipLink(targetId: string) {
  return useCallback(() => {
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [targetId]);
}

/**
 * Hook to manage ARIA live region announcements
 * @returns Ref to attach to live region and function to update announcement
 */
export function useAriaLiveRegion() {
  const liveRegionRef = useRef<HTMLDivElement>(null);
  
  const announce = useCallback((message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
    }
  }, []);
  
  return { liveRegionRef, announce };
}

/**
 * Hook to ensure element has accessible name
 * @param label - Accessible label
 * @param description - Optional description
 * @returns Props to spread on element
 */
export function useAccessibleLabel(label: string, description?: string) {
  const descId = useRef(`desc-${Math.random().toString(36).substr(2, 9)}`);
  
  return {
    'aria-label': label,
    'aria-describedby': description ? descId.current : undefined,
    role: 'region'
  };
}
