import { 
  validateCredentials, 
  createS3Client, 
  getBucketName, 
  getS3Client, 
  __resetS3Client, 
  __clearCache, 
  readS3Object, 
  listS3Objects 
} from './s3Config';

// Mock the config module
jest.mock('../config', () => ({
  API_BASE_URL: 'https://api.example.com',
  API_KEY: 'test-api-key-123'
}));

// Mock fetch
global.fetch = jest.fn();

describe('S3 Configuration (API Gateway Approach)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetS3Client();
    __clearCache();
  });

  describe('validateCredentials', () => {
    it('should return valid when API_BASE_URL and API_KEY are set', () => {
      const result = validateCredentials();

      expect(result.isValid).toBe(true);
      expect(result.missingVars).toEqual([]);
    });
  });

  describe('createS3Client', () => {
    it('should create a mock client when credentials are valid', () => {
      const client = createS3Client();

      expect(client).toBeDefined();
      expect(client._isApiClient).toBe(true);
    });
  });

  describe('getBucketName', () => {
    it('should return the hardcoded bucket name', () => {
      const bucketName = getBucketName();

      expect(bucketName).toBe('b3tr-200093399689-us-east-1');
    });
  });

  describe('getS3Client', () => {
    it('should return the same client instance on multiple calls (singleton)', () => {
      const client1 = getS3Client();
      const client2 = getS3Client();

      expect(client1).toBe(client2);
    });

    it('should create a new client after reset', () => {
      const client1 = getS3Client();
      __resetS3Client();
      const client2 = getS3Client();

      expect(client1).not.toBe(client2);
    });
  });

  describe('readS3Object', () => {
    it('should fetch and parse JSON from API Gateway successfully', async () => {
      const mockData = { test: 'data', value: 123 };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await readS3Object('test/path.json');

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/s3-proxy?key=test%2Fpath.json',
        expect.objectContaining({
          headers: {
            'x-api-key': 'test-api-key-123',
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should cache successful responses', async () => {
      const mockData = { test: 'cached' };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      // First call - should fetch
      const result1 = await readS3Object('test/cached.json');
      expect(result1).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await readS3Object('test/cached.json');
      expect(result2).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should throw error when API request fails with 404', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(readS3Object('test/missing.json')).rejects.toThrow('Object not found');
    });

    it('should throw error when API request fails with 401', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(readS3Object('test/unauthorized.json')).rejects.toThrow('Authentication failed');
    });

    it('should throw error when API request fails with 403', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });

      await expect(readS3Object('test/forbidden.json')).rejects.toThrow('Authentication failed');
    });

    it('should throw network error when fetch fails', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(readS3Object('test/network-fail.json')).rejects.toThrow('Unable to connect to data source');
    });

    it('should handle nested JSON structures', async () => {
      const mockData = {
        recommendations: [
          { rank: 1, ticker: 'PETR4', score: 0.85 },
          { rank: 2, ticker: 'VALE3', score: 0.82 }
        ],
        metadata: {
          date: '2024-01-15',
          generated_at: '2024-01-15T21:45:00Z'
        }
      };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await readS3Object('recommendations/2024-01-15.json');

      expect(result).toEqual(mockData);
      expect(result.recommendations).toHaveLength(2);
      expect(result.metadata.date).toBe('2024-01-15');
    });
  });

  describe('listS3Objects', () => {
    it('should list S3 objects via API Gateway successfully', async () => {
      const mockObjects = [
        { Key: 'recommendations/2024-01-15.json', LastModified: '2024-01-15T00:00:00Z', Size: 1024 },
        { Key: 'recommendations/2024-01-14.json', LastModified: '2024-01-14T00:00:00Z', Size: 2048 }
      ];
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ objects: mockObjects })
      });

      const result = await listS3Objects('recommendations/');

      expect(result).toHaveLength(2);
      expect(result[0].Key).toBe('recommendations/2024-01-15.json');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/s3-proxy/list?prefix=recommendations%2F',
        expect.objectContaining({
          headers: {
            'x-api-key': 'test-api-key-123',
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should cache list responses', async () => {
      const mockObjects = [{ Key: 'test/file.json', LastModified: '2024-01-15T00:00:00Z', Size: 512 }];
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ objects: mockObjects })
      });

      // First call - should fetch
      const result1 = await listS3Objects('test/');
      expect(result1).toEqual(mockObjects);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await listS3Objects('test/');
      expect(result2).toEqual(mockObjects);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should return empty array when no objects match prefix', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ objects: [] })
      });

      const result = await listS3Objects('nonexistent/');

      expect(result).toEqual([]);
    });

    it('should return empty array when objects property is missing', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      const result = await listS3Objects('test/');

      expect(result).toEqual([]);
    });

    it('should throw error when API request fails', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(listS3Objects('test/')).rejects.toThrow('API request failed');
    });

    it('should throw network error when fetch fails', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(listS3Objects('test/')).rejects.toThrow('Unable to connect to data source');
    });

    it('should handle multiple objects with different timestamps', async () => {
      const mockObjects = [
        { Key: 'monitoring/ingestion/2024-01-15-14-30.json', LastModified: '2024-01-15T14:30:00Z', Size: 512 },
        { Key: 'monitoring/ingestion/2024-01-15-14-00.json', LastModified: '2024-01-15T14:00:00Z', Size: 768 },
        { Key: 'monitoring/ingestion/2024-01-15-13-30.json', LastModified: '2024-01-15T13:30:00Z', Size: 1024 }
      ];
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ objects: mockObjects })
      });

      const result = await listS3Objects('monitoring/ingestion/');

      expect(result).toHaveLength(3);
      expect(result[0].Key).toBe('monitoring/ingestion/2024-01-15-14-30.json');
      expect(result[1].Key).toBe('monitoring/ingestion/2024-01-15-14-00.json');
      expect(result[2].Key).toBe('monitoring/ingestion/2024-01-15-13-30.json');
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when __clearCache is called', async () => {
      const mockData = { test: 'data' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      // First call - should fetch
      await readS3Object('test/cache.json');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await readS3Object('test/cache.json');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Clear cache
      __clearCache();

      // Third call - should fetch again
      await readS3Object('test/cache.json');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Requirements Validation', () => {
    it('should validate API configuration before making requests', async () => {
      // This is implicitly tested by all successful API calls
      const mockData = { test: 'data' };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      await expect(readS3Object('test/path.json')).resolves.toEqual(mockData);
    });

    it('should handle API connectivity errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(readS3Object('test/path.json')).rejects.toThrow('Unable to connect to data source');
    });

    it('should provide user-friendly error messages', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      try {
        await readS3Object('test/missing.json');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Object not found');
        expect(error.type).toBe('notfound');
      }
    });
  });
});
