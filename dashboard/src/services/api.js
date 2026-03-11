/**
 * API Service
 * 
 * Centralized API client for the B3 Model Optimization Dashboard.
 * Handles all HTTP requests with error handling, retries, and logging.
 */

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';
const API_KEY = process.env.REACT_APP_API_KEY;

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
  
  monitoring: {
    getDataQuality: (days = 30) => api.get('/api/monitoring/data-quality', { days }),
    getModelPerformance: (days = 30) => api.get('/api/monitoring/model-performance', { days }),
    getDrift: (days = 30) => api.get('/api/monitoring/drift', { days }),
    getCosts: (days = 30) => api.get('/api/monitoring/costs', { days }),
    getEnsembleWeights: (days = 30) => api.get('/api/monitoring/ensemble-weights', { days })
  }
};

export default api;
export { APIError };
