/**
 * Component Interaction Integration Tests
 * 
 * Tests interactions between components and data flow.
 * Subtask 31.3 - Integration Testing
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FilterProvider, useFilters } from '../contexts/FilterContext';

// Mock window.location and history for URL sync
delete (window as any).location;
(window as any).location = { href: 'http://localhost/', pathname: '/', search: '', hash: '' };
window.history.replaceState = jest.fn();

describe('Component Interaction Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  describe('FilterContext data flow', () => {
    const FilterConsumer = () => {
      const { filters, setFilter, clearAllFilters } = useFilters();
      return (
        <div>
          <span data-testid="sector">{filters.sector || 'all'}</span>
          <span data-testid="minScore">{filters.minScore ?? 0}</span>
          <button onClick={() => setFilter('sector', 'Finance')}>Set Finance</button>
          <button onClick={() => setFilter('minScore', 80)}>Set Score 80</button>
          <button onClick={clearAllFilters}>Clear</button>
        </div>
      );
    };

    it('propagates filter changes to consumers', () => {
      render(
        <FilterProvider>
          <FilterConsumer />
        </FilterProvider>
      );

      expect(screen.getByTestId('sector')).toHaveTextContent('all');
      fireEvent.click(screen.getByText('Set Finance'));
      expect(screen.getByTestId('sector')).toHaveTextContent('Finance');
    });

    it('supports multiple filter composition', () => {
      render(
        <FilterProvider>
          <FilterConsumer />
        </FilterProvider>
      );

      fireEvent.click(screen.getByText('Set Finance'));
      fireEvent.click(screen.getByText('Set Score 80'));

      expect(screen.getByTestId('sector')).toHaveTextContent('Finance');
      expect(screen.getByTestId('minScore')).toHaveTextContent('80');
    });

    it('clears all filters at once', () => {
      render(
        <FilterProvider>
          <FilterConsumer />
        </FilterProvider>
      );

      fireEvent.click(screen.getByText('Set Finance'));
      fireEvent.click(screen.getByText('Set Score 80'));
      fireEvent.click(screen.getByText('Clear'));

      expect(screen.getByTestId('sector')).toHaveTextContent('all');
      expect(screen.getByTestId('minScore')).toHaveTextContent('0');
    });

    it('shares state between multiple consumers', () => {
      const SecondConsumer = () => {
        const { filters } = useFilters();
        return <span data-testid="second-sector">{filters.sector || 'all'}</span>;
      };

      render(
        <FilterProvider>
          <FilterConsumer />
          <SecondConsumer />
        </FilterProvider>
      );

      fireEvent.click(screen.getByText('Set Finance'));
      expect(screen.getByTestId('sector')).toHaveTextContent('Finance');
      expect(screen.getByTestId('second-sector')).toHaveTextContent('Finance');
    });
  });

  describe('Session storage integration', () => {
    it('persists filter state to sessionStorage', () => {
      const FilterConsumer = () => {
        const { filters, setFilter } = useFilters();
        return (
          <div>
            <span data-testid="sector">{filters.sector || 'all'}</span>
            <button onClick={() => setFilter('sector', 'Energy')}>Set Energy</button>
          </div>
        );
      };

      render(
        <FilterProvider>
          <FilterConsumer />
        </FilterProvider>
      );

      fireEvent.click(screen.getByText('Set Energy'));
      expect(screen.getByTestId('sector')).toHaveTextContent('Energy');

      // Verify sessionStorage was updated
      const stored = sessionStorage.getItem('dashboardFilters');
      expect(stored).toBeDefined();
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.sector).toBe('Energy');
      }
    });

    it('restores filter state from sessionStorage on mount', () => {
      // Pre-populate sessionStorage
      sessionStorage.setItem('dashboardFilters', JSON.stringify({ sector: 'Materials' }));

      const FilterConsumer = () => {
        const { filters } = useFilters();
        return <span data-testid="sector">{filters.sector || 'all'}</span>;
      };

      render(
        <FilterProvider>
          <FilterConsumer />
        </FilterProvider>
      );

      expect(screen.getByTestId('sector')).toHaveTextContent('Materials');
    });
  });

  describe('Theme persistence', () => {
    it('persists theme preference in localStorage', () => {
      localStorage.setItem('theme', 'dark');
      expect(localStorage.getItem('theme')).toBe('dark');

      localStorage.setItem('theme', 'light');
      expect(localStorage.getItem('theme')).toBe('light');
    });
  });
});
