import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Breadcrumb, BreadcrumbSegment } from './Breadcrumb';

describe('Breadcrumb', () => {
  const mockSegments: BreadcrumbSegment[] = [
    { label: 'Dashboard', onClick: jest.fn() },
    { label: 'Recommendations', onClick: jest.fn() },
    { label: 'Ticker Detail' }
  ];

  it('renders all segments', () => {
    render(<Breadcrumb segments={mockSegments} />);
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Ticker Detail')).toBeInTheDocument();
  });

  it('renders home icon for first segment', () => {
    const { container } = render(<Breadcrumb segments={mockSegments} />);
    
    // Check for home icon (lucide-react renders as svg)
    const homeIcon = container.querySelector('svg');
    expect(homeIcon).toBeInTheDocument();
  });

  it('renders separators between segments', () => {
    const { container } = render(<Breadcrumb segments={mockSegments} />);
    
    // ChevronRight icons are used as separators
    const separators = container.querySelectorAll('svg');
    // Should have 1 home icon + 2 separators
    expect(separators.length).toBeGreaterThanOrEqual(3);
  });

  it('makes non-last segments clickable', () => {
    render(<Breadcrumb segments={mockSegments} />);
    
    const dashboardButton = screen.getByRole('button', { name: /dashboard/i });
    const recommendationsButton = screen.getByRole('button', { name: /recommendations/i });
    
    expect(dashboardButton).toBeInTheDocument();
    expect(recommendationsButton).toBeInTheDocument();
  });

  it('does not make last segment clickable', () => {
    render(<Breadcrumb segments={mockSegments} />);
    
    const tickerDetail = screen.getByText('Ticker Detail');
    expect(tickerDetail.tagName).toBe('SPAN');
  });

  it('calls onClick when segment is clicked', () => {
    render(<Breadcrumb segments={mockSegments} />);
    
    const dashboardButton = screen.getByRole('button', { name: /dashboard/i });
    fireEvent.click(dashboardButton);
    
    expect(mockSegments[0].onClick).toHaveBeenCalled();
  });

  it('supports keyboard navigation', () => {
    render(<Breadcrumb segments={mockSegments} />);
    
    const dashboardButton = screen.getByRole('button', { name: /dashboard/i });
    
    fireEvent.keyDown(dashboardButton, { key: 'Enter' });
    expect(mockSegments[0].onClick).toHaveBeenCalled();
    
    fireEvent.keyDown(dashboardButton, { key: ' ' });
    expect(mockSegments[0].onClick).toHaveBeenCalledTimes(2);
  });

  it('truncates long labels', () => {
    const longSegments: BreadcrumbSegment[] = [
      { label: 'A'.repeat(100), onClick: jest.fn() }
    ];
    
    render(<Breadcrumb segments={longSegments} maxLength={20} />);
    
    const truncatedText = screen.getByText(/A+\.\.\./);
    expect(truncatedText).toBeInTheDocument();
    expect(truncatedText.textContent?.length).toBeLessThan(100);
  });

  it('highlights current location', () => {
    render(<Breadcrumb segments={mockSegments} />);
    
    const currentSegment = screen.getByText('Ticker Detail');
    expect(currentSegment).toHaveAttribute('aria-current', 'page');
  });

  it('applies dark mode styles', () => {
    const { container } = render(<Breadcrumb segments={mockSegments} darkMode={true} />);
    
    // Component should render without errors in dark mode
    expect(container.firstChild).toBeInTheDocument();
  });

  it('handles empty segments array', () => {
    render(<Breadcrumb segments={[]} />);
    
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });

  it('handles single segment', () => {
    const singleSegment: BreadcrumbSegment[] = [
      { label: 'Dashboard' }
    ];
    
    render(<Breadcrumb segments={singleSegment} />);
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toHaveAttribute('aria-current', 'page');
  });
});
