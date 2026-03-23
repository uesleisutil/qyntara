/**
 * API Service
 * 
 * Centralized API client for the B3 Model Optimization Dashboard.
 * Handles all HTTP requests with error handling, retries, and logging.
 */

import { API_BASE_URL, API_KEY } from '../config';

/**
 * Custom error class for API errors
 */
class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Fetch with retry logic
 * 
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} retries - Number of retries (default: 3)
 * @param {number} delay - Delay between retries in ms (default: 1000)
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
  try {
    const response = await fetch(url, options);
    
    // If response is ok, return it
    if (response.ok) {
      return response;
    }
    
    // If it's a client error (4xx), don't retry
    if (response.status >= 400 && response.status < 500) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      );
    }
    
    // For server errors (5xx), retry
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  } catch (error) {
    if (retries > 0 && !(error instanceof APIError)) {
      console.warn(`Request failed, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Make an API request
 * 
 * @param {string} endpoint - API endpoint (e.g., '/metrics')
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Response data
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY && { 'x-api-key': API_KEY }),
      ...options.headers
    }
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    const response = await fetchWithRetry(url, mergedOptions);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * API methods
 */
const api = {
  /**
   * GET request
   */
  get: (endpoint, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return apiRequest(url, { method: 'GET' });
  },
  
  /**
   * POST request
   */
  post: (endpoint, data) => {
    return apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  
  /**
   * PUT request
   */
  put: (endpoint, data) => {
    return apiRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  
  /**
   * DELETE request
   */
  delete: (endpoint) => {
    return apiRequest(endpoint, { method: 'DELETE' });
  },
  
  // Dashboard API endpoints
  recommendations: {
    getLatest: () => api.get('/api/recommendations/latest')
  },
  
  ticker: {
    getHistory: (ticker, days = 90) => api.get(`/api/ticker/${ticker}/history`, { days }),
    getFundamentals: (ticker) => api.get(`/api/ticker/${ticker}/fundamentals`),
    getNews: (ticker, limit = 5) => api.get(`/api/ticker/${ticker}/news`, { limit })
  },
  
  macro: {
    getIndicators: () => api.get('/api/macro')
  },
  
  monitoring: {
    getDataQuality: (days = 30) => api.get('/api/monitoring/data-quality', { days }),
    getModelPerformance: (days = 30) => api.get('/api/monitoring/model-performance', { days }),
    getDrift: (days = 30) => api.get('/api/monitoring/drift', { days }),
    getCosts: (days = 30) => api.get('/api/monitoring/costs', { days }),
    getEnsembleWeights: (days = 30) => api.get('/api/monitoring/ensemble-weights', { days })
  },
  
  // Alert management endpoints (Req 5.1-5.8)
  alerts: {
    // Get all alerts for the current user
    getAll: () => api.get('/api/alerts'),
    
    // Create a new alert
    create: (alertData) => api.post('/api/alerts', alertData),
    
    // Update an existing alert
    update: (alertId, alertData) => api.put(`/api/alerts/${alertId}`, alertData),
    
    // Delete an alert
    delete: (alertId) => api.delete(`/api/alerts/${alertId}`),
    
    // Check for triggered alerts
    checkTriggered: (recommendations) => api.post('/api/alerts/check', { recommendations })
  },
  
  // Notification management endpoints (Req 5.4)
  notifications: {
    // Get all notifications for the current user
    getAll: () => api.get('/api/notifications'),
    
    // Mark notification as read
    markAsRead: (notificationId) => api.put(`/api/notifications/${notificationId}/read`),
    
    // Mark all notifications as read
    markAllAsRead: () => api.put('/api/notifications/read-all'),
    
    // Delete a notification
    delete: (notificationId) => api.delete(`/api/notifications/${notificationId}`)
  }
};

export default api;
export { APIError };
