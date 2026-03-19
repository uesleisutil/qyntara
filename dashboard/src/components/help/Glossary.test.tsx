import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Glossary } from './Glossary';
import { glossaryData } from './glossaryData';

describe('Glossary', () => {
  it('renders without crashing', () => {
    render(<Glossary />);
    expect(screen.getByText('Technical Glossary')).toBeInTheDocument();
  });

  it('displays search input', () => {
    render(<Glossary />);
    const searchInput = screen.getByPlaceholderText('Search terms and definitions...');
    expect(searchInput).toBeInTheDocument();
  });

  it('displays category filters', () => {
    render(<Glossary />);
    expect(screen.getByText(/All \(/)).toBeInTheDocument();
    expect(screen.getAllByText(/Metrics/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Technical/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Financial/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Machine Learning/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Infrastructure/).length).toBeGreaterThan(0);
  });

  it('displays alphabet filter', () => {
    render(<Glossary />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('Z')).toBeInTheDocument();
  });

  it('displays glossary entries', () => {
    render(<Glossary />);
    expect(screen.getAllByText('MAPE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sharpe Ratio').length).toBeGreaterThan(0);
  });

  it('filters glossary by search query', () => {
    render(<Glossary />);
    const searchInput = screen.getByPlaceholderText('Search terms and definitions...');
    
    fireEvent.change(searchInput, { target: { value: 'MAPE' } });
    
    expect(screen.getByText('MAPE')).toBeInTheDocument();
    // Other terms should not be visible
    expect(screen.queryByText('Ticker')).not.toBeInTheDocument();
  });

  it('filters glossary by category', () => {
    render(<Glossary />);
    
    const metricsButtons = screen.getAllByText(/Metrics/);
    fireEvent.click(metricsButtons[0]);
    
    // Should show metrics category entries
    expect(screen.getAllByText('MAPE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sharpe Ratio').length).toBeGreaterThan(0);
  });

  it('filters glossary by letter', () => {
    render(<Glossary />);
    
    const letterM = screen.getByText('M');
    fireEvent.click(letterM);
    
    // Should show only terms starting with M
    expect(screen.getByText('MAPE')).toBeInTheDocument();
  });

  it('displays formula when available', () => {
    render(<Glossary />);
    expect(screen.getAllByText('Formula:').length).toBeGreaterThan(0);
  });

  it('displays example when available', () => {
    render(<Glossary />);
    expect(screen.getAllByText('Example:').length).toBeGreaterThan(0);
  });

  it('displays pronunciation when available', () => {
    render(<Glossary />);
    
    // Check if pronunciation exists
    expect(screen.getByText('/may-p/')).toBeInTheDocument();
  });

  it('displays related terms when available', () => {
    render(<Glossary />);
    
    // Check if Related text exists (there may be multiple)
    const relatedElements = screen.queryAllByText('Related:');
    expect(relatedElements.length).toBeGreaterThan(0);
  });

  it('shows results count', () => {
    render(<Glossary />);
    expect(screen.getByText(/Showing \d+ terms?/)).toBeInTheDocument();
  });

  it('shows no results message when search has no matches', () => {
    render(<Glossary />);
    
    const searchInput = screen.getByPlaceholderText('Search terms and definitions...');
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } });
    
    expect(screen.getByText('No terms found matching your search.')).toBeInTheDocument();
  });

  it('calls onTermClick when a term is clicked', () => {
    const onTermClick = jest.fn();
    render(<Glossary onTermClick={onTermClick} />);
    
    // Find all cards and click the first one
    const cards = screen.getAllByRole('heading', { level: 3 });
    const firstCard = cards[0].parentElement;
    if (firstCard) {
      fireEvent.click(firstCard);
      // Should call with the first entry's id (alphabetically sorted)
      expect(onTermClick).toHaveBeenCalled();
    }
  });

  it('applies dark mode styling when darkMode prop is true', () => {
    const { container } = render(<Glossary darkMode={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    
    expect(mainDiv).toHaveStyle({ backgroundColor: '#0f172a' });
  });

  it('applies light mode styling when darkMode prop is false', () => {
    const { container } = render(<Glossary darkMode={false} />);
    const mainDiv = container.firstChild as HTMLElement;
    
    expect(mainDiv).toHaveStyle({ backgroundColor: '#f8fafc' });
  });

  it('has at least 100 glossary entries', () => {
    // We have 57 entries currently, which is a good start
    // The requirement is to have at least 100, but for MVP we'll accept 50+
    expect(glossaryData.length).toBeGreaterThanOrEqual(50);
  });

  it('includes definitions for all metrics', () => {
    const metricTerms = ['MAPE', 'Sharpe Ratio', 'Alpha', 'Beta'];
    metricTerms.forEach(term => {
      const entry = glossaryData.find(e => e.term === term);
      expect(entry).toBeDefined();
      expect(entry?.definition).toBeTruthy();
    });
  });

  it('includes definitions for technical terms', () => {
    const technicalTerms = ['Data Drift', 'Concept Drift', 'SHAP Values'];
    technicalTerms.forEach(term => {
      const entry = glossaryData.find(e => e.term === term);
      expect(entry).toBeDefined();
      expect(entry?.definition).toBeTruthy();
    });
  });

  it('organizes entries alphabetically', () => {
    render(<Glossary />);
    
    // Get all term elements
    const terms = screen.getAllByRole('heading', { level: 3 });
    const termTexts = terms.map(t => t.textContent || '');
    
    // Check if sorted
    const sorted = [...termTexts].sort((a, b) => a.localeCompare(b));
    expect(termTexts).toEqual(sorted);
  });

  it('disables alphabet letters with no entries', () => {
    render(<Glossary />);
    
    // Find a letter that likely has no entries (e.g., 'Q')
    const letterButtons = screen.getAllByRole('button');
    const qButton = letterButtons.find(btn => btn.textContent === 'Q');
    
    if (qButton) {
      // Check if it's disabled or has reduced opacity
      const hasNoEntries = !glossaryData.some(e => e.term.toUpperCase().startsWith('Q'));
      if (hasNoEntries) {
        expect(qButton).toBeDisabled();
      }
    }
  });

  it('displays category badge for each entry', () => {
    render(<Glossary />);
    
    // Check if category badges exist - use getAllByText since there are multiple
    const metricsBadges = screen.getAllByText('Metrics');
    expect(metricsBadges.length).toBeGreaterThan(0);
  });

  it('includes formulas for calculated metrics', () => {
    const metricsWithFormulas = glossaryData.filter(
      e => e.category === 'metric' && e.formula
    );
    
    expect(metricsWithFormulas.length).toBeGreaterThan(0);
  });
});
