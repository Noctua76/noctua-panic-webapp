self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: "/android-chrome-192x192.png",
    badge: "/android-chrome-192x192.png",
    vibrate: [300, 100, 300],
    tag: data.schedule_id || "patrol",
    requireInteraction: true,
    data: data,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/patrol.html";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/patrol.html")) {
          client.focus();
          return client.navigate(url);
        }
      }

      return clients.openWindow(url);
    })
  );
});