// Service Worker for Unified Tracker PWA
const CACHE_NAME = 'unified-tracker-v1.0.0';
const OFFLINE_CACHE = 'unified-tracker-offline-v1.0.0';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/test.html',
  '/manifest.json',
  // CDN resources
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Inter:wght@400;600;900&family=JetBrains+Mono:wght@400;700&display=swap'
];

// Firebase CDN resources
const FIREBASE_ASSETS = [
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      caches.open(OFFLINE_CACHE).then((cache) => {
        console.log('Service Worker: Caching Firebase assets');
        return cache.addAll(FIREBASE_ASSETS);
      })
    ]).then(() => {
      console.log('Service Worker: Installation complete');
      self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== OFFLINE_CACHE) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation complete');
      self.clients.claim();
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip Firebase API calls (let them fail gracefully when offline)
  if (event.request.url.includes('firebaseio.com') || 
      event.request.url.includes('googleapis.com/identitytoolkit')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached version if available
      if (cachedResponse) {
        return cachedResponse;
      }

      // Try to fetch from network
      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache the new response
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Network failed, try to serve offline fallback
        if (event.request.destination === 'document') {
          return caches.match('/test.html');
        }
      });
    })
  );
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

// Sync offline data when connection is restored
async function syncOfflineData() {
  try {
    console.log('Service Worker: Syncing offline data...');
    
    // Get offline data from IndexedDB
    const offlineData = await getOfflineData();
    
    if (offlineData.length > 0) {
      // Send message to main thread to sync data
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_OFFLINE_DATA',
          data: offlineData
        });
      });
    }
  } catch (error) {
    console.error('Service Worker: Sync failed:', error);
  }
}

// Get offline data from IndexedDB
function getOfflineData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('UnifiedTrackerOffline', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['offlineQueue'], 'readonly');
      const store = transaction.objectStore('offlineQueue');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('offlineQueue')) {
        db.createObjectStore('offlineQueue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Push notification support
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: 'https://i.postimg.cc/TYHBdFH8/Gemini-Generated-Image-hf8x9dhf8x9dhf8x.png',
      badge: 'https://i.postimg.cc/TYHBdFH8/Gemini-Generated-Image-hf8x9dhf8x9dhf8x.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      actions: [
        {
          action: 'open',
          title: 'Open App',
          icon: 'https://i.postimg.cc/TYHBdFH8/Gemini-Generated-Image-hf8x9dhf8x9dhf8x.png'
        },
        {
          action: 'close',
          title: 'Close'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('Service Worker: Loaded successfully');
