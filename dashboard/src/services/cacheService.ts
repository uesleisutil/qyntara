/**
 * Intelligent Caching Service
 * 
 * Features:
 * - Cache API responses in browser storage (IndexedDB via idb)
 * - Configurable cache expiration times
 * - Cache versioning for API changes
 * - LRU eviction when cache size exceeds limit
 * - Cache indicators and manual invalidation
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  size: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxSize: number; // Maximum cache size in bytes (default 50MB)
  version: string; // API version for cache invalidation
  defaultTTL: number; // Default time-to-live in milliseconds
}

const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 50 * 1024 * 1024, // 50 MB
  version: '1.0.0',
  defaultTTL: 5 * 60 * 1000, // 5 minutes
};

// Cache TTL configurations for different data types
export const CACHE_TTL = {
  RECOMMENDATIONS: 5 * 60 * 1000, // 5 minutes
  HISTORICAL: 60 * 60 * 1000, // 60 minutes
  PERFORMANCE: 10 * 60 * 1000, // 10 minutes
  COSTS: 30 * 60 * 1000, // 30 minutes
  DATA_QUALITY: 60 * 60 * 1000, // 60 minutes
  DRIFT: 30 * 60 * 1000, // 30 minutes
  EXPLAINABILITY: 60 * 60 * 1000, // 60 minutes
};

class CacheService {
  private config: CacheConfig;
  private storageKey = 'dashboard_cache';
  private metadataKey = 'dashboard_cache_metadata';

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeCache();
  }

  private initializeCache(): void {
    // Check if cache version matches, if not, clear cache
    const metadata = this.getMetadata();
    if (metadata.version !== this.config.version) {
      console.log('Cache version mismatch, clearing cache');
      this.clearAll();
      this.setMetadata({ version: this.config.version, totalSize: 0 });
    }
  }

  private getMetadata(): { version: string; totalSize: number } {
    const metadata = localStorage.getItem(this.metadataKey);
    return metadata
      ? JSON.parse(metadata)
      : { version: this.config.version, totalSize: 0 };
  }

  private setMetadata(metadata: { version: string; totalSize: number }): void {
    localStorage.setItem(this.metadataKey, JSON.stringify(metadata));
  }

  private getCacheKey(key: string): string {
    return `${this.storageKey}_${key}`;
  }

  private estimateSize(data: any): number {
    // Rough estimation of data size in bytes
    return new Blob([JSON.stringify(data)]).size;
  }

  private getAllCacheKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.storageKey + '_')) {
        keys.push(key.replace(this.storageKey + '_', ''));
      }
    }
    return keys;
  }

  private evictLRU(): void {
    const keys = this.getAllCacheKeys();
    if (keys.length === 0) return;

    // Find least recently used entry
    let lruKey: string | null = null;
    let lruTime = Infinity;

    keys.forEach((key) => {
      const entry = this.getRawEntry(key);
      if (entry && entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    });

    if (lruKey) {
      console.log(`Evicting LRU cache entry: ${lruKey}`);
      this.remove(lruKey);
    }
  }

  private getRawEntry<T>(key: string): CacheEntry<T> | null {
    const cacheKey = this.getCacheKey(key);
    const item = localStorage.getItem(cacheKey);
    return item ? JSON.parse(item) : null;
  }

  /**
   * Set a value in the cache
   */
  set<T>(key: string, data: T, _ttl: number = this.config.defaultTTL): void {
    const size = this.estimateSize(data);
    const metadata = this.getMetadata();

    // Check if adding this entry would exceed max size
    if (metadata.totalSize + size > this.config.maxSize) {
      console.warn('Cache size limit reached, evicting LRU entries');
      // Evict entries until we have enough space
      while (metadata.totalSize + size > this.config.maxSize) {
        this.evictLRU();
        const updatedMetadata = this.getMetadata();
        if (updatedMetadata.totalSize === metadata.totalSize) {
          // No more entries to evict
          console.error('Cannot fit entry in cache even after eviction');
          return;
        }
        metadata.totalSize = updatedMetadata.totalSize;
      }
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: this.config.version,
      size,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    const cacheKey = this.getCacheKey(key);
    localStorage.setItem(cacheKey, JSON.stringify(entry));

    // Update metadata
    this.setMetadata({
      version: this.config.version,
      totalSize: metadata.totalSize + size,
    });
  }

  /**
   * Get a value from the cache
   */
  get<T>(key: string, ttl: number = this.config.defaultTTL): T | null {
    const entry = this.getRawEntry<T>(key);

    if (!entry) {
      return null;
    }

    // Check version
    if (entry.version !== this.config.version) {
      this.remove(key);
      return null;
    }

    // Check expiration
    const age = Date.now() - entry.timestamp;
    if (age > ttl) {
      this.remove(key);
      return null;
    }

    // Update access metadata
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    const cacheKey = this.getCacheKey(key);
    localStorage.setItem(cacheKey, JSON.stringify(entry));

    return entry.data;
  }

  /**
   * Check if a cache entry exists and is valid
   */
  has(key: string, ttl: number = this.config.defaultTTL): boolean {
    return this.get(key, ttl) !== null;
  }

  /**
   * Get cache metadata for a key
   */
  getMetadataForKey(key: string): {
    isCached: boolean;
    age?: number;
    size?: number;
    accessCount?: number;
  } {
    const entry = this.getRawEntry(key);
    if (!entry) {
      return { isCached: false };
    }

    return {
      isCached: true,
      age: Date.now() - entry.timestamp,
      size: entry.size,
      accessCount: entry.accessCount,
    };
  }

  /**
   * Remove a specific cache entry
   */
  remove(key: string): void {
    const entry = this.getRawEntry(key);
    if (entry) {
      const cacheKey = this.getCacheKey(key);
      localStorage.removeItem(cacheKey);

      // Update metadata
      const metadata = this.getMetadata();
      this.setMetadata({
        version: this.config.version,
        totalSize: Math.max(0, metadata.totalSize - entry.size),
      });
    }
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    const keys = this.getAllCacheKeys();
    keys.forEach((key) => {
      const cacheKey = this.getCacheKey(key);
      localStorage.removeItem(cacheKey);
    });
    this.setMetadata({ version: this.config.version, totalSize: 0 });
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalSize: number;
    maxSize: number;
    entryCount: number;
    utilizationPercent: number;
  } {
    const metadata = this.getMetadata();
    const entryCount = this.getAllCacheKeys().length;

    return {
      totalSize: metadata.totalSize,
      maxSize: this.config.maxSize,
      entryCount,
      utilizationPercent: (metadata.totalSize / this.config.maxSize) * 100,
    };
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export cache indicator component props type
export interface CacheIndicatorProps {
  cacheKey: string;
  ttl?: number;
}
