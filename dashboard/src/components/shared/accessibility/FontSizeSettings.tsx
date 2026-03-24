/**
 * Font Size Settings Component
 * 
 * Allows users to adjust font size for accessibility
 * Requirement 69: Adjustable Font Sizes
 */

import { useFontSize, FontSize } from '../../../contexts/FontSizeContext';

const FONT_SIZE_OPTIONS: Array<{ value: FontSize; label: string; description: string }> = [
  { value: 'small', label: 'Small', description: '87.5% (14px)' },
  { value: 'medium', label: 'Medium', description: '100% (16px)' },
  { value: 'large', label: 'Large', description: '112.5% (18px)' },
  { value: 'xlarge', label: 'Extra Large', description: '125% (20px)' }
];

export function FontSizeSettings() {
  const { fontSize, setFontSize } = useFontSize();
  
  return (
    <div className="font-size-settings" role="group" aria-labelledby="font-size-label">
      <label id="font-size-label" className="settings-label">
        Font Size
      </label>
      <p className="settings-description">
        Adjust text size for comfortable reading. All content will scale accordingly.
      </p>
      
      <div className="font-size-options" role="radiogroup" aria-labelledby="font-size-label">
        {FONT_SIZE_OPTIONS.map(option => (
          <label
            key={option.value}
            className={`font-size-option ${fontSize === option.value ? 'selected' : ''}`}
          >
            <input
              type="radio"
              name="font-size"
              value={option.value}
              checked={fontSize === option.value}
              onChange={() => setFontSize(option.value)}
              aria-label={`${option.label} font size: ${option.description}`}
            />
            <span className="option-label">{option.label}</span>
            <span className="option-description">{option.description}</span>
          </label>
        ))}
      </div>
      
      <div className="preview-text" aria-live="polite">
        <p style={{ fontSize: 'calc(1rem * var(--font-size-scale, 1))' }}>
          Preview: This is how text will appear at the selected size.
        </p>
      </div>
      
      <style>{`
        .font-size-settings {
          padding: 1.5rem;
          background: var(--card-bg, #ffffff);
          border-radius: 0.5rem;
          border: 1px solid var(--border-color, #e5e7eb);
        }
        
        .settings-label {
          display: block;
          font-size: calc(1.125rem * var(--font-size-scale, 1));
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--text-primary, #111827);
        }
        
        .settings-description {
          font-size: calc(0.875rem * var(--font-size-scale, 1));
          color: var(--text-secondary, #6b7280);
          margin-bottom: 1rem;
        }
        
        .font-size-options {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }
        
        .font-size-option {
          display: flex;
          align-items: center;
          padding: 0.75rem;
          border: 2px solid var(--border-color, #e5e7eb);
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .font-size-option:hover {
          border-color: var(--primary-color, #7c3aed);
          background: var(--hover-bg, #f3f4f6);
        }
        
        .font-size-option.selected {
          border-color: var(--primary-color, #7c3aed);
          background: var(--selected-bg, #eff6ff);
        }
        
        .font-size-option input[type="radio"] {
          margin-right: 0.75rem;
          width: 1.25rem;
          height: 1.25rem;
          cursor: pointer;
        }
        
        .font-size-option input[type="radio"]:focus {
          outline: 3px solid var(--focus-color, #fbbf24);
          outline-offset: 2px;
        }
        
        .option-label {
          font-weight: 600;
          font-size: calc(1rem * var(--font-size-scale, 1));
          color: var(--text-primary, #111827);
          margin-right: 0.5rem;
        }
        
        .option-description {
          font-size: calc(0.875rem * var(--font-size-scale, 1));
          color: var(--text-secondary, #6b7280);
        }
        
        .preview-text {
          padding: 1rem;
          background: var(--preview-bg, #f9fafb);
          border-radius: 0.375rem;
          border: 1px dashed var(--border-color, #e5e7eb);
        }
        
        .preview-text p {
          margin: 0;
          color: var(--text-primary, #111827);
        }
      `}</style>
    </div>
  );
}
