import {
  loadRecommendations,
  loadQualityData,
  loadIngestionData,
  loadData,
} from './dataLoader';
import { readS3Object, listS3Objects } from './s3Config';

// Mock the S3 utilities
jest.mock('./s3Config');

describe('dataLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console warnings and errors in tests
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.warn.mockRestore();
    console.error.mockRestore();
    console.log.mockRestore();
  });

  describe('loadRecommendations', () => {
    it('should load the most recent recommendation file', async () => {
      const mockObjects = [
        { Key: 'recommendations/2024-01-14.json', LastModified: new Date('2024-01-14') },
        { Key: 'recommendations/2024-01-15.json', LastModified: new Date('2024-01-15') },
        { Key: 'recommendations/2024-01-13.json', LastModified: new Date('2024-01-13') },
      ];

      const mockRecommendations = {
        date: '2024-01-15',
        recommendations: [
          { rank: 1, ticker: 'PETR4', score: 0.85, predicted_return: 0.0234, sector: 'Energy' },
          { rank: 2, ticker: 'VALE3', score: 0.82, predicted_return: 0.0189, sector: 'Materials' },
        ],
      };

      listS3Objects.mockResolvedValue(mockObjects);
      readS3Object.mockResolvedValue(mockRecommendations);

      const result = await loadRecommendations();

      expect(listS3Objects).toHaveBeenCalledWith('recommendations/');
      expect(readS3Object).toHaveBeenCalledWith('recommendations/2024-01-15.json');
      expect(result).toEqual(mockRecommendations.recommendations);
    });

    it('should return empty array when no files found', async () => {
      listS3Objects.mockResolvedValue([]);

      const result = await loadRecommendations();

      expect(result).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith('No recommendation files found in S3');
    });

    it('should return empty array when data is invalid', async () => {
      const mockObjects = [
        { Key: 'recommendations/2024-01-15.json', LastModified: new Date('2024-01-15') },
      ];

      listS3Objects.mockResolvedValue(mockObjects);
      readS3Object.mockResolvedValue({ invalid: 'data' });

      const result = await loadRecommendations();

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        'Invalid recommendation data format: missing recommendations array'
      );
    });

    it('should handle errors gracefully', async () => {
      listS3Objects.mockRejectedValue(new Error('S3 error'));

      const result = await loadRecommendations();

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        'Error loading recommendations:',
        expect.any(Error)
      );
    });
  });

  describe('loadQualityData', () => {
    it('should load quality data for the last 30 days', async () => {
      const now = new Date();
      const twentyDaysAgo = new Date(now);
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
      const fortyDaysAgo = new Date(now);
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

      const mockObjects = [
        { Key: 'monitoring/model_quality/2024-01-15.json', LastModified: twentyDaysAgo },
        { Key: 'monitoring/model_quality/2023-12-01.json', LastModified: fortyDaysAgo },
      ];

      const mockQualityData = {
        dt: '2024-01-15',
        mape: 0.12,
        coverage: 0.87,
        successful_predictions: 245,
        total_predictions: 282,
      };

      listS3Objects.mockResolvedValue(mockObjects);
      readS3Object.mockResolvedValue(mockQualityData);

      const result = await loadQualityData();

      expect(listS3Objects).toHaveBeenCalledWith('monitoring/model_quality/');
      // Should only fetch the recent file (within 30 days)
      expect(readS3Object).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockQualityData);
    });

    it('should return empty array when no files found', async () => {
      listS3Objects.mockResolvedValue([]);

      const result = await loadQualityData();

      expect(result).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith('No quality data files found in S3');
    });

    it('should filter out invalid data', async () => {
      const now = new Date();
      const mockObjects = [
        { Key: 'monitoring/model_quality/2024-01-15.json', LastModified: now },
      ];

      listS3Objects.mockResolvedValue(mockObjects);
      readS3Object.mockResolvedValue({ invalid: 'data' });

      const result = await loadQualityData();

      expect(result).toEqual([]);
    });
  });

  describe('loadIngestionData', () => {
    it('should load ingestion data for the last 48 hours', async () => {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now);
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      const seventyTwoHoursAgo = new Date(now);
      seventyTwoHoursAgo.setHours(seventyTwoHoursAgo.getHours() - 72);

      const mockObjects = [
        { Key: 'monitoring/ingestion/2024-01-15-14-30.json', LastModified: twentyFourHoursAgo },
        { Key: 'monitoring/ingestion/2024-01-12-10-00.json', LastModified: seventyTwoHoursAgo },
      ];

      const mockIngestionData = {
        timestamp: '2024-01-15T14:30:00Z',
        status: 'success',
        records_ingested: 150,
        execution_time_seconds: 12.5,
      };

      listS3Objects.mockResolvedValue(mockObjects);
      readS3Object.mockResolvedValue(mockIngestionData);

      const result = await loadIngestionData();

      expect(listS3Objects).toHaveBeenCalledWith('monitoring/ingestion/');
      // Should only fetch the recent file (within 48 hours)
      expect(readS3Object).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockIngestionData);
    });

    it('should return empty array when no files found', async () => {
      listS3Objects.mockResolvedValue([]);

      const result = await loadIngestionData();

      expect(result).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith('No ingestion data files found in S3');
    });

    it('should filter out invalid data', async () => {
      const now = new Date();
      const mockObjects = [
        { Key: 'monitoring/ingestion/2024-01-15-14-30.json', LastModified: now },
      ];

      listS3Objects.mockResolvedValue(mockObjects);
      readS3Object.mockResolvedValue({ invalid: 'data' });

      const result = await loadIngestionData();

      expect(result).toEqual([]);
    });
  });

  describe('loadData', () => {
    it('should load all data sources in parallel', async () => {
      const mockRecommendations = [
        { rank: 1, ticker: 'PETR4', score: 0.85 },
      ];
      const mockQualityData = [
        { dt: '2024-01-15', mape: 0.12, coverage: 0.87 },
      ];
      const mockIngestionData = [
        { timestamp: '2024-01-15T14:30:00Z', status: 'success' },
      ];

      listS3Objects.mockImplementation((prefix) => {
        if (prefix === 'recommendations/') {
          return Promise.resolve([
            { Key: 'recommendations/2024-01-15.json', LastModified: new Date() },
          ]);
        }
        if (prefix === 'monitoring/model_quality/') {
          return Promise.resolve([
            { Key: 'monitoring/model_quality/2024-01-15.json', LastModified: new Date() },
          ]);
        }
        if (prefix === 'monitoring/ingestion/') {
          return Promise.resolve([
            { Key: 'monitoring/ingestion/2024-01-15-14-30.json', LastModified: new Date() },
          ]);
        }
        return Promise.resolve([]);
      });

      readS3Object.mockImplementation((key) => {
        if (key.includes('recommendations')) {
          return Promise.resolve({ recommendations: mockRecommendations });
        }
        if (key.includes('model_quality')) {
          return Promise.resolve(mockQualityData[0]);
        }
        if (key.includes('ingestion')) {
          return Promise.resolve(mockIngestionData[0]);
        }
        return Promise.resolve(null);
      });

      const result = await loadData();

      expect(result.recommendations).toEqual(mockRecommendations);
      expect(result.qualityData).toEqual(mockQualityData);
      expect(result.ingestionData).toEqual(mockIngestionData);
      expect(result.lastUpdated).toBeInstanceOf(Date);
    });

    it('should handle partial failures gracefully', async () => {
      const now = new Date();
      
      listS3Objects.mockImplementation((prefix) => {
        if (prefix === 'recommendations/') {
          return Promise.reject(new Error('S3 error'));
        }
        if (prefix === 'monitoring/model_quality/') {
          return Promise.resolve([
            { Key: 'monitoring/model_quality/2024-01-15.json', LastModified: now },
          ]);
        }
        if (prefix === 'monitoring/ingestion/') {
          return Promise.resolve([
            { Key: 'monitoring/ingestion/2024-01-15-14-30.json', LastModified: now },
          ]);
        }
        return Promise.resolve([]);
      });

      readS3Object.mockImplementation((key) => {
        if (key.includes('model_quality')) {
          return Promise.resolve({
            dt: '2024-01-15',
            mape: 0.12,
            coverage: 0.87,
            successful_predictions: 245,
            total_predictions: 282,
          });
        }
        if (key.includes('ingestion')) {
          return Promise.resolve({
            timestamp: '2024-01-15T14:30:00Z',
            status: 'success',
            records_ingested: 150,
          });
        }
        return Promise.resolve(null);
      });

      const result = await loadData();

      expect(result.recommendations).toEqual([]);
      expect(result.qualityData).toHaveLength(1);
      expect(result.ingestionData).toHaveLength(1);
      // The error is logged by loadRecommendations, not by loadData orchestration
      expect(console.error).toHaveBeenCalledWith(
        'Error loading recommendations:',
        expect.any(Error)
      );
    });

    it('should return empty data structure on catastrophic failure', async () => {
      // Mock a catastrophic failure in Promise.allSettled itself
      jest.spyOn(Promise, 'allSettled').mockRejectedValue(new Error('Catastrophic error'));

      const result = await loadData();

      expect(result).toEqual({
        recommendations: [],
        qualityData: [],
        ingestionData: [],
        lastUpdated: expect.any(Date),
      });
      expect(console.error).toHaveBeenCalledWith(
        'Error in loadData orchestration:',
        expect.any(Error)
      );

      Promise.allSettled.mockRestore();
    });
  });
});
