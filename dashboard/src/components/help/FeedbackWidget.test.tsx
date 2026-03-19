import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FeedbackWidget } from './FeedbackWidget';

// Mock the api service
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

import api from '../../services/api';
const mockPost = api.post as jest.Mock;

describe('FeedbackWidget', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('renders the feedback form', () => {
    render(<FeedbackWidget />);
    expect(screen.getByText('Share Your Feedback')).toBeInTheDocument();
    expect(screen.getByLabelText(/rating/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/comments/i)).toBeInTheDocument();
  });

  it('renders 5 star buttons', () => {
    render(<FeedbackWidget />);
    const stars = screen.getAllByRole('radio');
    expect(stars).toHaveLength(5);
  });

  it('disables submit when no rating selected', () => {
    render(<FeedbackWidget />);
    const submitButton = screen.getByRole('button', { name: /submit feedback/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit after selecting a rating', () => {
    render(<FeedbackWidget />);
    const star3 = screen.getByRole('radio', { name: /3 stars/i });
    fireEvent.click(star3);
    const submitButton = screen.getByRole('button', { name: /submit feedback/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('shows success message after submission', async () => {
    mockPost.mockResolvedValueOnce({ success: true });
    render(<FeedbackWidget />);

    fireEvent.click(screen.getByRole('radio', { name: /4 stars/i }));
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => {
      expect(screen.getByText('Thank you!')).toBeInTheDocument();
    });
    expect(mockPost).toHaveBeenCalledWith('/api/feedback', expect.objectContaining({ rating: 4 }));
  });

  it('shows error message on submission failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'));
    render(<FeedbackWidget />);

    fireEvent.click(screen.getByRole('radio', { name: /5 stars/i }));
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('sends comment and category with submission', async () => {
    mockPost.mockResolvedValueOnce({ success: true });
    render(<FeedbackWidget />);

    fireEvent.click(screen.getByRole('radio', { name: /3 stars/i }));
    fireEvent.change(screen.getByLabelText(/comments/i), { target: { value: 'Great dashboard!' } });
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'feature' } });
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/api/feedback',
        expect.objectContaining({
          rating: 3,
          comment: 'Great dashboard!',
          category: 'feature',
        })
      );
    });
  });
});
