import { apiRequest } from "./queryClient";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToBase64(array: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
}

export async function isPushSupported(): Promise<boolean> {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return await Notification.requestPermission();
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!await isPushSupported()) return false;
  
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription !== null;
}

export async function subscribeToPush(): Promise<boolean> {
  try {
    if (!await isPushSupported()) {
      console.log("Push not supported");
      return false;
    }

    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      console.log("Notification permission denied");
      return false;
    }

    const response = await fetch("/api/push/public-key");
    const { publicKey } = await response.json();
    
    const registration = await navigator.serviceWorker.ready;
    
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const p256dhKey = subscription.getKey("p256dh");
    const authKey = subscription.getKey("auth");
    
    if (!p256dhKey || !authKey) {
      throw new Error("Failed to get subscription keys");
    }

    await apiRequest("POST", "/api/push/subscribe", {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: uint8ArrayToBase64(new Uint8Array(p256dhKey)),
        auth: uint8ArrayToBase64(new Uint8Array(authKey)),
      },
    });

    return true;
  } catch (error) {
    console.error("Failed to subscribe to push:", error);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await apiRequest("DELETE", "/api/push/unsubscribe", { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    }
    
    return true;
  } catch (error) {
    console.error("Failed to unsubscribe from push:", error);
    return false;
  }
}
