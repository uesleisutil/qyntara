/**
 * S3 Configuration and Data Access Layer
 * Uses API Gateway for all S3 operations (no direct S3 access)
 */

import { API_BASE_URL, API_KEY } from '../config';

/**
 * Validates that all required environment variables are present
 * @returns {Object} Object with isValid boolean and missingVars array
 */
export const validateCredentials = () => {
  const missingVars = [];
  
  if (!API_BASE_URL) missingVars.push('REACT_APP_API_BASE_URL');
  if (!API_KEY) missingVars.push('REACT_APP_API_KEY');

  return {
    isValid: missingVars.length === 0,
    missingVars
  };
};

/**
 * Makes an API request with proper headers
 * @param {string} endpoint - API endpoint path
 * @returns {Promise<Object>} API response data
 */
const apiRequest = async (endpoint) => {
  if (!API_BASE_URL || !API_KEY) {
    throw new Error('API configuration missing');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

/**
 * Creates and configures an S3Client with credentials from environment variables
 * @returns {S3Client} Configured S3Client instance
 * @throws {Error} If required environment variables are missing
 */
export const createS3Client = () => {
  const validation = validateCredentials();
  
  if (!validation.isValid) {
    throw new Error(
      `Configuration error: Missing environment variables: ${validation.missingVars.join(', ')}`
    );
  }

  // Return a mock client since we're using API Gateway
  return {
    _isApiClient: true
  };
};

/**
 * Gets the S3 bucket name from environment variables
 * @returns {string} S3 bucket name
 * @throws {Error} If REACT_APP_S3_BUCKET is not set
 */
export const getBucketName = () => {
  // Not needed for API Gateway approach, but kept for compatibility
  return 'b3tr-200093399689-us-east-1';
};

// Export a singleton S3Client instance
let s3ClientInstance = null;

/**
 * Gets or creates the S3Client singleton instance
 * @returns {S3Client} S3Client instance
 */
export const getS3Client = () => {
  if (!s3ClientInstance) {
    s3ClientInstance = createS3Client();
  }
  return s3ClientInstance;
};

/**
 * Resets the S3Client singleton instance (for testing purposes)
 * @private
 */
export const __resetS3Client = () => {
  s3ClientInstance = null;
};

// Cache for S3 data with timestamps
const dataCache = {
  objects: new Map(), // Cache for readS3Object results
  lists: new Map(),   // Cache for listS3Objects results
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Clears all cached data (for testing purposes)
 * @private
 */
export const __clearCache = () => {
  dataCache.objects.clear();
  dataCache.lists.clear();
};

/**
 * Checks if a cache entry is still valid
 * @param {Object} cacheEntry - Cache entry with timestamp and data
 * @returns {boolean} True if cache is still valid
 */
const isCacheValid = (cacheEntry) => {
  if (!cacheEntry) return false;
  const now = Date.now();
  return (now - cacheEntry.timestamp) < CACHE_TTL;
};

/**
 * Fetches and parses a JSON object from S3 with caching
 * Uses API Gateway instead of direct S3 access
 * @param {string} key - The S3 object key (path within the bucket)
 * @returns {Promise<Object|null>} Parsed JSON object or null on error
 * @throws {Error} Throws error with type information for proper error handling
 */
export const readS3Object = async (key) => {
  // Check cache first
  const cachedEntry = dataCache.objects.get(key);
  if (isCacheValid(cachedEntry)) {
    console.log(`Using cached data for ${key}`);
    return cachedEntry.data;
  }

  try {
    // Use API Gateway to fetch data
    const data = await apiRequest(`/s3-proxy?key=${encodeURIComponent(key)}`);

    // Cache the successful result
    dataCache.objects.set(key, {
      data,
      timestamp: Date.now()
    });

    return data;
  } catch (error) {
    console.error(`Error reading S3 object ${key}:`, error);
    
    if (error.message.includes('404')) {
      const notFoundError = new Error(`Object not found: ${key}`);
      notFoundError.type = 'notfound';
      throw notFoundError;
    } else if (error.message.includes('Network') || error.message.includes('fetch')) {
      const networkError = new Error('Unable to connect to data source. Please check your internet connection.');
      networkError.type = 'network';
      throw networkError;
    } else if (error.message.includes('403') || error.message.includes('401')) {
      const authError = new Error('Authentication failed. Please check API key configuration.');
      authError.type = 'auth';
      throw authError;
    }
    
    throw error;
  }
};

/**
 * Lists S3 objects with a given prefix with caching
 * Uses API Gateway instead of direct S3 access
 * @param {string} prefix - The S3 prefix to filter objects (e.g., 'recommendations/')
 * @returns {Promise<Array>} Array of S3 objects with Key and LastModified properties
 * @throws {Error} Throws error with type information for proper error handling
 */
export const listS3Objects = async (prefix) => {
  // Check cache first
  const cachedEntry = dataCache.lists.get(prefix);
  if (isCacheValid(cachedEntry)) {
    console.log(`Using cached list for prefix ${prefix}`);
    return cachedEntry.data;
  }

  try {
    // Use API Gateway to list objects
    const response = await apiRequest(`/s3-proxy/list?prefix=${encodeURIComponent(prefix)}`);
    
    const result = response.objects || [];

    // Cache the successful result
    dataCache.lists.set(prefix, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    console.error(`Error listing S3 objects with prefix ${prefix}:`, error);
    
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      const networkError = new Error('Unable to connect to data source. Please check your internet connection.');
      networkError.type = 'network';
      throw networkError;
    } else if (error.message.includes('403') || error.message.includes('401')) {
      const authError = new Error('Authentication failed. Please check API key configuration.');
      authError.type = 'auth';
      throw authError;
    }
    
    throw error;
  }
};

