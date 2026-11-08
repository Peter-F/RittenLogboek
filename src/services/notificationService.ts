import { WeekdayReminder } from '../types';

export type PushPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

let swRegistration: ServiceWorkerRegistration | null = null;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register Service Worker for PWA and Push Notifications
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;
    return reg;
  } catch (error) {
    console.warn('Service worker registration failed:', error);
    return null;
  }
}

/**
 * Check current notification permission
 */
export function getNotificationPermissionStatus(): PushPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as PushPermissionStatus;
}

/**
 * Register the smartphone/browser PushSubscription with the backend server (Step 2)
 */
export async function subscribeDeviceToPushServer(
  userId?: string,
  schedules?: WeekdayReminder[]
): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const reg = swRegistration || (await navigator.serviceWorker.ready);
    if (!reg || !('pushManager' in reg)) {
      return false;
    }

    // Get VAPID public key from backend
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) {
      console.warn('Could not fetch VAPID key from server');
      return false;
    }
    const { publicKey } = await res.json();
    if (!publicKey) return false;

    // Check existing subscription or create new
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
    }

    // Send subscription to server background service
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId || 'anonymous',
        subscription: sub.toJSON(),
        schedules: schedules || [],
        userAgent: navigator.userAgent,
      }),
    });

    return true;
  } catch (error) {
    console.warn('Push subscription to server failed:', error);
    return false;
  }
}

/**
 * Sync schedules with background service
 */
export async function syncSchedulesWithServer(
  userId: string,
  schedules: WeekdayReminder[]
): Promise<void> {
  try {
    await fetch('/api/push/sync-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, schedules }),
    });
  } catch (err) {
    console.warn('Could not sync schedules with server:', err);
  }
}

/**
 * Request notification permission from user and enroll in background push service
 */
export async function requestNotificationPermission(
  userId?: string,
  schedules?: WeekdayReminder[]
): Promise<PushPermissionStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted' && 'serviceWorker' in navigator) {
      await registerServiceWorker();
      await subscribeDeviceToPushServer(userId, schedules);
    }
    return permission as PushPermissionStatus;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return getNotificationPermissionStatus();
  }
}

/**
 * Display a push notification via Service Worker (or fallback to Notification API)
 */
export async function showPushNotification(options: {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const notificationOptions: NotificationOptions = {
    body: options.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: options.tag || 'wagenrit-reminder',
    data: {
      url: options.url || '/',
    },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = swRegistration || (await navigator.serviceWorker.ready);
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(options.title, notificationOptions);
        return true;
      }
    }

    // Direct desktop/mobile fallback if SW not active
    new Notification(options.title, notificationOptions);
    return true;
  } catch (error) {
    console.error('Error displaying notification:', error);
    return false;
  }
}

/**
 * Exact reminder requested by user:
 * "Tijd voor vertrek! Vergeet je startkilometerstand voor je gebruikte wagen niet te noteren."
 */
export async function sendDepartureReminder(): Promise<boolean> {
  return showPushNotification({
    title: 'WagenRit • Tijd voor vertrek!',
    body: 'Tijd voor vertrek! Vergeet je startkilometerstand voor je gebruikte wagen niet te noteren.',
    tag: 'departure-reminder',
    url: '/?action=new_trip',
  });
}

/**
 * Evening stop reminder
 */
export async function sendStopReminder(): Promise<boolean> {
  return showPushNotification({
    title: 'WagenRit • Einde werkdag',
    body: 'Einde van de werkdag! Vergeet je stopkilometerstand voor je gebruikte wagen niet te noteren.',
    tag: 'stop-reminder',
    url: '/?action=stop_trip',
  });
}

/**
 * Send real test notification from server background service (Step 2)
 */
export async function sendServerTestPush(userId?: string): Promise<boolean> {
  try {
    const reg = swRegistration || (await navigator.serviceWorker.ready);
    let sub = reg && 'pushManager' in reg ? await reg.pushManager.getSubscription() : null;

    const res = await fetch('/api/push/send-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        subscription: sub ? sub.toJSON() : undefined,
      }),
    });

    if (res.ok) {
      return true;
    }
  } catch (err) {
    console.warn('Server push test failed, falling back to local service worker:', err);
  }

  // Graceful fallback to client showPushNotification
  return sendDepartureReminder();
}

/**
 * In-app background scheduler ticker that checks weekly reminders every minute
 * and triggers push notifications at the configured weekday and time (e.g. maandag om 7:30).
 */
export function startReminderWatcher(
  getSchedules: () => WeekdayReminder[],
  onTriggered?: (type: 'start' | 'stop', time: string) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const checkReminders = async () => {
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;
    const todayDateKey = now.toISOString().split('T')[0];

    const schedules = getSchedules();
    const currentDaySchedule = schedules.find(
      (s) => s.dayOfWeek === currentDayOfWeek && s.isActive
    );

    if (!currentDaySchedule) return;

    // Check Start Time reminder
    const startTriggerKey = `wagenrit_notif_start_${todayDateKey}_${currentDaySchedule.startTime}`;
    if (
      currentDaySchedule.startTime &&
      currentDaySchedule.startTime === currentTimeStr &&
      !localStorage.getItem(startTriggerKey)
    ) {
      localStorage.setItem(startTriggerKey, 'fired');
      await sendDepartureReminder();
      if (onTriggered) onTriggered('start', currentTimeStr);
    }

    // Check Stop Time reminder
    const stopTriggerKey = `wagenrit_notif_stop_${todayDateKey}_${currentDaySchedule.stopTime}`;
    if (
      currentDaySchedule.stopTime &&
      currentDaySchedule.stopTime === currentTimeStr &&
      !localStorage.getItem(stopTriggerKey)
    ) {
      localStorage.setItem(stopTriggerKey, 'fired');
      await sendStopReminder();
      if (onTriggered) onTriggered('stop', currentTimeStr);
    }
  };

  // Run initial check and set interval every 25 seconds
  checkReminders();
  const intervalId = window.setInterval(checkReminders, 25000);

  return () => {
    window.clearInterval(intervalId);
  };
}
