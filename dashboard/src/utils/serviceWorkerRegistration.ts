/**
 * Service Worker Registration
 * 
 * This file handles service worker registration and provides
 * utilities for managing the service worker lifecycle.
 */

interface ServiceWorkerConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

export function register(config?: ServiceWorkerConfig): void {
  if ('serviceWorker' in navigator) {
    // Wait for page load to register service worker
    window.addEventListener('load', () => {
      const swUrl = `/service-worker.js`;

      registerValidSW(swUrl, config);
    });
  }
}

async function registerValidSW(
  swUrl: string,
  config?: ServiceWorkerConfig
): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.register(swUrl);

    registration.onupdatefound = () => {
      const installingWorker = registration.installing;
      if (installingWorker == null) {
        return;
      }

      installingWorker.onstatechange = () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New service worker available
            console.log('New service worker available');
            
            if (config && config.onUpdate) {
              config.onUpdate(registration);
            }
          } else {
            // Service worker installed for the first time
            console.log('Service worker installed');
            
            if (config && config.onSuccess) {
              config.onSuccess(registration);
            }
          }
        }
      };
    };

    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('Back online');
      if (config && config.onOnline) {
        config.onOnline();
      }
    });

    window.addEventListener('offline', () => {
      console.log('Gone offline');
      if (config && config.onOffline) {
        config.onOffline();
      }
    });
  } catch (error) {
    console.error('Error during service worker registration:', error);
  }
}

export function unregister(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}

/**
 * Clear all caches
 */
export async function clearCache(): Promise<void> {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_CACHE',
    });
  }
  
  // Also clear browser caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
}

/**
 * Check if the app is running offline
 */
export function isOffline(): boolean {
  return !navigator.onLine;
}

/**
 * Get cache status for a request
 */
export async function getCacheStatus(url: string): Promise<{
  cached: boolean;
  age?: number;
  stale?: boolean;
}> {
  if (!('caches' in window)) {
    return { cached: false };
  }

  try {
    const cache = await caches.open('dashboard-api-v1.0.0');
    const response = await cache.match(url);

    if (!response) {
      return { cached: false };
    }

    const cachedDate = response.headers.get('sw-cached-date');
    if (!cachedDate) {
      return { cached: true };
    }

    const age = (Date.now() - new Date(cachedDate).getTime()) / 1000;
    const stale = response.headers.get('X-Cache-Status') === 'STALE';

    return { cached: true, age, stale };
  } catch (error) {
    console.error('Error checking cache status:', error);
    return { cached: false };
  }
}
