import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Simple Card wrapper for validation components
 * Provides consistent styling without complex props
 */
export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}
      style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #d4e5dc',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      }}
    >
      {children}
    </div>
  );
};

export default Card;
