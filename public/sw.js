self.addEventListener('push', function (event) {
    if (!event.data) return;

    try {
        const payload = event.data.json();
        const { title, body, icon, url, timestamp } = payload;

        const options = {
            body: body || '',
            icon: icon || '/aira-logo.png', // Ensure this exists or use fallback
            badge: '/aira-logo.png',
            vibrate: [100, 50, 100],
            data: {
                url: url || '/',
                timestamp: timestamp || Date.now()
            },
            actions: [
                { action: 'open', title: 'Ver agora' },
                { action: 'close', title: 'Fechar' }
            ]
        };

        event.waitUntil(
            self.registration.showNotification(title || 'ViraWeb Notification', options)
        );
    } catch (err) {
        console.error('Error parsing push payload:', err);
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    if (event.action === 'close') return;

    const urlToOpen = event.notification.data.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
