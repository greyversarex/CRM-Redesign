import webpush from 'web-push';
import { storage } from './storage';
import type { RecordWithRelations } from '@shared/schema';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BI8hYwp8OrsIbzXLTjPCgfl10j4tfKFOwNwyBeFBL_zDSZ6huurYQrtZLBWMuXDdOUpjfl6bV1ymz_-hgzQhULQ';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '6wnUZS3YphedrrPhetCEa-JWnHXZd9xjcTzMUBmXWE4';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@u-sistem.space';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
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
