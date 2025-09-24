import {
  corsHeaders,
  dispatchPushEvent,
  registerDeviceToken,
  unregisterDeviceToken
} from '../../server/src/push.ts';

type ConnectionParams = {
  pairId: string;
  userId: string;
};

type TextInboundMessage = {
  type: 'text';
  content: string;
  id?: string;
  timestamp?: number;
};

type HeartbeatInboundMessage = {
  type: 'heartbeat';
  timestamp?: number;
};

type AlarmInboundMessage = {
  type: 'alarm';
  level: 'default' | 'urgent';
  note?: string;
};

type ReceiptInboundMessage = {
  type: 'receipt';
  messageId: string;
  status: 'received' | 'read';
};

type StatusInboundMessage = {
  type: 'status';
  presence: 'available' | 'busy' | 'away';
  note?: string;
};

type InboundMessage =
  | TextInboundMessage
  | HeartbeatInboundMessage
  | AlarmInboundMessage
  | ReceiptInboundMessage
  | StatusInboundMessage;

type PairId = string;
type UserId = string;
type PairSockets = Map<UserId, WebSocket>;

type BaseOutboundMessage =
  | { type: 'text'; from: string; content: string; id: string; timestamp: number }
  | { type: 'alarm'; from: string; level: 'default' | 'urgent'; note?: string; timestamp: number }
  | { type: 'receipt'; from: string; messageId: string; status: 'received' | 'read'; timestamp: number }
  | { type: 'status'; from: string; presence: 'available' | 'busy' | 'away'; note?: string; timestamp: number };

type DeliverableMessage = Extract<BaseOutboundMessage, { type: 'text' | 'alarm' | 'receipt' }>;

type OutboundMessage =
  | BaseOutboundMessage
  | { type: 'system'; event: 'connected'; pairId: string; partnerOnline: boolean }
  | { type: 'system'; event: 'queued'; pairId: string; messageId?: string; reason: 'partner_offline' }
  | { type: 'system'; event: 'queue_flushed'; pairId: string; delivered: number }
  | { type: 'system'; event: 'heartbeat'; pairId: string; timestamp: number }
  | { type: 'error'; message: string };

const activePairs = new Map<PairId, PairSockets>();
const pendingQueues = new Map<PairId, DeliverableMessage[]>();

function safeParseJson(payload: string): unknown | undefined {
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

function createMessageId(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function getOrCreatePair(pairId: PairId): PairSockets {
  let sockets = activePairs.get(pairId);
  if (!sockets) {
    sockets = new Map<UserId, WebSocket>();
    activePairs.set(pairId, sockets);
  }
  return sockets;
}

function sendJson(socket: WebSocket, payload: OutboundMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function notifyPartner(pairId: PairId, senderId: UserId, payload: OutboundMessage): boolean {
  const sockets = activePairs.get(pairId);
  if (!sockets) {
    return false;
  }

  let delivered = false;
  for (const [userId, socket] of sockets.entries()) {
    if (userId === senderId) {
      continue;
    }
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      delivered = true;
    }
  }

  return delivered;
}

function cleanupSocket(pairId: PairId, userId: UserId): void {
  const sockets = activePairs.get(pairId);
  if (!sockets) {
    return;
  }

  sockets.delete(userId);
  if (sockets.size === 0) {
    activePairs.delete(pairId);
  }
}

function enqueuePendingMessage(pairId: PairId, message: DeliverableMessage): void {
  const queue = pendingQueues.get(pairId);
  if (queue) {
    queue.push(message);
    return;
  }
  pendingQueues.set(pairId, [message]);
}

function flushPendingMessages(pairId: PairId, userId: UserId): number {
  const queue = pendingQueues.get(pairId);
  if (!queue?.length) {
    return 0;
  }

  const sockets = activePairs.get(pairId);
  const recipient = sockets?.get(userId);
  if (!recipient || recipient.readyState !== WebSocket.OPEN) {
    return 0;
  }

  const remaining: DeliverableMessage[] = [];
  let delivered = 0;

  for (const message of queue) {
    if (message.from === userId) {
      remaining.push(message);
      continue;
    }
    sendJson(recipient, message);
    delivered += 1;
  }

  if (remaining.length > 0) {
    pendingQueues.set(pairId, remaining);
  } else {
    pendingQueues.delete(pairId);
  }

  return delivered;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseConnectionParams(url: URL): ConnectionParams | null {
  const pairId = url.searchParams.get('pairId');
  const userId = url.searchParams.get('userId');
  if (!pairId || !userId) {
    return null;
  }
  return { pairId, userId };
}

function parseInboundMessage(raw: string): InboundMessage | null {
  const parsedJson = safeParseJson(raw);
  if (!parsedJson || typeof parsedJson !== 'object') {
    return null;
  }

  const record = parsedJson as Record<string, unknown>;
  const type = record.type;
  if (type !== 'text' && type !== 'heartbeat' && type !== 'alarm' && type !== 'receipt' && type !== 'status') {
    return null;
  }

  switch (type) {
    case 'text': {
      const content = record.content;
      if (typeof content !== 'string' || content.trim() === '') {
        return null;
      }
      const message: TextInboundMessage = { type: 'text', content };
      if (record.id !== undefined) {
        if (typeof record.id !== 'string') {
          return null;
        }
        message.id = record.id;
      }
      if (record.timestamp !== undefined) {
        if (!isFiniteNumber(record.timestamp)) {
          return null;
        }
        message.timestamp = record.timestamp;
      }
      return message;
    }
    case 'heartbeat': {
      const message: HeartbeatInboundMessage = { type: 'heartbeat' };
      if (record.timestamp !== undefined) {
        if (!isFiniteNumber(record.timestamp)) {
          return null;
        }
        message.timestamp = record.timestamp;
      }
      return message;
    }
    case 'alarm': {
      const note = record.note;
      if (note !== undefined && typeof note !== 'string') {
        return null;
      }
      const level = record.level === 'urgent' ? 'urgent' : 'default';
      const message: AlarmInboundMessage = { type: 'alarm', level };
      if (typeof note === 'string') {
        message.note = note;
      }
      return message;
    }
    case 'receipt': {
      const messageId = record.messageId;
      if (typeof messageId !== 'string' || messageId.trim() === '') {
        return null;
      }
      let status: 'received' | 'read' = 'read';
      if (record.status === 'received' || record.status === 'read') {
        status = record.status;
      }
      return { type: 'receipt', messageId, status };
    }
    case 'status': {
      const presence = record.presence;
      if (presence !== 'available' && presence !== 'busy' && presence !== 'away') {
        return null;
      }
      const message: StatusInboundMessage = { type: 'status', presence };
      if (record.note !== undefined) {
        if (typeof record.note !== 'string') {
          return null;
        }
        message.note = record.note;
      }
      return message;
    }
  }

  return null;
}

function decodeEventData(data: unknown): string | null {
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data.buffer);
  }
  return null;
}

function handleSocketMessage(pairId: PairId, userId: UserId, socket: WebSocket, raw: string): void {
  const message = parseInboundMessage(raw);
  if (!message) {
    sendJson(socket, { type: 'error', message: 'Unable to parse incoming message as JSON' });
    return;
  }

  const timestamp = Date.now();

  switch (message.type) {
    case 'text': {
      const messageId = message.id ?? createMessageId();
      const outbound: OutboundMessage = {
        type: 'text',
        from: userId,
        content: message.content,
        id: messageId,
        timestamp
      };
      const delivered = notifyPartner(pairId, userId, outbound);
      sendJson(socket, outbound);
      if (!delivered) {
        enqueuePendingMessage(pairId, outbound);
        sendJson(socket, {
          type: 'system',
          event: 'queued',
          pairId,
          messageId,
          reason: 'partner_offline'
        });
      }
      void dispatchPushEvent({
        type: 'text',
        pairId,
        senderId: userId,
        messageId,
        content: message.content,
        timestamp
      });
      break;
    }
    case 'receipt': {
      const outbound: OutboundMessage = {
        type: 'receipt',
        from: userId,
        messageId: message.messageId,
        status: message.status,
        timestamp
      };
      const delivered = notifyPartner(pairId, userId, outbound);
      if (!delivered) {
        enqueuePendingMessage(pairId, outbound);
        sendJson(socket, {
          type: 'system',
          event: 'queued',
          pairId,
          messageId: message.messageId,
          reason: 'partner_offline'
        });
      }
      break;
    }
    case 'alarm': {
      const outbound: OutboundMessage = {
        type: 'alarm',
        from: userId,
        level: message.level,
        note: message.note,
        timestamp
      };
      const delivered = notifyPartner(pairId, userId, outbound);
      if (!delivered) {
        enqueuePendingMessage(pairId, outbound);
        sendJson(socket, {
          type: 'system',
          event: 'queued',
          pairId,
          reason: 'partner_offline'
        });
      }
      void dispatchPushEvent({
        type: 'alarm',
        pairId,
        senderId: userId,
        level: message.level,
        note: message.note,
        timestamp
      });
      break;
    }
    case 'heartbeat': {
      sendJson(socket, {
        type: 'system',
        event: 'heartbeat',
        pairId,
        timestamp
      });
      break;
    }
    case 'status': {
      const outbound: OutboundMessage = {
        type: 'status',
        from: userId,
        presence: message.presence,
        note: message.note,
        timestamp
      };
      notifyPartner(pairId, userId, outbound);
      break;
    }
  }
}

function registerSocket(pairId: PairId, userId: UserId, socket: WebSocket): void {
  const sockets = getOrCreatePair(pairId);
  sockets.set(userId, socket);

  const partnerOnline = Array.from(sockets.keys()).some((id) => id !== userId);

  sendJson(socket, {
    type: 'system',
    event: 'connected',
    pairId,
    partnerOnline
  });

  const flushed = flushPendingMessages(pairId, userId);
  if (flushed > 0) {
    sendJson(socket, {
      type: 'system',
      event: 'queue_flushed',
      pairId,
      delivered: flushed
    });
  }
}

function handleWebSocket(request: Request, url: URL): Response {
  const params = parseConnectionParams(url);
  if (!params) {
    return new Response(JSON.stringify({ error: 'Missing pairId or userId in connection string' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const upgradeHeader = request.headers.get('upgrade') ?? '';
  if (upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 400 });
  }

  const { pairId, userId } = params;

  const { 0: clientSocket, 1: bridgeSocket } = new WebSocketPair();
  const serverSocket = bridgeSocket as WebSocket;
  serverSocket.accept();

  registerSocket(pairId, userId, serverSocket);

  serverSocket.addEventListener('message', (event) => {
    const decoded = decodeEventData(event.data);
    if (decoded === null) {
      sendJson(serverSocket, { type: 'error', message: 'Unsupported payload type' });
      return;
    }
    handleSocketMessage(pairId, userId, serverSocket, decoded);
  });

  const closeHandler = () => {
    cleanupSocket(pairId, userId);
  };

  serverSocket.addEventListener('close', closeHandler);
  serverSocket.addEventListener('error', (event) => {
    console.error(`Socket error for ${pairId}/${userId}:`, event);
    cleanupSocket(pairId, userId);
  });

  return new Response(null, { status: 101, webSocket: clientSocket });
}

async function handleDeviceRegistration(request: Request): Promise<Response> {
  const origin = request.headers.get('origin') ?? undefined;
  const headers = corsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json', Allow: 'POST,DELETE,OPTIONS' }
    });
  }

  let payload: Partial<{ pairId: string; userId: string; token: string; platform?: 'android' | 'ios' | 'web' }> = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }

  const { pairId, userId, token, platform } = payload;
  if (!pairId || !userId || !token) {
    return new Response(JSON.stringify({ error: 'pairId, userId and token are required' }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'POST') {
    registerDeviceToken({ pairId, userId, token, platform });
  } else {
    unregisterDeviceToken({ pairId, userId, token, platform });
  }

  return new Response(null, { status: 204, headers });
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/healthz') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (url.pathname === '/register-device') {
    return handleDeviceRegistration(request);
  }

  if (url.pathname === '/bridge') {
    return handleWebSocket(request, url);
  }

  return new Response('Not found', { status: 404 });
}
