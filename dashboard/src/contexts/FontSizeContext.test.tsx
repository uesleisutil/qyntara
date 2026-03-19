/**
 * Font Size Context Tests
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { FontSizeProvider, useFontSize } from './FontSizeContext';

// Test component that uses the context
function TestComponent() {
  const { fontSize, setFontSize, fontSizeScale } = useFontSize();
  
  return (
    <div>
      <div data-testid="current-size">{fontSize}</div>
      <div data-testid="current-scale">{fontSizeScale}</div>
      <button onClick={() => setFontSize('small')}>Small</button>
      <button onClick={() => setFontSize('medium')}>Medium</button>
      <button onClick={() => setFontSize('large')}>Large</button>
      <button onClick={() => setFontSize('xlarge')}>Extra Large</button>
    </div>
  );
}

describe('FontSizeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--font-size-scale');
  });
  
  it('should provide default font size of medium', () => {
    render(
      <FontSizeProvider>
        <TestComponent />
      </FontSizeProvider>
    );
    
    expect(screen.getByTestId('current-size')).toHaveTextContent('medium');
    expect(screen.getByTestId('current-scale')).toHaveTextContent('1');
  });
  
  it('should update font size when setFontSize is called', () => {
    render(
      <FontSizeProvider>
        <TestComponent />
      </FontSizeProvider>
    );
    
    act(() => {
      screen.getByText('Large').click();
    });
    
    expect(screen.getByTestId('current-size')).toHaveTextContent('large');
    expect(screen.getByTestId('current-scale')).toHaveTextContent('1.125');
  });
  
  it('should persist font size to localStorage', () => {
    render(
      <FontSizeProvider>
        <TestComponent />
      </FontSizeProvider>
    );
    
    act(() => {
      screen.getByText('Extra Large').click();
    });
    
    expect(localStorage.getItem('dashboard-font-size')).toBe('xlarge');
  });
  
  it('should load font size from localStorage', () => {
    localStorage.setItem('dashboard-font-size', 'small');
    
    render(
      <FontSizeProvider>
        <TestComponent />
      </FontSizeProvider>
    );
    
    expect(screen.getByTestId('current-size')).toHaveTextContent('small');
    expect(screen.getByTestId('current-scale')).toHaveTextContent('0.875');
  });
  
  it('should update CSS custom property', () => {
    render(
      <FontSizeProvider>
        <TestComponent />
      </FontSizeProvider>
    );
    
    act(() => {
      screen.getByText('Large').click();
    });
    
    const scale = document.documentElement.style.getPropertyValue('--font-size-scale');
    expect(scale).toBe('1.125');
  });
  
  it('should provide correct scales for all sizes', () => {
    const { rerender } = render(
      <FontSizeProvider>
        <TestComponent />
      </FontSizeProvider>
    );
    
    const sizes = [
      { button: 'Small', scale: '0.875' },
      { button: 'Medium', scale: '1' },
      { button: 'Large', scale: '1.125' },
      { button: 'Extra Large', scale: '1.25' }
    ];
    
    sizes.forEach(({ button, scale }) => {
      act(() => {
        screen.getByText(button).click();
      });
      
      expect(screen.getByTestId('current-scale')).toHaveTextContent(scale);
    });
  });
  
  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useFontSize must be used within a FontSizeProvider');
    
    consoleSpy.mockRestore();
  });
});
