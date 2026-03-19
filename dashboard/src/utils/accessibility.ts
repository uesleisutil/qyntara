/**
 * Accessibility Utilities
 * 
 * Provides utility functions for ensuring WCAG 2.1 Level AA compliance
 */

/**
 * Calculate contrast ratio between two colors
 * @param foreground - Foreground color in hex format
 * @param background - Background color in hex format
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(foreground: string, background: string): number {
  const getLuminance = (color: string): number => {
    // Remove # if present
    const hex = color.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    // Apply gamma correction
    const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
    
    // Calculate relative luminance
    return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
  };
  
  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG AA standards
 * @param ratio - Contrast ratio
 * @param isLargeText - Whether the text is large (18pt+ or 14pt+ bold)
 * @returns Whether the contrast meets WCAG AA standards
 */
export function meetsWCAGAA(ratio: number, isLargeText: boolean = false): boolean {
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Generate ARIA label for chart
 * @param chartType - Type of chart
 * @param dataDescription - Description of the data
 * @returns ARIA label string
 */
export function generateChartAriaLabel(chartType: string, dataDescription: string): string {
  return `${chartType} showing ${dataDescription}`;
}

/**
 * Announce message to screen readers
 * @param message - Message to announce
 * @param priority - Priority level (polite or assertive)
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Get keyboard-focusable elements within a container
 * @param container - Container element
 * @returns Array of focusable elements
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  
  return Array.from(container.querySelectorAll(selector));
}

/**
 * Trap focus within a container (for modals)
 * @param container - Container element
 * @param event - Keyboard event
 */
export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  
  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  if (event.shiftKey) {
    // Shift + Tab
    if (document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    }
  } else {
    // Tab
    if (document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }
}

/**
 * Generate unique ID for accessibility attributes
 * @param prefix - Prefix for the ID
 * @returns Unique ID
 */
let idCounter = 0;
export function generateA11yId(prefix: string = 'a11y'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Format number for screen readers
 * @param value - Number to format
 * @param unit - Optional unit (e.g., 'percent', 'currency')
 * @returns Formatted string
 */
export function formatForScreenReader(value: number, unit?: string): string {
  const formatted = value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  
  if (unit === 'percent') {
    return `${formatted} percent`;
  } else if (unit === 'currency') {
    return `${formatted} dollars`;
  }
  
  return formatted;
}

/**
 * Get text description of chart trend
 * @param data - Array of data points
 * @returns Text description
 */
export function getChartTrendDescription(data: number[]): string {
  if (data.length < 2) return 'insufficient data';
  
  const first = data[0];
  const last = data[data.length - 1];
  const change = ((last - first) / first) * 100;
  
  if (Math.abs(change) < 1) {
    return 'relatively stable';
  } else if (change > 0) {
    return `increasing by ${change.toFixed(1)} percent`;
  } else {
    return `decreasing by ${Math.abs(change).toFixed(1)} percent`;
  }
}
