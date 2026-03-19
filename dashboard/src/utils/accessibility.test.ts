/**
 * Accessibility Utilities Tests
 */

import {
  getContrastRatio,
  meetsWCAGAA,
  generateChartAriaLabel,
  announceToScreenReader,
  getFocusableElements,
  formatForScreenReader,
  getChartTrendDescription
} from './accessibility';

describe('Accessibility Utilities', () => {
  describe('getContrastRatio', () => {
    it('should calculate correct contrast ratio for black on white', () => {
      const ratio = getContrastRatio('#000000', '#ffffff');
      expect(ratio).toBeCloseTo(21, 0);
    });
    
    it('should calculate correct contrast ratio for white on black', () => {
      const ratio = getContrastRatio('#ffffff', '#000000');
      expect(ratio).toBeCloseTo(21, 0);
    });
    
    it('should calculate correct contrast ratio for same colors', () => {
      const ratio = getContrastRatio('#ffffff', '#ffffff');
      expect(ratio).toBeCloseTo(1, 0);
    });
    
    it('should handle colors without # prefix', () => {
      const ratio = getContrastRatio('000000', 'ffffff');
      expect(ratio).toBeCloseTo(21, 0);
    });
  });
  
  describe('meetsWCAGAA', () => {
    it('should return true for normal text with 4.5:1 ratio', () => {
      expect(meetsWCAGAA(4.5, false)).toBe(true);
    });
    
    it('should return false for normal text with 4.4:1 ratio', () => {
      expect(meetsWCAGAA(4.4, false)).toBe(false);
    });
    
    it('should return true for large text with 3:1 ratio', () => {
      expect(meetsWCAGAA(3, true)).toBe(true);
    });
    
    it('should return false for large text with 2.9:1 ratio', () => {
      expect(meetsWCAGAA(2.9, true)).toBe(false);
    });
  });
  
  describe('generateChartAriaLabel', () => {
    it('should generate proper aria label for line chart', () => {
      const label = generateChartAriaLabel('line chart', 'stock prices over time');
      expect(label).toBe('line chart showing stock prices over time');
    });
    
    it('should generate proper aria label for bar chart', () => {
      const label = generateChartAriaLabel('bar chart', 'model performance comparison');
      expect(label).toBe('bar chart showing model performance comparison');
    });
  });
  
  describe('announceToScreenReader', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });
    
    afterEach(() => {
      // Clean up any remaining announcements
      const announcements = document.querySelectorAll('[role="status"]');
      announcements.forEach(el => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    });
    
    it('should create announcement element', () => {
      announceToScreenReader('Test message');
      const announcement = document.querySelector('[role="status"]');
      expect(announcement).toBeTruthy();
      expect(announcement?.textContent).toBe('Test message');
    });
    
    it('should use polite priority by default', () => {
      announceToScreenReader('Test message');
      const announcement = document.querySelector('[role="status"]');
      expect(announcement?.getAttribute('aria-live')).toBe('polite');
    });
    
    it('should use assertive priority when specified', () => {
      announceToScreenReader('Urgent message', 'assertive');
      const announcement = document.querySelector('[role="status"]');
      expect(announcement?.getAttribute('aria-live')).toBe('assertive');
    });
  });
  
  describe('getFocusableElements', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });
    
    it('should find all focusable elements', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button>Button</button>
        <a href="#">Link</a>
        <input type="text" />
        <select></select>
        <textarea></textarea>
        <div tabindex="0">Focusable div</div>
      `;
      document.body.appendChild(container);
      
      const focusable = getFocusableElements(container);
      expect(focusable).toHaveLength(6);
    });
    
    it('should exclude disabled elements', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button>Enabled</button>
        <button disabled>Disabled</button>
        <input type="text" />
        <input type="text" disabled />
      `;
      document.body.appendChild(container);
      
      const focusable = getFocusableElements(container);
      expect(focusable).toHaveLength(2);
    });
    
    it('should exclude elements with tabindex="-1"', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div tabindex="0">Focusable</div>
        <div tabindex="-1">Not focusable</div>
      `;
      document.body.appendChild(container);
      
      const focusable = getFocusableElements(container);
      expect(focusable).toHaveLength(1);
    });
  });
  
  describe('formatForScreenReader', () => {
    it('should format numbers with locale', () => {
      const formatted = formatForScreenReader(1234.56);
      expect(formatted).toBe('1,234.56');
    });
    
    it('should format percentages', () => {
      const formatted = formatForScreenReader(45.5, 'percent');
      expect(formatted).toBe('45.5 percent');
    });
    
    it('should format currency', () => {
      const formatted = formatForScreenReader(1234.56, 'currency');
      expect(formatted).toBe('1,234.56 dollars');
    });
    
    it('should limit decimal places', () => {
      const formatted = formatForScreenReader(1.23456789);
      expect(formatted).toBe('1.23');
    });
  });
  
  describe('getChartTrendDescription', () => {
    it('should describe increasing trend', () => {
      const data = [100, 110, 120, 130];
      const description = getChartTrendDescription(data);
      expect(description).toContain('increasing');
      expect(description).toContain('30.0 percent');
    });
    
    it('should describe decreasing trend', () => {
      const data = [100, 90, 80, 70];
      const description = getChartTrendDescription(data);
      expect(description).toContain('decreasing');
      expect(description).toContain('30.0 percent');
    });
    
    it('should describe stable trend', () => {
      const data = [100, 100.5, 99.5, 100];
      const description = getChartTrendDescription(data);
      expect(description).toBe('relatively stable');
    });
    
    it('should handle insufficient data', () => {
      const data = [100];
      const description = getChartTrendDescription(data);
      expect(description).toBe('insufficient data');
    });
    
    it('should handle empty data', () => {
      const data: number[] = [];
      const description = getChartTrendDescription(data);
      expect(description).toBe('insufficient data');
    });
  });
});
