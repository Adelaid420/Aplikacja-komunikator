import WebSocket from 'ws';
import { createInterface } from 'node:readline';

interface CliOptions {
  pairId: string;
  userId: string;
  port: number;
  text?: string;
  alarm?: 'default' | 'urgent';
  status?: 'available' | 'busy' | 'away';
  note?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || !value) {
      continue;
    }
    args.set(key.slice(2), value);
  }

  const pairId = args.get('pair') ?? 'demo';
  const userId = args.get('user') ?? 'alice';
  const port = Number(args.get('port') ?? 8080);
  const text = args.get('text');
  const alarm = args.get('alarm') as CliOptions['alarm'];
  const status = args.get('status') as CliOptions['status'];
  const note = args.get('note');

  return { pairId, userId, port, text, alarm, status, note };
}

const options = parseArgs(process.argv.slice(2));

const ws = new WebSocket(`ws://localhost:${options.port}?pairId=${options.pairId}&userId=${options.userId}`);

let lastPartnerMessageId: string | undefined;

ws.on('open', () => {
  console.log(`Connected as ${options.userId} (pair: ${options.pairId})`);

  if (options.text) {
    ws.send(JSON.stringify({ type: 'text', content: options.text }));
  }

  if (options.alarm) {
    ws.send(JSON.stringify({ type: 'alarm', level: options.alarm, note: options.note }));
  }

  if (options.status) {
    ws.send(JSON.stringify({ type: 'status', presence: options.status, note: options.note }));
  }

  if (!options.text && !options.alarm && !options.status) {
    console.log('Tryb interaktywny. Pisz wiadomość i naciśnij enter albo użyj komend /alarm, /status lub /read.');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.on('line', (line) => {
      if (!line.trim()) {
        return;
      }
      if (line.startsWith('/alarm')) {
        const [, level = 'default', ...rest] = line.split(' ');
        ws.send(JSON.stringify({ type: 'alarm', level, note: rest.join(' ') || undefined }));
        return;
      }
      if (line.startsWith('/status')) {
        const [, presence = 'available', ...rest] = line.split(' ');
        ws.send(JSON.stringify({ type: 'status', presence, note: rest.join(' ') || undefined }));
        return;
      }
      if (line.startsWith('/read')) {
        const [, maybeId, maybeStatus] = line.split(' ');
        const messageId = maybeId || lastPartnerMessageId;
        if (!messageId) {
          console.log('Brak ID wiadomości do potwierdzenia. Najpierw odbierz wiadomość lub podaj ID.');
          return;
        }
        const status = maybeStatus === 'received' ? 'received' : 'read';
        ws.send(JSON.stringify({ type: 'receipt', messageId, status }));
        return;
      }
      ws.send(JSON.stringify({ type: 'text', content: line }));
    });
  }
});

ws.on('message', (data) => {
  const text = data.toString();
  console.log('⟶ ', text);
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.type === 'text' && parsed.from && parsed.from !== options.userId && typeof parsed.id === 'string') {
      lastPartnerMessageId = parsed.id;
    }
  } catch (error) {
    // Ignorujemy niepoprawne JSON-y (np. gdy serwer wyśle zwykły tekst diagnostyczny).
  }
});

ws.on('close', () => {
  console.log('Connection closed');
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('Socket error', error);
});
