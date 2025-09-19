import { createServer } from 'node:http';
import { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  ConnectionParams,
  OutboundMessage,
  connectionParamsSchema,
  createMessageId,
  inboundMessageSchema,
  safeParseJson
} from './protocol.js';

const port = Number(process.env.PORT ?? 8080);

const httpServer = createServer((req, res) => {
  if (req.url?.startsWith('/healthz')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

type PairId = string;
type UserId = string;
type PairSockets = Map<UserId, WebSocket>;

const activePairs = new Map<PairId, PairSockets>();

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
        const outbound: OutboundMessage = {
          type: 'text',
          from: userId,
          content: message.content,
          id: message.id ?? createMessageId(),
          timestamp
        };
        const delivered = notifyPartner(pairId, userId, outbound);
        if (!delivered) {
          sendJson(socket, { type: 'error', message: 'Partner is offline. Message queued locally.' });
        } else {
          sendJson(socket, outbound);
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
          sendJson(socket, { type: 'error', message: 'Partner is offline. Alarm not delivered.' });
        }
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
