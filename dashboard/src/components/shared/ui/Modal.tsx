import React, { useEffect, useRef } from 'react';
import { useFocusTrap, useScreenReaderAnnouncement } from '../../../hooks/useAccessibility';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  ariaDescribedBy?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  ariaDescribedBy,
}) => {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
  const announce = useScreenReaderAnnouncement();
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Store the element that had focus before modal opened
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      // Announce modal opening to screen readers
      announce(`${title} dialog opened`, 'assertive');
    } else {
      // Restore body scroll
      document.body.style.overflow = '';
      
      // Restore focus to previous element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, title, announce]);

  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
        announce('Dialog closed', 'polite');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape, announce]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={closeOnOverlayClick ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={ariaDescribedBy}
    >
      <div
        ref={modalRef}
        className={`modal-content modal-${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">
            {title}
          </h2>
          <button
            onClick={() => {
              onClose();
              announce('Dialog closed', 'polite');
            }}
            className="modal-close"
            aria-label="Close modal"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        
        <div className="modal-body">{children}</div>
        
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};
