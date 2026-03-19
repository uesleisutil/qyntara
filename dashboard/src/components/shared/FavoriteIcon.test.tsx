import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FavoriteIcon } from './FavoriteIcon';
import { FavoritesProvider } from '../../contexts/FavoritesContext';

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <FavoritesProvider>
      {component}
    </FavoritesProvider>
  );
};

describe('FavoriteIcon', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders unfilled star for non-favorite ticker', () => {
    renderWithProvider(<FavoriteIcon ticker="PETR4" />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Add PETR4 to favorites');
  });

  it('toggles favorite on click', async () => {
    renderWithProvider(<FavoriteIcon ticker="PETR4" />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-label', 'Remove PETR4 from favorites');
    });
  });

  it('supports keyboard interaction', async () => {
    renderWithProvider(<FavoriteIcon ticker="PETR4" />);
    
    const button = screen.getByRole('button');
    
    fireEvent.keyDown(button, { key: 'Enter' });
    
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-label', 'Remove PETR4 from favorites');
    });
  });

  it('prevents adding more than 50 favorites', async () => {
    // Pre-populate with 50 favorites
    const favorites = Array.from({ length: 50 }, (_, i) => `TICKER${i}`);
    localStorage.setItem('dashboard_favorites', JSON.stringify({ tickers: favorites }));
    
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
    
    renderWithProvider(<FavoriteIcon ticker="PETR4" />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Maximum of 50 favorites'));
    });
    
    alertSpy.mockRestore();
  });

  it('shows tooltip when enabled', () => {
    renderWithProvider(<FavoriteIcon ticker="PETR4" showTooltip={true} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Add to favorites');
  });

  it('does not show tooltip when disabled', () => {
    renderWithProvider(<FavoriteIcon ticker="PETR4" showTooltip={false} />);
    
    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('title');
  });

  it('applies custom size', () => {
    const { container } = renderWithProvider(<FavoriteIcon ticker="PETR4" size={24} />);
    
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('disables button while loading', async () => {
    renderWithProvider(<FavoriteIcon ticker="PETR4" />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    // Button should be disabled during the async operation
    expect(button).toBeDisabled();
  });
});
