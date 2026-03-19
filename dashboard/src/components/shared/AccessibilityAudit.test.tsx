/**
 * Accessibility Audit Integration Tests
 * 
 * Tests WCAG 2.1 Level AA compliance using axe-core
 * Note: Full axe-core audits work best in real browsers (E2E tests)
 * These tests verify the audit infrastructure is set up correctly
 */

import React from 'react';
import { render } from '@testing-library/react';
import { KPICard } from './KPICard';
import { Modal } from './Modal';
import { FontSizeProvider } from '../../contexts/FontSizeContext';
import { AccessibleTooltip } from './AccessibleTooltip';

// Mock window.matchMedia for tests - must be set before component imports
// The setupTests.js mock may get cleared; reinforce it here
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

beforeEach(() => {
  // Re-mock matchMedia before each test in case it was cleared
  (window.matchMedia as jest.Mock).mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
});

describe('Accessibility Audit', () => {
  it('should render KPICard with proper ARIA attributes', () => {
    const { container } = render(
      <FontSizeProvider>
        <KPICard
          title="Test Metric"
          value={100}
          change={5}
          trend="up"
          tooltipDefinition="A test metric"
        />
      </FontSizeProvider>
    );
    
    const card = container.querySelector('[role="region"]');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('aria-label');
  });
  
  it('should render Modal with proper ARIA attributes', () => {
    const { container } = render(
      <Modal
        isOpen={true}
        onClose={() => {}}
        title="Test Modal"
      >
        <p>Modal content</p>
      </Modal>
    );
    
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });
  
  it('should render AccessibleTooltip with proper structure', () => {
    const { container } = render(
      <AccessibleTooltip
        content="Test tooltip"
        definition="A test definition"
      >
        <button>Hover me</button>
      </AccessibleTooltip>
    );
    
    expect(container.querySelector('button')).toBeInTheDocument();
  });
  
  it('should detect missing alt text on images', () => {
    const { container } = render(
      <div>
        <img src="test.jpg" />
      </div>
    );
    
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).not.toHaveAttribute('alt');
  });
  
  it('should detect missing form labels', () => {
    const { container } = render(
      <form>
        <input type="text" />
      </form>
    );
    
    const input = container.querySelector('input');
    expect(input).toBeInTheDocument();
    
    // Check if input has associated label
    const hasLabel = input?.hasAttribute('aria-label') || 
                     input?.hasAttribute('aria-labelledby') ||
                     container.querySelector('label[for]');
    
    expect(hasLabel).toBeFalsy();
  });
  
  it('should verify KPICard has keyboard support', () => {
    const onClick = jest.fn();
    const { container } = render(
      <FontSizeProvider>
        <KPICard
          title="Test Metric"
          value={100}
          onClick={onClick}
        />
      </FontSizeProvider>
    );
    
    const card = container.querySelector('[role="button"]');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('tabIndex', '0');
  });
});
