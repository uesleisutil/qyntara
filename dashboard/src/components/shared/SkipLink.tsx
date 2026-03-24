/**
 * Skip Link Component
 * 
 * Provides skip navigation links for keyboard users
 * Requirement 67.11: Skip navigation links
 */

import React from 'react';

interface SkipLinkProps {
  targetId: string;
  label: string;
}

export function SkipLink({ targetId, label }: SkipLinkProps) {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  
  return (
    <a
      href={`#${targetId}`}
      className="skip-link"
      onClick={handleClick}
    >
      {label}
      <style>{`
        .skip-link {
          position: absolute;
          top: -40px;
          left: 0;
          background: var(--primary-color, #4a8e77);
          color: white;
          padding: 0.5rem 1rem;
          text-decoration: none;
          border-radius: 0 0 0.25rem 0;
          font-weight: 600;
          z-index: 10000;
          transition: top 0.2s;
        }
        
        .skip-link:focus {
          top: 0;
          outline: 3px solid var(--focus-color, #e0b85c);
          outline-offset: 2px;
        }
      `}</style>
    </a>
  );
}

interface SkipLinksProps {
  links: Array<{ targetId: string; label: string }>;
}

export function SkipLinks({ links }: SkipLinksProps) {
  return (
    <nav aria-label="Skip links" style={{ position: 'relative' }}>
      {links.map(link => (
        <SkipLink key={link.targetId} targetId={link.targetId} label={link.label} />
      ))}
    </nav>
  );
}
