/**
 * Service Worker for Dashboard Offline Support
 * 
 * Features:
 * - Cache static assets (1 year)
 * - Cache API responses (5-60 minutes based on data type)
 * - Offline fallback with staleness indicator
 * - Cache versioning for updates
 */

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `dashboard-static-${CACHE_VERSION}`;
const API_CACHE = `dashboard-api-${CACHE_VERSION}`;
const OFFLINE_PAGE = '/offline.html';

// Static assets to cache (1 year)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/favicon.ico',
  '/manifest.json',
];

// API cache durations (in seconds)
const API_CACHE_DURATIONS = {
  '/api/recommendations/latest': 5 * 60, // 5 minutes
  '/api/recommendations/history': 60 * 60, // 60 minutes
  '/api/monitoring/model-performance': 10 * 60, // 10 minutes
  '/api/monitoring/costs': 30 * 60, // 30 minutes
  '/api/monitoring/data-quality': 60 * 60, // 60 minutes
  '/api/monitoring/drift': 30 * 60, // 30 minutes
  '/api/explainability': 60 * 60, // 60 minutes
  '/s3-proxy': 120 * 60, // 2 hours — price data changes once per day
  '/notifications': 5 * 60, // 5 minutes
  '/auth/me': 2 * 60, // 2 minutes
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.error('[Service Worker] Failed to cache static assets:', error);
        // Don't fail installation if some assets fail to cache
        return Promise.resolve();
      });
    })
  );
  
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle API requests (both /api/ and external API gateway)
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/s3-proxy') || url.pathname.includes('/notifications') || url.pathname.includes('/auth/')) {
    event.respondWith(handleAPIRequest(request));
    return;
  }
  
  // Handle static assets
  event.respondWith(handleStaticRequest(request));
});

/**
 * Handle API requests with cache-first strategy
 */
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  const cacheDuration = getCacheDuration(url.pathname);
  
  try {
    // Try cache first
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      const cachedDate = new Date(cachedResponse.headers.get('sw-cached-date'));
      const age = (Date.now() - cachedDate.getTime()) / 1000;
      
      // Return cached response if not expired
      if (age < cacheDuration) {
        console.log('[Service Worker] Serving API from cache:', url.pathname);
        
        // Add staleness indicator header
        const headers = new Headers(cachedResponse.headers);
        headers.set('X-Cache-Status', 'HIT');
        headers.set('X-Cache-Age', Math.floor(age).toString());
        
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers,
        });
      }
    }
    
    // Fetch from network
    console.log('[Service Worker] Fetching API from network:', url.pathname);
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-date', new Date().toISOString());
      
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers,
      });
      
      cache.put(request, cachedResponse);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] API request failed:', error);
    
    // Try to serve stale cache if offline
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('[Service Worker] Serving stale API cache (offline):', url.pathname);
      
      // Add offline indicator header
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Cache-Status', 'STALE');
      headers.set('X-Offline', 'true');
      
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers,
      });
    }
    
    // Return offline response
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'You are offline and no cached data is available',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Handle static asset requests with cache-first strategy
 */
async function handleStaticRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[Service Worker] Serving static from cache:', request.url);
      return cachedResponse;
    }
    
    // Fetch from network
    console.log('[Service Worker] Fetching static from network:', request.url);
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Static request failed:', error);
    
    // Try cache again
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match(OFFLINE_PAGE);
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    // Return generic offline response
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Get cache duration for API endpoint
 */
function getCacheDuration(pathname) {
  for (const [pattern, duration] of Object.entries(API_CACHE_DURATIONS)) {
    if (pathname.includes(pattern)) {
      return duration;
    }
  }
  // Default to 5 minutes
  return 5 * 60;
}

/**
 * Message handler for cache management
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});
