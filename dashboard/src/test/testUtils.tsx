import React, { ReactElement } from 'react';
import { render, RenderOptions }
 from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FilterProvider } from '@contexts/FilterContext';
import { UIProvider } from '@contexts/UIContext';
import { AuthProvider } from '@contexts/AuthContext';

// Create a custom render function that includes all providers
const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UIProvider>
          <FilterProvider>
            {children}
          </FilterProvider>
        </UIProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Custom matchers
export const customMatchers = {
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
};

// Mock data generators
export const mockRecommendation = (overrides = {}) => ({
  ticker: 'PETR4',
  sector: 'Energy',
  score: 0.85,
  expectedReturn: 0.15,
  confidence: 0.9,
  rank: 1,
  timestamp: new Date().toISOString(),
  features: {},
  ...overrides,
});

export const mockUser = (overrides = {}) => ({
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'analyst' as const,
  ...overrides,
});
