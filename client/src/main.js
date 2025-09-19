import './styles.css';

const connectionForm = document.getElementById('connection-form');
const connectButton = document.getElementById('connect-button');
const connectionStateEl = document.getElementById('connection-state');
const partnerStateEl = document.getElementById('partner-state');
const partnerNameInput = document.getElementById('partner-name');
const serverUrlInput = document.getElementById('server-url');
const pairIdInput = document.getElementById('pair-id');
const userIdInput = document.getElementById('user-id');
const autoConnectToggle = document.getElementById('auto-connect');
const timelineEl = document.getElementById('timeline');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const markReadButton = document.getElementById('mark-read');
const queueIndicator = document.getElementById('queue-indicator');
const alarmButton = document.getElementById('alarm-button');
const alarmLevelSelect = document.getElementById('alarm-level');
const alarmNoteInput = document.getElementById('alarm-note');
const statusButton = document.getElementById('status-button');
const statusPresenceSelect = document.getElementById('status-presence');
const statusNoteInput = document.getElementById('status-note');
const voiceToggle = document.getElementById('voice-enabled');
const voiceSelect = document.getElementById('voice-select');
const voiceSupportLabel = document.getElementById('voice-support');
const testVoiceButton = document.getElementById('test-voice');

const STORAGE_KEY = 'komunikator-settings';
const appDefaults = window.komunikator?.defaults ?? {};

function loadStoredSettings() {
  if (!('localStorage' in window)) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('Nie udało się odczytać zapamiętanych ustawień', error);
    return {};
  }
}

function gatherCurrentSettings(overrides = {}) {
  return {
    serverUrl: serverUrlInput.value.trim(),
    pairId: pairIdInput.value.trim(),
    userId: userIdInput.value.trim(),
    partnerName: partnerNameInput.value.trim(),
    autoConnect: autoConnectToggle.checked,
    ...overrides
  };
}

function persistSettings(overrides = {}) {
  if (!('localStorage' in window)) {
    return gatherCurrentSettings(overrides);
  }
  const next = gatherCurrentSettings(overrides);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('Nie udało się zapisać ustawień', error);
  }
  return next;
}

const storedSettings = loadStoredSettings();
const fallbackServerUrl = appDefaults.serverUrl
  ?? (window.location.hostname === 'localhost' || window.location.hostname === ''
    ? 'ws://localhost:8080'
    : 'wss://aplikacja-komunikator.onrender.com');
const initialSettings = {
  serverUrl: storedSettings.serverUrl ?? fallbackServerUrl,
  pairId: storedSettings.pairId ?? appDefaults.pairId ?? '',
  userId: storedSettings.userId ?? appDefaults.userId ?? '',
  partnerName: storedSettings.partnerName ?? appDefaults.partnerName ?? '',
  autoConnect: storedSettings.autoConnect ?? appDefaults.autoConnect ?? false
};

if (initialSettings.serverUrl) {
  serverUrlInput.value = initialSettings.serverUrl;
}
if (initialSettings.pairId) {
  pairIdInput.value = initialSettings.pairId;
}
if (initialSettings.userId) {
  userIdInput.value = initialSettings.userId;
}
if (initialSettings.partnerName) {
  partnerNameInput.value = initialSettings.partnerName;
}
autoConnectToggle.checked = initialSettings.autoConnect;
const shouldAutoConnect = initialSettings.autoConnect
  && Boolean(initialSettings.serverUrl && initialSettings.pairId && initialSettings.userId);

let socket = null;
let connectionState = 'disconnected';
let partnerOnline = false;
let partnerPresence = { presence: 'offline', note: '' };
let partnerName = partnerNameInput.value.trim() || 'Partnerka';
let currentUserId = userIdInput.value.trim();
let lastPartnerMessageId = null;
const queuedMessages = new Set();
const messageRegistry = new Map();

let audioContext = null;
let voiceEnabled = true;
let availableVoices = [];
let selectedVoice = null;
const speechSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

function buildConnectionUrl(baseUrl, pairId, userId) {
  let normalized = baseUrl.trim();
  if (!/^wss?:\/\//i.test(normalized)) {
    normalized = `ws://${normalized}`;
  }
  const url = new URL(normalized);
  url.searchParams.set('pairId', pairId);
  url.searchParams.set('userId', userId);
  return url.toString();
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function scrollTimelineToBottom() {
  requestAnimationFrame(() => {
    timelineEl.scrollTo({ top: timelineEl.scrollHeight, behavior: 'smooth' });
  });
}

function renderSystemEvent(text) {
  const el = document.createElement('article');
  el.className = 'event system';
  el.textContent = text;
  timelineEl.append(el);
  scrollTimelineToBottom();
}

function renderMessage(message, direction) {
  const el = document.createElement('article');
  el.className = `event ${direction}`;
  el.dataset.messageId = message.id ?? '';

  const meta = document.createElement('div');
  meta.className = 'meta';
  const author = direction === 'outgoing' ? 'Ty' : partnerName;
  meta.innerHTML = `<span>${author}</span><time>${formatTimestamp(message.timestamp)}</time>`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = message.content ?? message.note ?? '';

  const statusPill = document.createElement('div');
  statusPill.className = 'status-pill';
  statusPill.textContent = direction === 'outgoing' ? 'Wysłano' : `Nowa od ${partnerName}`;

  el.append(meta, bubble, statusPill);
  timelineEl.append(el);
  scrollTimelineToBottom();

  if (message.id) {
    messageRegistry.set(message.id, { element: el, direction, statusPill });
  }

  return el;
}

function renderAlarm(message, direction) {
  const el = document.createElement('article');
  el.className = `event ${direction} alarm`;

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<span>${direction === 'outgoing' ? 'Ty' : partnerName}</span><time>${formatTimestamp(message.timestamp)}</time>`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const levelLabel = message.level === 'urgent' ? 'Alarm pilny' : 'Alarm';
  const note = message.note ? ` – ${message.note}` : '';
  bubble.textContent = `${levelLabel}${note}`;

  el.append(meta, bubble);
  timelineEl.append(el);
  scrollTimelineToBottom();

  return el;
}

function renderStatus(message) {
  const el = document.createElement('article');
  el.className = 'event system status-update';
  const presenceMap = {
    available: 'dostępna',
    busy: 'zajęta',
    away: 'poza klawiaturą'
  };
  const note = message.note ? ` – ${message.note}` : '';
  el.textContent = `${partnerName} jest teraz ${presenceMap[message.presence] ?? message.presence}${note}`;
  timelineEl.append(el);
  scrollTimelineToBottom();
}

function updateConnectionUi() {
  switch (connectionState) {
    case 'connecting':
      connectionStateEl.textContent = 'Łączenie…';
      break;
    case 'connected':
      connectionStateEl.textContent = 'Połączono';
      break;
    default:
      connectionStateEl.textContent = 'Niepołączono';
  }

  connectButton.textContent = connectionState === 'connected' ? 'Rozłącz' : 'Połącz';
  connectButton.dataset.state = connectionState;
}

function updatePartnerUi() {
  const presenceLabelMap = {
    available: 'dostępna',
    busy: 'zajęta',
    away: 'poza klawiaturą',
    offline: 'offline'
  };
  const presenceLabel = presenceLabelMap[partnerPresence.presence] ?? partnerPresence.presence;
  const statusText = partnerOnline ? `${partnerName} ${presenceLabel}` : `${partnerName} offline`;
  partnerStateEl.textContent = partnerPresence.note ? `${statusText} – ${partnerPresence.note}` : statusText;
}

function setLastPartnerMessage(messageId) {
  if (lastPartnerMessageId && messageRegistry.has(lastPartnerMessageId)) {
    messageRegistry.get(lastPartnerMessageId).element.classList.remove('unread');
  }
  lastPartnerMessageId = messageId;
  if (messageId && messageRegistry.has(messageId)) {
    messageRegistry.get(messageId).element.classList.add('unread');
  }
  markReadButton.disabled = !messageId;
}

function ensureAudioContext() {
  if (audioContext) {
    return audioContext;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    return null;
  }
  audioContext = new Ctx();
  return audioContext;
}

function playAlarm(level) {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }
  const now = ctx.currentTime;
  const duration = level === 'urgent' ? 1.2 : 0.8;
  const frequency = level === 'urgent' ? 880 : 660;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.4, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
  if (navigator.vibrate) {
    navigator.vibrate(level === 'urgent' ? [200, 100, 200, 100, 400] : [120, 80, 120]);
  }
}

function speak(text) {
  if (!speechSupported || !voiceEnabled || !text) {
    return;
  }
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 1.15;
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  speechSynthesis.speak(utterance);
}

function populateVoices() {
  if (!speechSupported) {
    voiceSupportLabel.textContent = 'Twoja przeglądarka nie obsługuje syntezy mowy.';
    voiceToggle.disabled = true;
    voiceSelect.disabled = true;
    testVoiceButton.disabled = true;
    return;
  }
  availableVoices = speechSynthesis
    .getVoices()
    .filter((voice) => voice.localService || voice.lang.toLowerCase().startsWith('pl'));
  if (availableVoices.length === 0) {
    availableVoices = speechSynthesis.getVoices();
  }
  voiceSelect.innerHTML = '';
  availableVoices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.append(option);
  });
  if (availableVoices.length === 0) {
    voiceSelect.disabled = true;
    testVoiceButton.disabled = true;
    voiceSupportLabel.textContent = 'Brak zainstalowanych głosów w systemie.';
    selectedVoice = null;
    return;
  }
  voiceSelect.disabled = false;
  testVoiceButton.disabled = false;
  const preferred = availableVoices.find((voice) => voice.lang.toLowerCase().startsWith('pl')) ?? availableVoices[0];
  if (preferred) {
    voiceSelect.value = preferred.name;
    selectedVoice = preferred;
    voiceSupportLabel.textContent = `Miku mówi głosem: ${preferred.name}`;
  }
}

if (speechSupported) {
  populateVoices();
  speechSynthesis.addEventListener('voiceschanged', populateVoices);
} else {
  voiceSupportLabel.textContent = 'Twoja przeglądarka nie obsługuje syntezy mowy.';
  voiceToggle.disabled = true;
  voiceSelect.disabled = true;
  testVoiceButton.disabled = true;
}

voiceToggle.addEventListener('change', (event) => {
  voiceEnabled = event.target.checked;
});

voiceSelect.addEventListener('change', (event) => {
  selectedVoice = availableVoices.find((voice) => voice.name === event.target.value) ?? null;
  if (selectedVoice) {
    voiceSupportLabel.textContent = `Miku mówi głosem: ${selectedVoice.name}`;
  }
});

testVoiceButton.addEventListener('click', () => {
  speak('Cześć! Tu Miku. Jestem gotowa przekazać wiadomość.');
});

function handleReceipt(message) {
  const entry = messageRegistry.get(message.messageId);
  if (!entry) {
    return;
  }
  const statusMap = {
    received: 'Dostarczono',
    read: 'Przeczytane'
  };
  entry.statusPill.textContent = statusMap[message.status] ?? message.status;
  if (message.status === 'read') {
    entry.element.classList.remove('queued');
  }
}

function markMessageQueued(messageId) {
  if (!messageId) {
    return;
  }
  const entry = messageRegistry.get(messageId);
  if (entry) {
    entry.element.classList.add('queued');
  }
  queuedMessages.add(messageId);
  queueIndicator.hidden = false;
}

function clearQueueState(deliveredCount = 0) {
  queuedMessages.forEach((id) => {
    const entry = messageRegistry.get(id);
    if (entry) {
      entry.element.classList.remove('queued');
    }
  });
  queuedMessages.clear();
  queueIndicator.hidden = true;
  if (deliveredCount > 0) {
    renderSystemEvent(`Dostarczono zaległe wiadomości (${deliveredCount})`);
  }
}

function handleIncoming(raw) {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    renderSystemEvent('⚠️ Nie udało się odczytać wiadomości z serwera.');
    return;
  }

  if (payload.type === 'system') {
    if (payload.event === 'connected') {
      partnerOnline = Boolean(payload.partnerOnline);
      partnerPresence.presence = partnerOnline ? partnerPresence.presence : 'offline';
      updatePartnerUi();
      renderSystemEvent('Połączono z mostem komunikacyjnym.');
    } else if (payload.event === 'queued') {
      if (payload.messageId) {
        markMessageQueued(payload.messageId);
      } else {
        queueIndicator.hidden = false;
      }
      renderSystemEvent('Partnerka jest offline – wiadomość została zapisana.');
    } else if (payload.event === 'queue_flushed') {
      clearQueueState(payload.delivered);
    }
    return;
  }

  if (payload.type === 'error') {
    renderSystemEvent(`❌ Błąd serwera: ${payload.message}`);
    return;
  }

  if (payload.type === 'text') {
    const direction = payload.from === currentUserId ? 'outgoing' : 'incoming';
    const el = renderMessage(payload, direction);
    if (direction === 'incoming') {
      partnerOnline = true;
      partnerPresence.presence = 'available';
      updatePartnerUi();
      setLastPartnerMessage(payload.id);
      speak(payload.content);
      sendReceipt(payload.id, 'received');
    }
    if (direction === 'outgoing') {
      setLastPartnerMessage(null);
    }
    return;
  }

  if (payload.type === 'alarm') {
    const direction = payload.from === currentUserId ? 'outgoing' : 'incoming';
    renderAlarm(payload, direction);
    if (direction === 'incoming') {
      partnerOnline = true;
      partnerPresence.presence = 'busy';
      updatePartnerUi();
      playAlarm(payload.level);
      speak(`Alarm od ${partnerName}: ${payload.note ?? 'sprawdź co się dzieje!'}`);
    }
    return;
  }

  if (payload.type === 'status') {
    if (payload.from !== currentUserId) {
      partnerOnline = true;
      partnerPresence = { presence: payload.presence, note: payload.note ?? '' };
      updatePartnerUi();
      renderStatus(payload);
    }
    return;
  }

  if (payload.type === 'receipt') {
    if (payload.from !== currentUserId) {
      setLastPartnerMessage(null);
    }
    handleReceipt(payload);
  }
}

function ensureSocketReady() {
  return socket && socket.readyState === WebSocket.OPEN;
}

function sendPayload(message) {
  if (!ensureSocketReady()) {
    renderSystemEvent('🔌 Brak połączenia z serwerem.');
    return false;
  }
  socket.send(JSON.stringify(message));
  return true;
}

function sendReceipt(messageId, status) {
  if (!messageId) {
    return;
  }
  sendPayload({ type: 'receipt', messageId, status });
  if (status === 'read') {
    setLastPartnerMessage(null);
  }
}

function connect() {
  const serverUrl = serverUrlInput.value.trim();
  const pairId = pairIdInput.value.trim();
  const userId = userIdInput.value.trim();
  partnerName = partnerNameInput.value.trim() || 'Partnerka';

  if (!serverUrl || !pairId || !userId) {
    renderSystemEvent('Uzupełnij adres serwera, ID pary i swoje ID.');
    return;
  }

  persistSettings();

  if (socket) {
    socket.close();
  }

  const url = buildConnectionUrl(serverUrl, pairId, userId);
  currentUserId = userId;
  connectionState = 'connecting';
  updateConnectionUi();
  renderSystemEvent('Łączenie z mostem komunikacyjnym…');

  socket = new WebSocket(url);

  socket.addEventListener('open', () => {
    connectionState = 'connected';
    updateConnectionUi();
  });

  socket.addEventListener('message', (event) => {
    handleIncoming(event.data);
  });

  socket.addEventListener('close', () => {
    connectionState = 'disconnected';
    partnerOnline = false;
    partnerPresence = { presence: 'offline', note: '' };
    queuedMessages.clear();
    queueIndicator.hidden = true;
    setLastPartnerMessage(null);
    updateConnectionUi();
    updatePartnerUi();
    renderSystemEvent('Połączenie zostało zamknięte.');
  });

  socket.addEventListener('error', () => {
    renderSystemEvent('⚠️ Błąd połączenia WebSocket.');
  });
}

[serverUrlInput, pairIdInput, userIdInput, partnerNameInput].forEach((input) => {
  input.addEventListener('change', () => {
    persistSettings();
  });
  input.addEventListener('blur', () => {
    persistSettings();
  });
});

autoConnectToggle.addEventListener('change', () => {
  const next = persistSettings({ autoConnect: autoConnectToggle.checked });
  if (autoConnectToggle.checked) {
    if (next.serverUrl && next.pairId && next.userId) {
      renderSystemEvent('Automatyczne łączenie włączone – przy następnym starcie połączę się sama.');
    } else {
      renderSystemEvent('Włączono automatyczne łączenie, uzupełnij jednak dane połączenia.');
    }
  }
});

connectionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (connectionState === 'connected') {
    socket?.close();
  } else {
    connect();
  }
});

if (shouldAutoConnect) {
  setTimeout(() => {
    renderSystemEvent('Przywracam ostatnie połączenie z Miku…');
    connect();
  }, 250);
}

messageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const content = messageInput.value.trim();
  if (!content) {
    return;
  }
  const sent = sendPayload({ type: 'text', content });
  if (sent) {
    messageInput.value = '';
  }
});

markReadButton.addEventListener('click', () => {
  if (lastPartnerMessageId) {
    sendReceipt(lastPartnerMessageId, 'read');
  }
});

alarmButton.addEventListener('click', () => {
  const level = alarmLevelSelect.value;
  const note = alarmNoteInput.value.trim();
  sendPayload({ type: 'alarm', level, note: note || undefined });
  if (note) {
    alarmNoteInput.value = '';
  }
});

statusButton.addEventListener('click', () => {
  const presence = statusPresenceSelect.value;
  const note = statusNoteInput.value.trim();
  sendPayload({ type: 'status', presence, note: note || undefined });
});

window.addEventListener('focus', () => {
  if (lastPartnerMessageId) {
    sendReceipt(lastPartnerMessageId, 'read');
  }
});

updateConnectionUi();
updatePartnerUi();

renderSystemEvent('Witaj! Ustaw dane połączenia i kliknij „Połącz”.');
