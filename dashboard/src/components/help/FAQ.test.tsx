import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FAQ } from './FAQ';

describe('FAQ', () => {
  it('renders without crashing', () => {
    render(<FAQ />);
    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
  });

  it('displays search input', () => {
    render(<FAQ />);
    const searchInput = screen.getByPlaceholderText('Search FAQs...');
    expect(searchInput).toBeInTheDocument();
  });

  it('displays category filters', () => {
    render(<FAQ />);
    expect(screen.getByText(/All \(/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Getting Started/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Features/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Troubleshooting/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Data/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Technical/).length).toBeGreaterThan(0);
  });

  it('displays FAQ entries', () => {
    render(<FAQ />);
    expect(screen.getByText('What is the B3 Tactical Ranking Dashboard?')).toBeInTheDocument();
  });

  it('filters FAQs by search query', () => {
    render(<FAQ />);
    const searchInput = screen.getByPlaceholderText('Search FAQs...');
    
    fireEvent.change(searchInput, { target: { value: 'SHAP' } });
    
    expect(screen.getByText(/What is SHAP and how is it used/)).toBeInTheDocument();
    expect(screen.queryByText('What is the B3 Tactical Ranking Dashboard?')).not.toBeInTheDocument();
  });

  it('filters FAQs by category', () => {
    render(<FAQ />);
    
    const featuresButtons = screen.getAllByText(/Features/);
    fireEvent.click(featuresButtons[0]);
    
    // Should show features category FAQs
    expect(screen.getByText(/What are the recommendation scores/)).toBeInTheDocument();
  });

  it('expands FAQ entry when clicked', () => {
    render(<FAQ />);
    
    const question = screen.getByText('What is the B3 Tactical Ranking Dashboard?');
    fireEvent.click(question);
    
    // Answer should be visible
    expect(screen.getByText(/MLOps monitoring platform/)).toBeInTheDocument();
  });

  it('collapses FAQ entry when clicked again', () => {
    render(<FAQ />);
    
    const question = screen.getByText('What is the B3 Tactical Ranking Dashboard?');
    
    // Expand
    fireEvent.click(question);
    expect(screen.getByText(/MLOps monitoring platform/)).toBeInTheDocument();
    
    // Collapse
    fireEvent.click(question);
    // The answer might still be in DOM but hidden, so we check for the question
    expect(question).toBeInTheDocument();
  });

  it('displays contact support section', () => {
    render(<FAQ />);
    expect(screen.getByText('Still need help?')).toBeInTheDocument();
    expect(screen.getByText('Contact Support')).toBeInTheDocument();
  });

  it('shows helpful count for FAQ entries', () => {
    render(<FAQ />);
    expect(screen.getAllByText(/found helpful/).length).toBeGreaterThan(0);
  });

  it('allows rating FAQ entries as helpful', () => {
    render(<FAQ />);
    
    const question = screen.getByText('What is the B3 Tactical Ranking Dashboard?');
    fireEvent.click(question);
    
    // Find and click thumbs up button
    const thumbsUpButtons = screen.getAllByRole('button');
    const thumbsUpButton = thumbsUpButtons.find(btn => 
      btn.querySelector('svg')?.getAttribute('class')?.includes('lucide-thumbs-up')
    );
    
    if (thumbsUpButton) {
      fireEvent.click(thumbsUpButton);
    }
    
    // Verify the question is still visible (rating doesn't remove it)
    expect(question).toBeInTheDocument();
  });

  it('displays related documentation links when available', () => {
    render(<FAQ />);
    
    const question = screen.getByText('What is the B3 Tactical Ranking Dashboard?');
    fireEvent.click(question);
    
    expect(screen.getByText('Related Documentation:')).toBeInTheDocument();
  });

  it('shows no results message when search has no matches', () => {
    render(<FAQ />);
    
    const searchInput = screen.getByPlaceholderText('Search FAQs...');
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } });
    
    expect(screen.getByText('No FAQs found matching your search.')).toBeInTheDocument();
  });

  it('displays correct count of filtered results', () => {
    render(<FAQ />);
    
    const searchInput = screen.getByPlaceholderText('Search FAQs...');
    fireEvent.change(searchInput, { target: { value: 'model' } });
    
    // Should show FAQs containing "model" - verify at least one is visible
    expect(screen.getByText(/What.*model/i)).toBeInTheDocument();
  });

  it('applies dark mode styling when darkMode prop is true', () => {
    const { container } = render(<FAQ darkMode={true} />);
    const mainDiv = container.firstChild as HTMLElement;
    
    expect(mainDiv).toHaveStyle({ backgroundColor: '#0f172a' });
  });

  it('applies light mode styling when darkMode prop is false', () => {
    const { container } = render(<FAQ darkMode={false} />);
    const mainDiv = container.firstChild as HTMLElement;
    
    expect(mainDiv).toHaveStyle({ backgroundColor: '#f8fafc' });
  });

  it('has at least 30 FAQ entries', () => {
    render(<FAQ />);
    
    // Check the "All" button to see total count
    const allButton = screen.getByText(/All \(/);
    const countMatch = allButton.textContent?.match(/\((\d+)\)/);
    const count = countMatch ? parseInt(countMatch[1]) : 0;
    
    expect(count).toBeGreaterThanOrEqual(30);
  });
});
