import { readS3Object, listS3Objects } from './s3Config';

/**
 * Loads the most recent recommendations file from S3
 * @returns {Promise<Array>} Array of recommendation objects
 */
export const loadRecommendations = async () => {
  try {
    // List all recommendation files
    const objects = await listS3Objects('recommendations/');
    
    if (!objects || objects.length === 0) {
      console.warn('No recommendation files found in S3');
      return [];
    }

    // Find the most recent file by LastModified timestamp
    const mostRecent = objects.reduce((latest, current) => {
      if (!latest || current.LastModified > latest.LastModified) {
        return current;
      }
      return latest;
    }, null);

    if (!mostRecent) {
      console.warn('Could not determine most recent recommendation file');
      return [];
    }

    // Fetch and parse the most recent file
    const data = await readS3Object(mostRecent.Key);
    
    if (!data) {
      console.error('Failed to read recommendation data');
      return [];
    }

    // Validate data structure
    if (!data.recommendations || !Array.isArray(data.recommendations)) {
      console.error('Invalid recommendation data format: missing recommendations array');
      return [];
    }

    return data.recommendations;
  } catch (error) {
    console.error('Error loading recommendations:', error);
    return [];
  }
};

/**
 * Loads model quality data for the last 30 days from S3
 * @returns {Promise<Array>} Array of quality data objects
 */
export const loadQualityData = async () => {
  try {
    // List all quality data files
    const objects = await listS3Objects('monitoring/model_quality/');
    
    if (!objects || objects.length === 0) {
      console.warn('No quality data files found in S3');
      return [];
    }

    // Calculate cutoff date (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    // Filter files to last 30 days
    const recentObjects = objects.filter(obj => {
      return obj.LastModified >= cutoffDate;
    });

    if (recentObjects.length === 0) {
      console.warn('No quality data files found within the last 30 days');
      return [];
    }

    // Fetch and parse all recent files
    const qualityDataPromises = recentObjects.map(obj => readS3Object(obj.Key));
    const qualityDataResults = await Promise.all(qualityDataPromises);

    // Filter out null results and validate data structure
    const validQualityData = qualityDataResults.filter(data => {
      if (!data) return false;
      
      // Validate required fields
      if (typeof data.dt === 'undefined' || 
          typeof data.mape === 'undefined' || 
          typeof data.coverage === 'undefined') {
        console.warn('Invalid quality data format: missing required fields');
        return false;
      }
      
      return true;
    });

    return validQualityData;
  } catch (error) {
    console.error('Error loading quality data:', error);
    return [];
  }
};

/**
 * Loads ingestion data for the last 48 hours from S3
 * @returns {Promise<Array>} Array of ingestion data objects
 */
export const loadIngestionData = async () => {
  try {
    // List all ingestion data files
    const objects = await listS3Objects('monitoring/ingestion/');
    
    if (!objects || objects.length === 0) {
      console.warn('No ingestion data files found in S3');
      return [];
    }

    // Calculate cutoff time (48 hours ago)
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 48);

    // Filter files to last 48 hours
    const recentObjects = objects.filter(obj => {
      return obj.LastModified >= cutoffTime;
    });

    if (recentObjects.length === 0) {
      console.warn('No ingestion data files found within the last 48 hours');
      return [];
    }

    // Fetch and parse all recent files
    const ingestionDataPromises = recentObjects.map(obj => readS3Object(obj.Key));
    const ingestionDataResults = await Promise.all(ingestionDataPromises);

    // Filter out null results and validate data structure
    const validIngestionData = ingestionDataResults.filter(data => {
      if (!data) return false;
      
      // Validate required fields
      if (typeof data.timestamp === 'undefined' || 
          typeof data.status === 'undefined') {
        console.warn('Invalid ingestion data format: missing required fields');
        return false;
      }
      
      return true;
    });

    return validIngestionData;
  } catch (error) {
    console.error('Error loading ingestion data:', error);
    return [];
  }
};

/**
 * Loads all data sources in parallel
 * @returns {Promise<Object>} Object containing recommendations, qualityData, ingestionData, and lastUpdated timestamp
 */
export const loadData = async () => {
  const startTime = Date.now();
  
  try {
    // Load all data sources in parallel
    const [recommendations, qualityData, ingestionData] = await Promise.allSettled([
      loadRecommendations(),
      loadQualityData(),
      loadIngestionData(),
    ]);

    // Extract results and handle errors gracefully
    const result = {
      recommendations: recommendations.status === 'fulfilled' ? recommendations.value : [],
      qualityData: qualityData.status === 'fulfilled' ? qualityData.value : [],
      ingestionData: ingestionData.status === 'fulfilled' ? ingestionData.value : [],
      lastUpdated: new Date(),
    };

    // Log errors for failed data sources
    if (recommendations.status === 'rejected') {
      console.error('Failed to load recommendations:', recommendations.reason);
    }
    if (qualityData.status === 'rejected') {
      console.error('Failed to load quality data:', qualityData.reason);
    }
    if (ingestionData.status === 'rejected') {
      console.error('Failed to load ingestion data:', ingestionData.reason);
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    console.log(`Data loading completed in ${duration.toFixed(2)} seconds`);

    return result;
  } catch (error) {
    console.error('Error in loadData orchestration:', error);
    
    // Return empty data structure on catastrophic failure
    return {
      recommendations: [],
      qualityData: [],
      ingestionData: [],
      lastUpdated: new Date(),
    };
  }
};
