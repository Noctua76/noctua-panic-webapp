const API_BASE_URL = "https://noctua-panic-backend-production.up.railway.app";

let serviceWorkerRegistration = null;

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service Workers are not supported.");
    return null;
  }

  try {
    serviceWorkerRegistration = await navigator.serviceWorker.register(
      "./service-worker.js"
    );

    console.log("Service Worker registered.");

    return serviceWorkerRegistration;
  } catch (err) {
    console.error("Service Worker registration failed:", err);
    return null;
  }
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("Notifications are not supported.");
    return false;
  }

  const permission = await Notification.requestPermission();

  return permission === "granted";
}

async function getVapidKey() {
  const response = await fetch(`${API_BASE_URL}/push/vapid-public-key`);
  const data = await response.json();

  if (data.status !== "ok") {
    throw new Error("Unable to retrieve VAPID key.");
  }

  return data.publicKey;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function subscribeDevice() {
  if (!serviceWorkerRegistration) {
    throw new Error("Service Worker registration is missing.");
  }

  if (!("PushManager" in window)) {
    console.warn("Push Messaging is not supported.");
    return null;
  }

  const existingSubscription =
    await serviceWorkerRegistration.pushManager.getSubscription();

  if (existingSubscription) {
    console.log("Existing push subscription found.");
    return existingSubscription;
  }

  const publicKey = await getVapidKey();

  const applicationServerKey = urlBase64ToUint8Array(publicKey);

  const newSubscription =
    await serviceWorkerRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

  console.log("New push subscription created.");

  return newSubscription;
}

async function sendSubscriptionToBackend(subscription, guardSession) {
  if (!subscription) {
    console.warn("No push subscription to send.");
    return false;
  }

  if (!guardSession?.guard?.id || !guardSession?.session?.id) {
    console.warn("Guard session is missing. Push subscription was not sent.");
    return false;
  }

  const payload = {
    subscription,
    guard_id: guardSession.guard.id,
    session_id: guardSession.session.id,
    user_agent: navigator.userAgent,
    device_name: "Web PWA",
  };

  try {
    const response = await fetch(`${API_BASE_URL}/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.status !== "ok") {
      console.error("Push subscription backend save failed:", data);
      return false;
    }

    console.log("Push subscription saved to backend.");

    return true;
  } catch (err) {
    console.error("Failed sending push subscription to backend:", err);
    return false;
  }
}

async function renewSubscription() {}

async function unsubscribe() {}

export async function initializePushNotifications() {
  console.log("Initializing Push Notifications...");
}