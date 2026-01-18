import webpush from 'web-push';
import { storage } from './storage';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@u-sistem.space';

let pushEnabled = false;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  pushEnabled = true;
  console.log('[Push] VAPID keys configured successfully');
} else {
  console.warn('[Push] VAPID keys not configured. Push notifications disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.');
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY || "";
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export async function sendPushNotification(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: PushPayload
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint,
        keys: { p256dh, auth },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (error: any) {
    console.error('Push notification error:', error);
    if (error.statusCode === 410 || error.statusCode === 404) {
      await storage.deletePushSubscription(endpoint);
      console.log('Removed stale subscription:', endpoint);
    }
    return false;
  }
}

export async function sendNotificationToAllAdmins(payload: PushPayload): Promise<number> {
  const subscriptions = await storage.getAllPushSubscriptions();
  let sentCount = 0;
  
  for (const sub of subscriptions) {
    const success = await sendPushNotification(sub.endpoint, sub.p256dh, sub.auth, payload);
    if (success) sentCount++;
  }
  
  return sentCount;
}

export async function checkAndSendRecordNotifications(): Promise<void> {
  try {
    const recordsToNotify = await storage.getRecordsNeedingNotification();
    
    if (recordsToNotify.length === 0) {
      return;
    }

    console.log(`[Push] Found ${recordsToNotify.length} records needing notification`);

    for (const record of recordsToNotify) {
      const payload: PushPayload = {
        title: 'Напоминание о записи',
        body: `${record.client.fullName} - ${record.service.name} в ${record.time}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `record-${record.id}`,
        data: {
          recordId: record.id,
          date: record.date,
          url: `/day/${record.date}`,
        },
      };

      const sentCount = await sendNotificationToAllAdmins(payload);
      
      if (sentCount > 0) {
        await storage.markRecordNotified(record.id);
        console.log(`[Push] Sent notification for record ${record.id} to ${sentCount} devices`);
      }
    }
  } catch (error) {
    console.error('[Push] Error checking/sending notifications:', error);
  }
}
