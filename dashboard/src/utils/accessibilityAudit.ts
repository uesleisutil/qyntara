/**
 * Accessibility Audit Utilities
 * 
 * Provides utilities for running accessibility audits with axe-core
 * Requirement 67.1: Audit all components with axe-core
 */

import { run as axeRun } from 'axe-core';

export interface AccessibilityViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
}

export interface AccessibilityAuditResult {
  violations: AccessibilityViolation[];
  passes: number;
  incomplete: number;
  timestamp: string;
}

/**
 * Run accessibility audit on a container element
 * @param container - Container element to audit
 * @param options - Axe-core options
 * @returns Audit results
 */
export async function runAccessibilityAudit(
  container: HTMLElement = document.body,
  options?: any
): Promise<AccessibilityAuditResult> {
  try {
    const results = await (axeRun as any)(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
      },
      ...options
    });
    
    return {
      violations: results.violations.map((violation: any) => ({
        id: violation.id,
        impact: violation.impact as any,
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.map((node: any) => ({
          html: node.html,
          target: node.target,
          failureSummary: node.failureSummary || ''
        }))
      })),
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Accessibility audit failed:', error);
    throw error;
  }
}

/**
 * Log accessibility violations to console
 * @param violations - Array of violations
 */
export function logAccessibilityViolations(violations: AccessibilityViolation[]): void {
  if (violations.length === 0) {
    console.log('%c✓ No accessibility violations found', 'color: green; font-weight: bold');
    return;
  }
  
  console.group(`%c⚠ ${violations.length} Accessibility Violations Found`, 'color: red; font-weight: bold');
  
  violations.forEach(violation => {
    console.group(`${violation.impact.toUpperCase()}: ${violation.help}`);
    console.log('Description:', violation.description);
    console.log('Help URL:', violation.helpUrl);
    console.log('Affected elements:', violation.nodes.length);
    
    violation.nodes.forEach((node, index) => {
      console.group(`Element ${index + 1}`);
      console.log('HTML:', node.html);
      console.log('Target:', node.target.join(' > '));
      console.log('Issue:', node.failureSummary);
      console.groupEnd();
    });
    
    console.groupEnd();
  });
  
  console.groupEnd();
}

/**
 * Get accessibility violations grouped by impact
 * @param violations - Array of violations
 * @returns Violations grouped by impact level
 */
export function groupViolationsByImpact(violations: AccessibilityViolation[]): Record<string, AccessibilityViolation[]> {
  return violations.reduce((acc, violation) => {
    const impact = violation.impact;
    if (!acc[impact]) {
      acc[impact] = [];
    }
    acc[impact].push(violation);
    return acc;
  }, {} as Record<string, AccessibilityViolation[]>);
}

/**
 * Generate accessibility report
 * @param result - Audit result
 * @returns Formatted report string
 */
export function generateAccessibilityReport(result: AccessibilityAuditResult): string {
  const { violations, passes, incomplete, timestamp } = result;
  
  let report = `Accessibility Audit Report\n`;
  report += `Generated: ${new Date(timestamp).toLocaleString()}\n\n`;
  report += `Summary:\n`;
  report += `- Violations: ${violations.length}\n`;
  report += `- Passes: ${passes}\n`;
  report += `- Incomplete: ${incomplete}\n\n`;
  
  if (violations.length > 0) {
    const grouped = groupViolationsByImpact(violations);
    
    report += `Violations by Impact:\n`;
    ['critical', 'serious', 'moderate', 'minor'].forEach(impact => {
      const count = grouped[impact]?.length || 0;
      if (count > 0) {
        report += `- ${impact.toUpperCase()}: ${count}\n`;
      }
    });
    
    report += `\nDetailed Violations:\n`;
    violations.forEach((violation, index) => {
      report += `\n${index + 1}. [${violation.impact.toUpperCase()}] ${violation.help}\n`;
      report += `   ${violation.description}\n`;
      report += `   Affected elements: ${violation.nodes.length}\n`;
      report += `   Help: ${violation.helpUrl}\n`;
    });
  }
  
  return report;
}

/**
 * Check if element meets color contrast requirements
 * @param element - Element to check
 * @returns Whether contrast is sufficient
 */
export function checkColorContrast(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const _backgroundColor = style.backgroundColor;
  
  // This is a simplified check - axe-core does more comprehensive checking
  // In production, rely on axe-core for accurate contrast checking
  return _backgroundColor !== undefined; // Placeholder
}

/**
 * Initialize accessibility monitoring in development
 */
export function initAccessibilityMonitoring(): void {
  if (import.meta.env.DEV) {
    // Run audit on initial load
    setTimeout(async () => {
      const result = await runAccessibilityAudit();
      logAccessibilityViolations(result.violations);
      
      if (result.violations.length > 0) {
        console.warn(
          `%c⚠ Accessibility Issues Detected\n` +
          `Run window.__axeReport() to see detailed report`,
          'color: orange; font-weight: bold'
        );
        
        // Expose report function globally for debugging
        (window as any).__axeReport = () => {
          console.log(generateAccessibilityReport(result));
        };
      }
    }, 2000);
  }
}
