self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'Trippy Notification';
      const options = {
        body: data.body || 'You have a new update.',
        icon: '/window.svg', // using an existing icon as fallback for now
        badge: '/window.svg',
        data: {
          url: data.url || '/'
        }
      };
      
      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      console.error('Push event data is not valid JSON', e);
      event.waitUntil(self.registration.showNotification('Trippy', {
        body: event.data.text()
      }));
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const urlToOpen = event.notification.data && event.notification.data.url 
    ? event.notification.data.url 
    : '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Find if we already have a Trippy tab open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          // Ideally we would navigate the client to urlToOpen here, 
          // but for SPAs it might just be better to focus the tab
          // client.navigate(urlToOpen) might trigger a full reload.
          // Let's navigate to ensure they land on the right page if needed.
          if (client.url !== new URL(urlToOpen, self.location.origin).href) {
              return client.navigate(urlToOpen);
          }
          return;
        }
      }
      // If not open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
