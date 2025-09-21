import { OutgoingHttpHeaders } from 'node:http';

type PairId = string;
type UserId = string;

type DeviceTokenRecord = {
  token: string;
  platform?: 'android' | 'ios' | 'web';
  lastSeen: number;
};

type DeviceRegistry = Map<string, DeviceTokenRecord>;

type PairRegistry = Map<PairId, Map<UserId, DeviceRegistry>>;

const registry: PairRegistry = new Map();

export type RegisterDeviceInput = {
  pairId: PairId;
  userId: UserId;
  token: string;
  platform?: 'android' | 'ios' | 'web';
};

type NotificationTarget = {
  pairId: PairId;
  userId: UserId;
  token: string;
};

type PushBasePayload = {
  title: string;
  body: string;
  priority: 'high' | 'normal';
  data: Record<string, string>;
};

function getOrCreatePairRegistry(pairId: PairId): Map<UserId, DeviceRegistry> {
  let pair = registry.get(pairId);
  if (!pair) {
    pair = new Map<UserId, DeviceRegistry>();
    registry.set(pairId, pair);
  }
  return pair;
}

function getOrCreateDeviceRegistry(pair: Map<UserId, DeviceRegistry>, userId: UserId): DeviceRegistry {
  let devices = pair.get(userId);
  if (!devices) {
    devices = new Map<string, DeviceTokenRecord>();
    pair.set(userId, devices);
  }
  return devices;
}

export function registerDeviceToken({ pairId, userId, token, platform }: RegisterDeviceInput): void {
  const pair = getOrCreatePairRegistry(pairId);
  const devices = getOrCreateDeviceRegistry(pair, userId);
  devices.set(token, { token, platform, lastSeen: Date.now() });
}

export function unregisterDeviceToken({ pairId, userId, token }: RegisterDeviceInput): void {
  const pair = registry.get(pairId);
  if (!pair) {
    return;
  }
  const devices = pair.get(userId);
  if (!devices) {
    return;
  }
  devices.delete(token);
  if (devices.size === 0) {
    pair.delete(userId);
  }
  if (pair.size === 0) {
    registry.delete(pairId);
  }
}

function collectRecipientTargets(pairId: PairId, senderId: UserId): NotificationTarget[] {
  const pair = registry.get(pairId);
  if (!pair) {
    return [];
  }
  const targets: NotificationTarget[] = [];
  for (const [userId, devices] of pair.entries()) {
    if (userId === senderId) {
      continue;
    }
    for (const token of devices.keys()) {
      targets.push({ pairId, userId, token });
    }
  }
  return targets;
}

function chunkTargets<T>(items: T[], chunkSize: number): T[][] {
  if (items.length <= chunkSize) {
    return [items];
  }
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    result.push(items.slice(i, i + chunkSize));
  }
  return result;
}

function buildPushPayload(event: PushEvent): PushBasePayload {
  switch (event.type) {
    case 'text':
      return {
        title: `Nowa wiadomość od ${event.senderId}`,
        body: event.content,
        priority: 'normal',
        data: {
          pairId: event.pairId,
          senderId: event.senderId,
          type: 'text',
          messageId: event.messageId,
          timestamp: String(event.timestamp)
        }
      };
    case 'alarm':
      return {
        title: `Alarm od ${event.senderId}`,
        body: event.note ?? (event.level === 'urgent' ? 'Pilna prośba o kontakt!' : 'Sprawdź, co się dzieje.'),
        priority: 'high',
        data: {
          pairId: event.pairId,
          senderId: event.senderId,
          type: 'alarm',
          level: event.level,
          timestamp: String(event.timestamp)
        }
      };
  }

  const unreachable: never = event;
  return {
    title: 'Nowa aktywność',
    body: 'Sprawdź konwersację w komunikatorze Miku.',
    priority: 'normal',
    data: {
      type: 'unknown',
      timestamp: String(Date.now())
    }
  };
}

async function sendFcmBatch(targets: NotificationTarget[], payload: PushBasePayload, serverKey: string): Promise<void> {
  if (targets.length === 0) {
    return;
  }

  const registrationIds = targets.map((target) => target.token);

  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${serverKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        registration_ids: registrationIds,
        priority: payload.priority,
        notification: {
          title: payload.title,
          body: payload.body
        },
        data: payload.data
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('FCM request failed:', response.status, text);
      return;
    }

    const result = (await response.json()) as {
      results?: Array<{ message_id?: string; error?: string }>;
    };

    if (result.results) {
      result.results.forEach((entry, index) => {
        const error = entry?.error;
        if (error === 'NotRegistered' || error === 'InvalidRegistration') {
          const target = targets[index];
          unregisterDeviceToken(target);
        }
      });
    }
  } catch (error) {
    console.error('Unable to send push notification:', error);
  }
}

export type PushEvent =
  | {
      type: 'text';
      pairId: PairId;
      senderId: UserId;
      messageId: string;
      content: string;
      timestamp: number;
    }
  | {
      type: 'alarm';
      pairId: PairId;
      senderId: UserId;
      level: 'default' | 'urgent';
      note?: string;
      timestamp: number;
    };

export async function dispatchPushEvent(event: PushEvent): Promise<void> {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) {
    return;
  }
  const targets = collectRecipientTargets(event.pairId, event.senderId);
  if (targets.length === 0) {
    return;
  }

  const payload = buildPushPayload(event);
  const chunks = chunkTargets(targets, 500);
  await Promise.all(chunks.map((chunk) => sendFcmBatch(chunk, payload, serverKey)));
}

export function corsHeaders(origin: string | undefined): OutgoingHttpHeaders {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

export function hasRegisteredDevices(pairId: PairId, senderId: UserId): boolean {
  const targets = collectRecipientTargets(pairId, senderId);
  return targets.length > 0;
}
