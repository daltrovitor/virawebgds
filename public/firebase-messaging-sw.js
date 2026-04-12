importScripts('https://www.gstatic.com/firebasejs/10.11.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.1/firebase-messaging-compat.js');

// These are placeholders. You MUST replace them with your ACTUAL config from Firebase Console
firebase.initializeApp({
  apiKey: "AIzaSyA7Kbin-8UbOMkZzVzEg6D-nFhoB_KPk6s",
  authDomain: "viraweb-notifications.firebaseapp.com",
  projectId: "viraweb-notifications",
  storageBucket: "viraweb-notifications.firebasestorage.app",
  messagingSenderId: "808457823186",
  appId: "1:808457823186:web:3956755383760b7a70de0b"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const data = payload.data || {};
  const notificationTitle = data.title || 'Notificação';
  const targetUrl = data.url || '/';

  // Domain filtering logic
  if (targetUrl.startsWith('http')) {
    try {
      const targetDomain = new URL(targetUrl).hostname;
      // If the notification is explicitly aimed at a different domain, ignore it.
      if (targetDomain !== self.location.hostname) {
        console.log(`[SW] Ignoring notification destined for ${targetDomain} (we are on ${self.location.hostname})`);
        return;
      }
    } catch(e) {
      console.error('[SW] Error parsing target URL for domain check', e);
    }
  }

  if (payload.notification) {
      console.log('[SW] FCM handled notification automatically. Skipping manual display.');
      return;
  }

  const notificationOptions = {
    body: data.body || '',
    icon: data.icon || '/viraweb6.png',
    data: {
        url: targetUrl
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
