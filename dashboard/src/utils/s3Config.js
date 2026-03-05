import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

/**
 * Validates that all required AWS environment variables are present
 * @returns {Object} Object with isValid boolean and missingVars array
 */
export const validateCredentials = () => {
  const requiredEnvVars = [
    'REACT_APP_AWS_REGION',
    'REACT_APP_AWS_ACCESS_KEY_ID',
    'REACT_APP_AWS_SECRET_ACCESS_KEY',
    'REACT_APP_S3_BUCKET'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  return {
    isValid: missingVars.length === 0,
    missingVars
  };
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

  return new S3Client({
    region: process.env.REACT_APP_AWS_REGION,
    credentials: {
      accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
    },
  });
};

/**
 * Gets the S3 bucket name from environment variables
 * @returns {string} S3 bucket name
 * @throws {Error} If REACT_APP_S3_BUCKET is not set
 */
export const getBucketName = () => {
  const bucketName = process.env.REACT_APP_S3_BUCKET;
  
  if (!bucketName) {
    throw new Error('Configuration error: REACT_APP_S3_BUCKET environment variable is not set');
  }
  
  return bucketName;
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
    const client = getS3Client();
    const bucketName = getBucketName();

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await client.send(command);
    const text = await response.Body.transformToString();
    
    // Validate data structure before parsing
    if (!text || text.trim() === '') {
      const error = new Error(`Empty data received from S3 object ${key}`);
      error.type = 'parsing';
      throw error;
    }
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error(`JSON parsing error for ${key}:`, parseError);
      const error = new Error(`Data parsing failed for ${key}. The data format may be invalid.`);
      error.type = 'parsing';
      error.originalError = parseError;
      throw error;
    }

    // Cache the successful result
    dataCache.objects.set(key, {
      data,
      timestamp: Date.now()
    });

    return data;
  } catch (error) {
    // Categorize error types
    if (error.type) {
      // Already categorized error
      console.error(`Error reading S3 object ${key}:`, error);
      throw error;
    } else if (error.name === 'NetworkingError' || error.name === 'TimeoutError') {
      console.error(`Network error reading ${key}:`, error);
      const networkError = new Error('Unable to connect to data source. Please check your internet connection.');
      networkError.type = 'network';
      networkError.originalError = error;
      throw networkError;
    } else if (error.name === 'CredentialsError' || error.name === 'AccessDenied' || error.code === 'InvalidAccessKeyId' || error.code === 'SignatureDoesNotMatch') {
      console.error(`Authentication error reading ${key}:`, error);
      const authError = new Error('Authentication failed. Please check AWS credentials configuration.');
      authError.type = 'auth';
      authError.originalError = error;
      throw authError;
    } else {
      console.error(`Error reading S3 object ${key}:`, error);
      throw error;
    }
  }
};

/**
 * Lists S3 objects with a given prefix with caching
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
    const client = getS3Client();
    const bucketName = getBucketName();

    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
    });

    const response = await client.send(command);
    
    // Return empty array if no contents
    if (!response.Contents || response.Contents.length === 0) {
      const emptyResult = [];
      // Cache empty result too
      dataCache.lists.set(prefix, {
        data: emptyResult,
        timestamp: Date.now()
      });
      return emptyResult;
    }

    // Return array of objects with Key and LastModified
    const result = response.Contents.map(obj => ({
      Key: obj.Key,
      LastModified: obj.LastModified,
      Size: obj.Size,
    }));

    // Cache the successful result
    dataCache.lists.set(prefix, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    // Categorize error types
    if (error.name === 'NetworkingError' || error.name === 'TimeoutError') {
      console.error(`Network error listing objects with prefix ${prefix}:`, error);
      const networkError = new Error('Unable to connect to data source. Please check your internet connection.');
      networkError.type = 'network';
      networkError.originalError = error;
      throw networkError;
    } else if (error.name === 'CredentialsError' || error.name === 'AccessDenied' || error.code === 'InvalidAccessKeyId' || error.code === 'SignatureDoesNotMatch') {
      console.error(`Authentication error listing objects with prefix ${prefix}:`, error);
      const authError = new Error('Authentication failed. Please check AWS credentials configuration.');
      authError.type = 'auth';
      authError.originalError = error;
      throw authError;
    } else {
      console.error(`Error listing S3 objects with prefix ${prefix}:`, error);
      throw error;
    }
  }
};

