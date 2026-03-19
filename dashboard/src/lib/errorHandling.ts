export interface APIError {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
  details?: any;
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export const errorHandlers: Record<string, (error: any) => APIError> = {
  NetworkError: (error) => ({
    code: 'NETWORK_ERROR',
    message: error.message,
    userMessage: 'Unable to connect. Please check your internet connection.',
    retryable: true,
  }),
  AuthenticationError: (error) => ({
    code: 'AUTH_ERROR',
    message: error.message,
    userMessage: 'Your session has expired. Please log in again.',
    retryable: false,
  }),
  ValidationError: (error) => ({
    code: 'VALIDATION_ERROR',
    message: error.message,
    userMessage: `Invalid input${error.field ? `: ${error.field}` : ''}`,
    retryable: false,
    details: { field: error.field },
  }),
  ServerError: (error) => ({
    code: 'SERVER_ERROR',
    message: error.message,
    userMessage: "Something went wrong on our end. We're working on it.",
    retryable: true,
  }),
  NotFoundError: (error) => ({
    code: 'NOT_FOUND',
    message: error.message,
    userMessage: 'The requested data was not found.',
    retryable: false,
  }),
  RateLimitError: (error) => ({
    code: 'RATE_LIMIT',
    message: error.message,
    userMessage: 'Too many requests. Please wait a moment and try again.',
    retryable: true,
  }),
};

export function handleError(error: Error): APIError {
  const handler = errorHandlers[error.name];
  if (handler) {
    return handler(error);
  }

  // Default error handling
  return {
    code: 'UNKNOWN_ERROR',
    message: error.message,
    userMessage: 'An unexpected error occurred. Please try again.',
    retryable: true,
  };
}

export function isRetryable(error: Error): boolean {
  const apiError = handleError(error);
  return apiError.retryable;
}

// Exponential backoff retry utility
export async function fetchWithRetry<T>(
  fetcher: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetcher();
    } catch (error) {
      if (attempt === maxRetries || !isRetryable(error as Error)) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// Offline detection
export function setupOfflineDetection(
  onOffline: () => void,
  onOnline: () => void
) {
  window.addEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);

  return () => {
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('online', onOnline);
  };
}
