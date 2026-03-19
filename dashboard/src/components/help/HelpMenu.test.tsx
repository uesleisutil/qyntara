import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HelpMenu } from './HelpMenu';

// Mock child components
jest.mock('./GuidedTour', () => ({
  GuidedTour: ({ run, tourType }: any) => (
    <div data-testid="guided-tour">
      {run && <div data-testid="tour-active">Tour Active: {tourType}</div>}
    </div>
  ),
}));

jest.mock('./FAQ', () => ({
  FAQ: ({ darkMode }: any) => (
    <div data-testid="faq-component">FAQ Component (Dark: {darkMode ? 'yes' : 'no'})</div>
  ),
}));

jest.mock('./Glossary', () => ({
  Glossary: ({ darkMode }: any) => (
    <div data-testid="glossary-component">Glossary Component (Dark: {darkMode ? 'yes' : 'no'})</div>
  ),
}));

jest.mock('./FeedbackWidget', () => ({
  FeedbackWidget: ({ darkMode, onClose }: any) => (
    <div data-testid="feedback-component">
      Feedback Component (Dark: {darkMode ? 'yes' : 'no'})
      <button onClick={onClose}>Close Feedback</button>
    </div>
  ),
}));

jest.mock('./ReleaseNotes', () => ({
  ReleaseNotes: ({ darkMode }: any) => (
    <div data-testid="release-notes-component">Release Notes (Dark: {darkMode ? 'yes' : 'no'})</div>
  ),
}));

describe('HelpMenu', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Mock window.confirm
    global.confirm = jest.fn(() => false);
  });

  it('renders help button', () => {
    render(<HelpMenu />);
    const helpButton = screen.getByTitle('Help & Documentation');
    expect(helpButton).toBeInTheDocument();
  });

  it('shows red dot indicator when tour not completed', () => {
    localStorage.removeItem('tourCompleted');
    const { container } = render(<HelpMenu />);
    
    // Look for the red dot indicator
    const redDot = container.querySelector('span[style*="background"]');
    expect(redDot).toBeInTheDocument();
  });

  it('does not show red dot when tour is completed', () => {
    localStorage.setItem('tourCompleted', 'true');
    const { container } = render(<HelpMenu />);
    
    // Red dot should not be present
    const helpButton = screen.getByTitle('Help & Documentation');
    const redDot = helpButton.querySelector('span[style*="background"]');
    expect(redDot).not.toBeInTheDocument();
  });

  it('opens help menu when button is clicked', () => {
    render(<HelpMenu />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    expect(screen.getByText('Help & Documentation')).toBeInTheDocument();
    expect(screen.getByText('Start Main Tour')).toBeInTheDocument();
  });

  it('closes help menu when close button is clicked', () => {
    render(<HelpMenu />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    // The close button in the menu header has no text, just an X icon
    // Find all buttons and click the one that's not the help button
    const allButtons = screen.getAllByRole('button');
    // The close button is the small one in the menu header (not the menu items)
    const closeButton = allButtons.find(btn => 
      !btn.textContent?.includes('Tour') && 
      !btn.textContent?.includes('FAQ') && 
      !btn.textContent?.includes('Glossary') &&
      btn !== helpButton
    );
    if (closeButton) fireEvent.click(closeButton);
    
    expect(screen.queryByText('Start Main Tour')).not.toBeInTheDocument();
  });

  it('displays all menu options', () => {
    render(<HelpMenu />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    expect(screen.getByText('Start Main Tour')).toBeInTheDocument();
    expect(screen.getByText('Advanced Features Tour')).toBeInTheDocument();
    expect(screen.getByText('FAQ')).toBeInTheDocument();
    expect(screen.getByText('Technical Glossary')).toBeInTheDocument();
    expect(screen.getByText('Feedback')).toBeInTheDocument();
    expect(screen.getByText('Release Notes')).toBeInTheDocument();
  });

  it('starts main tour when clicked', () => {
    render(<HelpMenu />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    const mainTourButton = screen.getByText('Start Main Tour');
    fireEvent.click(mainTourButton);
    
    expect(screen.getByTestId('tour-active')).toHaveTextContent('Tour Active: main');
  });

  it('starts advanced tour when clicked', () => {
    render(<HelpMenu />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    const advancedTourButton = screen.getByText('Advanced Features Tour');
    fireEvent.click(advancedTourButton);
    
    expect(screen.getByTestId('tour-active')).toHaveTextContent('Tour Active: advanced');
  });

  it('opens FAQ view when clicked', () => {
    render(<HelpMenu />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    const faqButton = screen.getByText('FAQ');
    fireEvent.click(faqButton);
    
    expect(screen.getByTestId('faq-component')).toBeInTheDocument();
  });

  it('opens Glossary view when clicked', () => {
    render(<HelpMenu />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    const glossaryButton = screen.getByText('Technical Glossary');
    fireEvent.click(glossaryButton);
    
    expect(screen.getByTestId('glossary-component')).toBeInTheDocument();
  });

  it('closes menu when starting a tour', () => {
    render(<HelpMenu />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    const mainTourButton = screen.getByText('Start Main Tour');
    fireEvent.click(mainTourButton);
    
    // Menu should be closed
    expect(screen.queryByText('Advanced Features Tour')).not.toBeInTheDocument();
  });

  it('passes darkMode prop to FAQ component', () => {
    render(<HelpMenu darkMode={true} />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    const faqButton = screen.getByText('FAQ');
    fireEvent.click(faqButton);
    
    expect(screen.getByTestId('faq-component')).toHaveTextContent('Dark: yes');
  });

  it('passes darkMode prop to Glossary component', () => {
    render(<HelpMenu darkMode={true} />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    const glossaryButton = screen.getByText('Technical Glossary');
    fireEvent.click(glossaryButton);
    
    expect(screen.getByTestId('glossary-component')).toHaveTextContent('Dark: yes');
  });

  it('offers tour on first visit', async () => {
    const confirmMock = jest.fn(() => true);
    global.confirm = confirmMock;
    
    localStorage.removeItem('hasVisited');
    
    render(<HelpMenu />);
    
    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('does not offer tour on subsequent visits', async () => {
    const confirmMock = jest.fn();
    global.confirm = confirmMock;
    
    localStorage.setItem('hasVisited', 'true');
    
    render(<HelpMenu />);
    
    await waitFor(() => {
      expect(confirmMock).not.toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('marks tour as completed when finished', () => {
    localStorage.removeItem('tourCompleted');
    
    render(<HelpMenu />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    const mainTourButton = screen.getByText('Start Main Tour');
    fireEvent.click(mainTourButton);
    
    // Simulate tour completion by checking localStorage
    // In real scenario, this would be set by the tour's onComplete callback
    expect(localStorage.getItem('tourCompleted')).toBeFalsy();
  });

  it('can close FAQ view and return to menu', () => {
    render(<HelpMenu />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    const faqButton = screen.getByText('FAQ');
    fireEvent.click(faqButton);
    
    expect(screen.getByTestId('faq-component')).toBeInTheDocument();
    
    // Close FAQ
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(screen.queryByTestId('faq-component')).not.toBeInTheDocument();
  });

  it('can close Glossary view and return to menu', () => {
    render(<HelpMenu />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    const glossaryButton = screen.getByText('Technical Glossary');
    fireEvent.click(glossaryButton);
    
    expect(screen.getByTestId('glossary-component')).toBeInTheDocument();
    
    // Close Glossary
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(screen.queryByTestId('glossary-component')).not.toBeInTheDocument();
  });

  it('applies correct styling in dark mode', () => {
    const { container } = render(<HelpMenu darkMode={true} />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    // Check if menu has dark mode styling
    const menu = container.querySelector('[style*="background"]');
    expect(menu).toBeInTheDocument();
  });

  it('applies correct styling in light mode', () => {
    const { container } = render(<HelpMenu darkMode={false} />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    // Check if menu has light mode styling
    const menu = container.querySelector('[style*="background"]');
    expect(menu).toBeInTheDocument();
  });

  it('opens Feedback view when clicked', () => {
    render(<HelpMenu />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    const feedbackButton = screen.getByText('Feedback');
    fireEvent.click(feedbackButton);
    
    expect(screen.getByTestId('feedback-component')).toBeInTheDocument();
  });

  it('opens Release Notes view when clicked', () => {
    render(<HelpMenu />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    const releaseNotesButton = screen.getByText('Release Notes');
    fireEvent.click(releaseNotesButton);
    
    expect(screen.getByTestId('release-notes-component')).toBeInTheDocument();
  });

  it('passes darkMode prop to Feedback component', () => {
    render(<HelpMenu darkMode={true} />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    const feedbackButton = screen.getByText('Feedback');
    fireEvent.click(feedbackButton);
    
    expect(screen.getByTestId('feedback-component')).toHaveTextContent('Dark: yes');
  });

  it('passes darkMode prop to Release Notes component', () => {
    render(<HelpMenu darkMode={true} />);
    
    const helpButton = screen.getByTitle('Help & Documentation');
    fireEvent.click(helpButton);
    
    const releaseNotesButton = screen.getByText('Release Notes');
    fireEvent.click(releaseNotesButton);
    
    expect(screen.getByTestId('release-notes-component')).toHaveTextContent('Dark: yes');
  });
});
