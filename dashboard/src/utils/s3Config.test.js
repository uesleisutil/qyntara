import { validateCredentials, createS3Client, getBucketName, getS3Client, __resetS3Client, __clearCache, readS3Object, listS3Objects } from './s3Config';
import { S3Client } from '@aws-sdk/client-s3';

// Mock the AWS SDK
jest.mock('@aws-sdk/client-s3');

describe('S3 Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    __resetS3Client(); // Reset S3 client singleton
    __clearCache(); // Clear data cache
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateCredentials', () => {
    it('should return valid when all required environment variables are set', () => {
      process.env.REACT_APP_AWS_REGION = 'us-east-1';
      process.env.REACT_APP_AWS_ACCESS_KEY_ID = 'test-key-id';
      process.env.REACT_APP_AWS_SECRET_ACCESS_KEY = 'test-secret-key';
      process.env.REACT_APP_S3_BUCKET = 'test-bucket';

      const result = validateCredentials();

      expect(result.isValid).toBe(true);
      expect(result.missingVars).toEqual([]);
    });

    it('should return invalid when AWS region is missing', () => {
      process.env.REACT_APP_AWS_ACCESS_KEY_ID = 'test-key-id';
      process.env.REACT_APP_AWS_SECRET_ACCESS_KEY = 'test-secret-key';
      process.env.REACT_APP_S3_BUCKET = 'test-bucket';
      delete process.env.REACT_APP_AWS_REGION;

      const result = validateCredentials();

      expect(result.isValid).toBe(false);
      expect(result.missingVars).toContain('REACT_APP_AWS_REGION');
    });

    it('should return invalid when access key ID is missing', () => {
      process.env.REACT_APP_AWS_REGION = 'us-east-1';
      process.env.REACT_APP_AWS_SECRET_ACCESS_KEY = 'test-secret-key';
      process.env.REACT_APP_S3_BUCKET = 'test-bucket';
      delete process.env.REACT_APP_AWS_ACCESS_KEY_ID;

      const result = validateCredentials();

      expect(result.isValid).toBe(false);
      expect(result.missingVars).toContain('REACT_APP_AWS_ACCESS_KEY_ID');
    });

    it('should return invalid when secret access key is missing', () => {
      process.env.REACT_APP_AWS_REGION = 'us-east-1';
      process.env.REACT_APP_AWS_ACCESS_KEY_ID = 'test-key-id';
      process.env.REACT_APP_S3_BUCKET = 'test-bucket';
      delete process.env.REACT_APP_AWS_SECRET_ACCESS_KEY;

      const result = validateCredentials();

      expect(result.isValid).toBe(false);
      expect(result.missingVars).toContain('REACT_APP_AWS_SECRET_ACCESS_KEY');
    });

    it('should return invalid when S3 bucket is missing', () => {
      process.env.REACT_APP_AWS_REGION = 'us-east-1';
      process.env.REACT_APP_AWS_ACCESS_KEY_ID = 'test-key-id';
      process.env.REACT_APP_AWS_SECRET_ACCESS_KEY = 'test-secret-key';
      delete process.env.REACT_APP_S3_BUCKET;

      const result = validateCredentials();

      expect(result.isValid).toBe(false);
      expect(result.missingVars).toContain('REACT_APP_S3_BUCKET');
    });

    it('should return all missing variables when multiple are missing', () => {
      delete process.env.REACT_APP_AWS_REGION;
      delete process.env.REACT_APP_AWS_ACCESS_KEY_ID;
      delete process.env.REACT_APP_AWS_SECRET_ACCESS_KEY;
      delete process.env.REACT_APP_S3_BUCKET;

      const result = validateCredentials();

      expect(result.isValid).toBe(false);
      expect(result.missingVars).toHaveLength(4);
      expect(result.missingVars).toContain('REACT_APP_AWS_REGION');
      expect(result.missingVars).toContain('REACT_APP_AWS_ACCESS_KEY_ID');
      expect(result.missingVars).toContain('REACT_APP_AWS_SECRET_ACCESS_KEY');
      expect(result.missingVars).toContain('REACT_APP_S3_BUCKET');
    });
  });

  describe('createS3Client', () => {
    it('should create S3Client with correct configuration when all env vars are set', () => {
      process.env.REACT_APP_AWS_REGION = 'us-west-2';
      process.env.REACT_APP_AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
      process.env.REACT_APP_AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      process.env.REACT_APP_S3_BUCKET = 'my-test-bucket';

      const client = createS3Client();

      expect(client).toBeDefined();
      expect(client.send).toBeDefined();
    });

    it('should throw error when required environment variables are missing', () => {
      delete process.env.REACT_APP_AWS_REGION;
      delete process.env.REACT_APP_AWS_ACCESS_KEY_ID;
      delete process.env.REACT_APP_AWS_SECRET_ACCESS_KEY;
      delete process.env.REACT_APP_S3_BUCKET;

      expect(() => createS3Client()).toThrow('Configuration error: Missing environment variables');
    });

    it('should throw error with specific missing variables in message', () => {
      delete process.env.REACT_APP_AWS_REGION;
      process.env.REACT_APP_AWS_ACCESS_KEY_ID = 'test-key';
      process.env.REACT_APP_AWS_SECRET_ACCESS_KEY = 'test-secret';
      process.env.REACT_APP_S3_BUCKET = 'test-bucket';

      expect(() => createS3Client()).toThrow('REACT_APP_AWS_REGION');
    });
  });

  describe('getBucketName', () => {
    it('should return bucket name when REACT_APP_S3_BUCKET is set', () => {
      process.env.REACT_APP_S3_BUCKET = 'my-test-bucket';

      const bucketName = getBucketName();

      expect(bucketName).toBe('my-test-bucket');
    });

    it('should throw error when REACT_APP_S3_BUCKET is not set', () => {
      delete process.env.REACT_APP_S3_BUCKET;

      expect(() => getBucketName()).toThrow('Configuration error: REACT_APP_S3_BUCKET environment variable is not set');
    });
  });

  describe('getS3Client', () => {
    it('should return the same S3Client instance on multiple calls (singleton)', () => {
      process.env.REACT_APP_AWS_REGION = 'us-east-1';
      process.env.REACT_APP_AWS_ACCESS_KEY_ID = 'test-key-id';
      process.env.REACT_APP_AWS_SECRET_ACCESS_KEY = 'test-secret-key';
      process.env.REACT_APP_S3_BUCKET = 'test-bucket';

      const client1 = getS3Client();
      const client2 = getS3Client();

      expect(client1).toBe(client2);
    });
  });

  describe('Requirements 7.1, 7.2, 7.3 - S3 Configuration and Validation', () => {
    it('should read AWS region from REACT_APP_AWS_REGION environment variable', () => {
      process.env.REACT_APP_AWS_REGION = 'eu-west-1';
      process.env.REACT_APP_AWS_ACCESS_KEY_ID = 'test-key';
      process.env.REACT_APP_AWS_SECRET_ACCESS_KEY = 'test-secret';
      process.env.REACT_APP_S3_BUCKET = 'test-bucket';

      const client = createS3Client();

      // Verify client was created successfully
      expect(client).toBeDefined();
      expect(client.send).toBeDefined();
    });

    it('should read S3 bucket name from REACT_APP_S3_BUCKET environment variable', () => {
      process.env.REACT_APP_S3_BUCKET = 'production-bucket';

      const bucketName = getBucketName();

      expect(bucketName).toBe('production-bucket');
    });

    it('should validate credentials before allowing S3Client creation', () => {
      delete process.env.REACT_APP_AWS_ACCESS_KEY_ID;

      expect(() => createS3Client()).toThrow();
    });

    it('should display configuration error when credentials are missing', () => {
      delete process.env.REACT_APP_AWS_REGION;
      delete process.env.REACT_APP_AWS_ACCESS_KEY_ID;

      const validation = validateCredentials();

      expect(validation.isValid).toBe(false);
      expect(validation.missingVars.length).toBeGreaterThan(0);
    });
  });

  describe('readS3Object', () => {
    let mockSend;

    beforeEach(() => {
      process.env.REACT_APP_AWS_REGION = 'us-east-1';
      process.env.REACT_APP_AWS_ACCESS_KEY_ID = 'test-key-id';
      process.env.REACT_APP_AWS_SECRET_ACCESS_KEY = 'test-secret-key';
      process.env.REACT_APP_S3_BUCKET = 'test-bucket';

      __resetS3Client();
      
      // Mock the S3Client's send method
      mockSend = jest.fn();
      S3Client.mockImplementation(() => ({
        send: mockSend
      }));
    });

    afterEach(() => {
      jest.clearAllMocks();
      __resetS3Client();
    });

    it('should fetch and parse JSON from S3 successfully', async () => {
      const mockData = { test: 'data', value: 123 };
      mockSend.mockResolvedValue({
        Body: {
          transformToString: jest.fn().mockResolvedValue(JSON.stringify(mockData))
        }
      });

      const result = await readS3Object('test/path.json');

      expect(result).toEqual(mockData);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should throw error when S3 GetObject fails', async () => {
      mockSend.mockRejectedValue(new Error('Network error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(readS3Object('test/path.json')).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error reading S3 object test/path.json:'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should throw error when JSON parsing fails', async () => {
      mockSend.mockResolvedValue({
        Body: {
          transformToString: jest.fn().mockResolvedValue('invalid json {')
        }
      });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(readS3Object('test/invalid.json')).rejects.toThrow('Data parsing failed');

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle empty JSON object', async () => {
      const mockData = {};
      mockSend.mockResolvedValue({
        Body: {
          transformToString: jest.fn().mockResolvedValue(JSON.stringify(mockData))
        }
      });

      const result = await readS3Object('test/empty.json');

      expect(result).toEqual({});
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
      mockSend.mockResolvedValue({
        Body: {
          transformToString: jest.fn().mockResolvedValue(JSON.stringify(mockData))
        }
      });

      const result = await readS3Object('recommendations/2024-01-15.json');

      expect(result).toEqual(mockData);
      expect(result.recommendations).toHaveLength(2);
      expect(result.metadata.date).toBe('2024-01-15');
    });
  });

  describe('listS3Objects', () => {
    let mockSend;

    beforeEach(() => {
      process.env.REACT_APP_AWS_REGION = 'us-east-1';
      process.env.REACT_APP_AWS_ACCESS_KEY_ID = 'test-key-id';
      process.env.REACT_APP_AWS_SECRET_ACCESS_KEY = 'test-secret-key';
      process.env.REACT_APP_S3_BUCKET = 'test-bucket';

      __resetS3Client();
      
      mockSend = jest.fn();
      S3Client.mockImplementation(() => ({
        send: mockSend
      }));
    });

    afterEach(() => {
      jest.clearAllMocks();
      __resetS3Client();
    });

    it('should list S3 objects with given prefix successfully', async () => {
      const mockContents = [
        { Key: 'recommendations/2024-01-15.json', LastModified: new Date('2024-01-15'), Size: 1024 },
        { Key: 'recommendations/2024-01-14.json', LastModified: new Date('2024-01-14'), Size: 2048 }
      ];
      mockSend.mockResolvedValue({
        Contents: mockContents
      });

      const result = await listS3Objects('recommendations/');

      expect(result).toHaveLength(2);
      expect(result[0].Key).toBe('recommendations/2024-01-15.json');
      expect(result[0].LastModified).toEqual(new Date('2024-01-15'));
      expect(result[0].Size).toBe(1024);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no objects match prefix', async () => {
      mockSend.mockResolvedValue({
        Contents: []
      });

      const result = await listS3Objects('nonexistent/');

      expect(result).toEqual([]);
    });

    it('should return empty array when Contents is undefined', async () => {
      mockSend.mockResolvedValue({});

      const result = await listS3Objects('test/');

      expect(result).toEqual([]);
    });

    it('should throw error when ListObjectsV2 fails', async () => {
      mockSend.mockRejectedValue(new Error('Network error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(listS3Objects('test/')).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error listing S3 objects with prefix test/:'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle multiple objects with different timestamps', async () => {
      const mockContents = [
        { Key: 'monitoring/ingestion/2024-01-15-14-30.json', LastModified: new Date('2024-01-15T14:30:00Z'), Size: 512 },
        { Key: 'monitoring/ingestion/2024-01-15-14-00.json', LastModified: new Date('2024-01-15T14:00:00Z'), Size: 768 },
        { Key: 'monitoring/ingestion/2024-01-15-13-30.json', LastModified: new Date('2024-01-15T13:30:00Z'), Size: 1024 }
      ];
      mockSend.mockResolvedValue({
        Contents: mockContents
      });

      const result = await listS3Objects('monitoring/ingestion/');

      expect(result).toHaveLength(3);
      expect(result[0].Key).toBe('monitoring/ingestion/2024-01-15-14-30.json');
      expect(result[1].Key).toBe('monitoring/ingestion/2024-01-15-14-00.json');
      expect(result[2].Key).toBe('monitoring/ingestion/2024-01-15-13-30.json');
    });

    it('should map S3 objects to include Key, LastModified, and Size', async () => {
      const mockContents = [
        { 
          Key: 'test/file.json', 
          LastModified: new Date('2024-01-15'), 
          Size: 2048,
          ETag: '"abc123"',
          StorageClass: 'STANDARD'
        }
      ];
      mockSend.mockResolvedValue({
        Contents: mockContents
      });

      const result = await listS3Objects('test/');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        Key: 'test/file.json',
        LastModified: new Date('2024-01-15'),
        Size: 2048
      });
      // Should not include ETag or StorageClass
      expect(result[0].ETag).toBeUndefined();
      expect(result[0].StorageClass).toBeUndefined();
    });
  });


  describe('Requirements 1.1, 2.1, 3.1, 10.1, 10.2 - Data Fetching and Error Handling', () => {
    let mockSend;

    beforeEach(() => {
      process.env.REACT_APP_AWS_REGION = 'us-east-1';
      process.env.REACT_APP_AWS_ACCESS_KEY_ID = 'test-key-id';
      process.env.REACT_APP_AWS_SECRET_ACCESS_KEY = 'test-secret-key';
      process.env.REACT_APP_S3_BUCKET = 'test-bucket';

      __resetS3Client();
      
      mockSend = jest.fn();
      S3Client.mockImplementation(() => ({
        send: mockSend
      }));
    });

    afterEach(() => {
      jest.clearAllMocks();
      __resetS3Client();
    });

    it('should fetch data from S3 using GetObjectCommand', async () => {
      const mockData = { test: 'data' };
      mockSend.mockResolvedValue({
        Body: {
          transformToString: jest.fn().mockResolvedValue(JSON.stringify(mockData))
        }
      });

      await readS3Object('test/path.json');

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should handle S3 connectivity errors gracefully (Requirement 10.1)', async () => {
      mockSend.mockRejectedValue(new Error('S3 unreachable'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(readS3Object('test/path.json')).rejects.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle malformed JSON data gracefully (Requirement 10.2)', async () => {
      mockSend.mockResolvedValue({
        Body: {
          transformToString: jest.fn().mockResolvedValue('not valid json')
        }
      });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(readS3Object('test/malformed.json')).rejects.toThrow('Data parsing failed');
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should log errors to console for debugging (Requirement 10.4)', async () => {
      const testError = new Error('Test error');
      mockSend.mockRejectedValue(testError);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(readS3Object('test/path.json')).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error reading S3 object test/path.json:'),
        testError
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
