import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBanner from './ErrorBanner';

describe('ErrorBanner', () => {
  it('should not render when error is null', () => {
    const { container } = render(<ErrorBanner error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render error message', () => {
    render(<ErrorBanner error="Test error message" />);
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('should render with network error type icon', () => {
    const { container } = render(
      <ErrorBanner error="Network error" errorType="network" />
    );
    expect(container.querySelector('.error-banner')).toBeInTheDocument();
  });

  it('should render with auth error type icon', () => {
    const { container } = render(
      <ErrorBanner error="Auth error" errorType="auth" />
    );
    expect(container.querySelector('.error-banner')).toBeInTheDocument();
  });

  it('should render with parsing error type icon', () => {
    const { container } = render(
      <ErrorBanner error="Parsing error" errorType="parsing" />
    );
    expect(container.querySelector('.error-banner')).toBeInTheDocument();
  });

  it('should render with config error type icon', () => {
    const { container } = render(
      <ErrorBanner error="Config error" errorType="config" />
    );
    expect(container.querySelector('.error-banner')).toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button is clicked', () => {
    const onDismiss = jest.fn();
    render(
      <ErrorBanner 
        error="Test error" 
        onDismiss={onDismiss}
      />
    );
    
    const dismissButton = screen.getByLabelText('Dismiss error');
    fireEvent.click(dismissButton);
    
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should not render dismiss button when onDismiss is not provided', () => {
    render(<ErrorBanner error="Test error" />);
    expect(screen.queryByLabelText('Dismiss error')).not.toBeInTheDocument();
  });

  it('should handle error object with message property', () => {
    const errorObj = { message: 'Error object message' };
    render(<ErrorBanner error={errorObj} />);
    expect(screen.getByText('Error object message')).toBeInTheDocument();
  });

  it('should display default message for error object without message', () => {
    const errorObj = { code: 'ERR_001' };
    render(<ErrorBanner error={errorObj} />);
    expect(screen.getByText('An error occurred')).toBeInTheDocument();
  });
});
