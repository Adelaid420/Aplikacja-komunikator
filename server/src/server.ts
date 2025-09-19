import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  ConnectionParams,
  OutboundMessage,
  connectionParamsSchema,
  createMessageId,
  inboundMessageSchema,
  safeParseJson
} from './protocol.js';
import type { RegisterDeviceInput } from './push.js';
import { corsHeaders, dispatchPushEvent, registerDeviceToken, unregisterDeviceToken } from './push.js';

const port = Number(process.env.PORT ?? 8080);

const httpServer = createServer((req, res) => {
  const host = req.headers.host ?? 'localhost';
  const url = req.url ? new URL(req.url, `http://${host}`) : null;

  if (url?.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (url?.pathname === '/register-device') {
    void handleDeviceRegistration(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

type PairId = string;
type UserId = string;
type PairSockets = Map<UserId, WebSocket>;

type DeliverableMessage = Extract<OutboundMessage, { type: 'text' | 'alarm' | 'receipt' }>;

const activePairs = new Map<PairId, PairSockets>();
const pendingQueues = new Map<PairId, DeliverableMessage[]>();

function getOrCreatePair(pairId: PairId): PairSockets {
  let sockets = activePairs.get(pairId);
  if (!sockets) {
    sockets = new Map<UserId, WebSocket>();
    activePairs.set(pairId, sockets);
  }
  return sockets;
}

function parseConnectionParams(req: IncomingMessage): ConnectionParams | null {
  if (!req.url) {
    return null;
  }

  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url, `http://${host}`);
  const params = Object.fromEntries(url.searchParams.entries());
  const parsed = connectionParamsSchema.safeParse(params);
  return parsed.success ? parsed.data : null;
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

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const cleanup = () => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      req.removeListener('aborted', onAborted);
    };

    const onData = (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    };

    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks).toString('utf-8'));
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onAborted = () => {
      cleanup();
      reject(new Error('Request aborted'));
    };

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('aborted', onAborted);
  });
}

async function handleDeviceRegistration(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = req.headers.origin;
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.writeHead(405, { ...headers, Allow: 'POST,DELETE,OPTIONS', 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let payload: Partial<RegisterDeviceInput> = {};
  try {
    const raw = await readRequestBody(req);
    payload = raw ? (JSON.parse(raw) as Partial<RegisterDeviceInput>) : {};
  } catch (error) {
    res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
    return;
  }

  const { pairId, userId, token, platform } = payload;
  if (!pairId || !userId || !token) {
    res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'pairId, userId and token are required' }));
    return;
  }

  if (req.method === 'POST') {
    registerDeviceToken({ pairId, userId, token, platform });
  } else {
    unregisterDeviceToken({ pairId, userId, token, platform });
  }

  res.writeHead(204, headers);
  res.end();
}

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (socket, req) => {
  const params = parseConnectionParams(req);
  if (!params) {
    sendJson(socket, { type: 'error', message: 'Missing pairId or userId in connection string' });
    socket.close();
    return;
  }

  const { pairId, userId } = params;
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

  socket.on('message', (data) => {
    const parsedJson = typeof data === 'string' ? safeParseJson(data) : safeParseJson(data.toString());
    if (parsedJson === undefined) {
      sendJson(socket, { type: 'error', message: 'Unable to parse incoming message as JSON' });
      return;
    }

    const parsedMessage = inboundMessageSchema.safeParse(parsedJson);
    if (!parsedMessage.success) {
      sendJson(socket, { type: 'error', message: parsedMessage.error.errors.map((err) => err.message).join(', ') });
      return;
    }

    const message = parsedMessage.data;
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
  });

  socket.on('close', () => {
    cleanupSocket(pairId, userId);
  });

  socket.on('error', (error) => {
    console.error(`Socket error for ${pairId}/${userId}:`, error);
    cleanupSocket(pairId, userId);
  });
});

httpServer.listen(port, () => {
  console.log(`Real-time bridge listening on http://localhost:${port}`);
});
