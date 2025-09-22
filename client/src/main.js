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
const avatarCircleEl = document.querySelector('.avatar-circle');
const avatarGlowEl = document.querySelector('.avatar-glow');
const avatarPupils = Array.from(document.querySelectorAll('.avatar-eye .avatar-pupil'));

const STORAGE_KEY = 'komunikator-settings';
const appDefaults = window.komunikator?.defaults ?? {};
const FIXED_PAIR_ID = appDefaults.pairId ?? 'oliwier-amelka';
const USER_ROLES = {
  oliwier: { id: 'oliwier', label: 'Oliwier', partnerId: 'amelka', partnerLabel: 'Amelka' },
  amelka: { id: 'amelka', label: 'Amelka', partnerId: 'oliwier', partnerLabel: 'Oliwier' }
};
const ALLOWED_USER_IDS = Object.keys(USER_ROLES);
const PARTNER_FALLBACK_NAME = 'Partner/partnerka';

const detectedPlatform = (() => {
  try {
    if (window.komunikator?.environment) {
      return window.komunikator.environment;
    }
    if (window.Capacitor && typeof window.Capacitor.getPlatform === 'function') {
      return window.Capacitor.getPlatform();
    }
  } catch (error) {
    console.warn('Nie udało się odczytać platformy', error);
  }
  return 'web';
})();

const isNativeApp = detectedPlatform !== 'web';
if (isNativeApp) {
  document.body.classList.add('native-app');
}

const alertBridge = isNativeApp ? (window.Capacitor?.Plugins?.AlertBridge ?? null) : null;
if (isNativeApp && alertBridge?.requestPermission) {
  try {
    alertBridge.requestPermission();
  } catch (error) {
    console.warn('Nie udało się poprosić o zgodę na powiadomienia', error);
  }
}

const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const hasTouch = typeof navigator !== 'undefined'
  && ((typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0)
    || (typeof window !== 'undefined' && 'ontouchstart' in window));
const allowAttentionFeedback = (isNativeApp || hasTouch) && canVibrate;
const attentionPatterns = {
  message: [140],
  alarm: [160, 120, 160],
  'alarm-urgent': [220, 140, 240, 140, 360]
};

const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 90000;
const MIN_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 60000;

function triggerAttention(kind = 'message') {
  if (!allowAttentionFeedback) {
    return;
  }
  const pattern = attentionPatterns[kind] ?? attentionPatterns.message;
  try {
    navigator.vibrate(pattern);
  } catch (error) {
    console.warn('Nie udało się włączyć wibracji', error);
  }
  if (alertBridge?.playAttention) {
    try {
      alertBridge.playAttention({ level: kind });
    } catch (error) {
      console.warn('Nie udało się odtworzyć alarmu systemowego', error);
    }
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function scheduleIdleEyes() {
  if (idleTimeoutId) {
    clearTimeout(idleTimeoutId);
  }
  idleTimeoutId = setTimeout(() => {
    if (idleIntervalId) {
      return;
    }
    idleIntervalId = setInterval(() => {
      const randomX = (Math.random() * 2 - 1) * 12;
      const randomY = (Math.random() * 2 - 1) * 8;
      pupilTarget.x = randomX;
      pupilTarget.y = randomY;
    }, 3800);
  }, 4200);
}

function cancelIdleEyes() {
  if (idleTimeoutId) {
    clearTimeout(idleTimeoutId);
    idleTimeoutId = null;
  }
  if (idleIntervalId) {
    clearInterval(idleIntervalId);
    idleIntervalId = null;
  }
}

function updatePupilAnimation() {
  const ease = 0.18;
  pupilPosition.x += (pupilTarget.x - pupilPosition.x) * ease;
  pupilPosition.y += (pupilTarget.y - pupilPosition.y) * ease;
  avatarPupils.forEach((pupil, index) => {
    const offsetX = pupilPosition.x + (index === 0 ? -1 : 1);
    pupil.style.transform = `translate(${offsetX}px, ${pupilPosition.y}px)`;
  });
  avatarAnimationFrameId = requestAnimationFrame(updatePupilAnimation);
}

function lookAtPoint(clientX, clientY) {
  if (!avatarCircleEl) {
    return;
  }
  cancelIdleEyes();
  const rect = avatarCircleEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const maxOffset = rect.width * 0.12;
  const distance = Math.hypot(dx, dy);
  const clampedDistance = clamp(distance, 0, rect.width);
  const ratio = clampedDistance === 0 ? 0 : clamp(clampedDistance / (rect.width / 2), 0, 1);
  const angle = Math.atan2(dy, dx);
  pupilTarget.x = Math.cos(angle) * maxOffset * ratio;
  pupilTarget.y = Math.sin(angle) * maxOffset * clamp(ratio, 0, 0.8);
  scheduleIdleEyes();
}

function resetEyes() {
  pupilTarget.x = 0;
  pupilTarget.y = 0;
  scheduleIdleEyes();
}

function initAvatarEyes() {
  if (!avatarCircleEl || avatarPupils.length === 0) {
    return;
  }
  if (avatarAnimationFrameId === null) {
    avatarAnimationFrameId = requestAnimationFrame(updatePupilAnimation);
  }
  scheduleIdleEyes();

  if (pointerFine) {
    window.addEventListener('pointermove', (event) => {
      lookAtPoint(event.clientX, event.clientY);
    });
    window.addEventListener('pointerleave', resetEyes);
  }

  window.addEventListener('blur', resetEyes);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      resetEyes();
    }
  });
}

function sanitizeUserId(id) {
  if (!id) {
    return '';
  }
  return ALLOWED_USER_IDS.includes(id) ? id : '';
}

function computePartnerName(userId) {
  const role = USER_ROLES[userId];
  return role ? role.partnerLabel : PARTNER_FALLBACK_NAME;
}

function applyUserRole(userId) {
  const sanitized = sanitizeUserId(userId);
  if (sanitized) {
    const role = USER_ROLES[sanitized];
    const partnerLabel = role.partnerLabel;
    partnerName = partnerLabel;
    partnerNameInput.value = partnerLabel;
  } else {
    partnerName = PARTNER_FALLBACK_NAME;
    partnerNameInput.value = '';
  }
  currentUserId = sanitized;
  updatePartnerUi();
  return sanitized;
}

function notifyNative(kind, details = {}) {
  if (!alertBridge?.showNotification) {
    return;
  }
  const partnerDisplay = getPartnerDisplayName();
  let title;
  let body;
  let category = 'message';
  let level = 'message';

  if (kind === 'alarm') {
    category = 'alarm';
    level = details.level ?? 'default';
    const label = level === 'urgent' ? 'Alarm pilny' : 'Alarm';
    title = `${label} od ${partnerDisplay}`;
    body = details.note?.trim() || 'Otwórz komunikator, aby odpowiedzieć.';
  } else {
    title = `Nowa wiadomość od ${partnerDisplay}`;
    body = details.content?.trim() || 'Otwórz komunikator, aby przeczytać wiadomość.';
  }

  try {
    alertBridge.showNotification({ title, body, category, level });
  } catch (error) {
    console.warn('Nie udało się pokazać natywnego powiadomienia', error);
  }
}

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
  const userId = sanitizeUserId(userIdInput.value.trim());
  const derivedPartnerName = computePartnerName(userId);
  return {
    serverUrl: serverUrlInput.value.trim(),
    pairId: FIXED_PAIR_ID,
    userId,
    partnerName: derivedPartnerName,
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
const storedUserId = sanitizeUserId(storedSettings.userId ?? appDefaults.userId ?? '');
const initialSettings = {
  serverUrl: storedSettings.serverUrl ?? fallbackServerUrl,
  pairId: FIXED_PAIR_ID,
  userId: storedUserId,
  partnerName: computePartnerName(storedUserId),
  autoConnect: storedSettings.autoConnect ?? appDefaults.autoConnect ?? false
};

if (initialSettings.serverUrl) {
  serverUrlInput.value = initialSettings.serverUrl;
}
pairIdInput.value = FIXED_PAIR_ID;
pairIdInput.readOnly = true;
pairIdInput.setAttribute('aria-readonly', 'true');
pairIdInput.title = 'Stały identyfikator pokoju komunikatora';
if (initialSettings.userId) {
  userIdInput.value = initialSettings.userId;
}
const initialPartnerValue = initialSettings.userId ? (initialSettings.partnerName ?? PARTNER_FALLBACK_NAME) : '';
partnerNameInput.value = initialPartnerValue;
partnerNameInput.readOnly = true;
autoConnectToggle.checked = initialSettings.autoConnect;
const shouldAutoConnect = initialSettings.autoConnect
  && Boolean(initialSettings.serverUrl && initialSettings.userId);

let socket = null;
let connectionState = 'disconnected';
let partnerOnline = false;
let partnerPresence = { presence: 'offline', note: '' };
let partnerName = initialPartnerValue || PARTNER_FALLBACK_NAME;
let currentUserId = initialSettings.userId ?? '';
let lastPartnerMessageId = null;
const queuedMessages = new Set();
const messageRegistry = new Map();
let stayOnline = isNativeApp || shouldAutoConnect;
let manualDisconnect = false;
let reconnectTimer = null;
let reconnectDelayMs = MIN_RECONNECT_DELAY_MS;
let reconnectNoticeShown = false;
let heartbeatIntervalId = null;
let lastHeartbeatAck = Date.now();
let idleTimeoutId = null;
let idleIntervalId = null;
let avatarAnimationFrameId = null;
const pointerFine = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(pointer: fine)').matches;
const pupilTarget = { x: 0, y: 0 };
const pupilPosition = { x: 0, y: 0 };

if (currentUserId) {
  applyUserRole(currentUserId);
} else {
  updatePartnerUi();
}

function getPartnerDisplayName() {
  return partnerName || PARTNER_FALLBACK_NAME;
}

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
  const author = direction === 'outgoing' ? 'Ty' : getPartnerDisplayName();
  meta.innerHTML = `<span>${author}</span><time>${formatTimestamp(message.timestamp)}</time>`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = message.content ?? message.note ?? '';

  const statusPill = document.createElement('div');
  statusPill.className = 'status-pill';
  statusPill.textContent = direction === 'outgoing'
    ? 'Wysłano'
    : `Nowa od ${getPartnerDisplayName()}`;

  el.append(meta, bubble, statusPill);
  timelineEl.append(el);
  scrollTimelineToBottom();

  if (message.id) {
    messageRegistry.set(message.id, { element: el, direction, statusPill });
  }

  if (direction === 'incoming') {
    triggerAttention('message');
    notifyNative('message', { content: message.content ?? '' });
  }

  return el;
}

function renderAlarm(message, direction) {
  const el = document.createElement('article');
  el.className = `event ${direction} alarm`;

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<span>${direction === 'outgoing' ? 'Ty' : getPartnerDisplayName()}</span><time>${formatTimestamp(message.timestamp)}</time>`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const levelLabel = message.level === 'urgent' ? 'Alarm pilny' : 'Alarm';
  const note = message.note ? ` – ${message.note}` : '';
  bubble.textContent = `${levelLabel}${note}`;

  el.append(meta, bubble);
  timelineEl.append(el);
  scrollTimelineToBottom();

  if (direction === 'incoming') {
    triggerAttention(message.level === 'urgent' ? 'alarm-urgent' : 'alarm');
    notifyNative('alarm', { level: message.level, note: message.note });
  }

  return el;
}

function renderStatus(message) {
  const el = document.createElement('article');
  el.className = 'event system status-update';
  const presenceMap = {
    available: 'dostępny/a',
    busy: 'zajęty/a',
    away: 'poza klawiaturą'
  };
  const note = message.note ? ` – ${message.note}` : '';
  el.textContent = `${getPartnerDisplayName()} jest teraz ${presenceMap[message.presence] ?? message.presence}${note}`;
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

  if (avatarCircleEl) {
    avatarCircleEl.classList.toggle('connected', connectionState === 'connected');
    avatarCircleEl.classList.toggle('connecting', connectionState === 'connecting');
  }
  if (avatarGlowEl) {
    avatarGlowEl.classList.toggle('connected', connectionState === 'connected');
  }

  connectButton.textContent = connectionState === 'connected' ? 'Rozłącz' : 'Połącz';
  connectButton.dataset.state = connectionState;
}

function updatePartnerUi() {
  const presenceLabelMap = {
    available: 'dostępny/a',
    busy: 'zajęty/a',
    away: 'poza klawiaturą',
    offline: 'offline'
  };
  const presenceLabel = presenceLabelMap[partnerPresence.presence] ?? partnerPresence.presence;
  const partnerDisplay = getPartnerDisplayName();
  const statusText = partnerOnline ? `${partnerDisplay} ${presenceLabel}` : `${partnerDisplay} offline`;
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
  triggerAttention(level === 'urgent' ? 'alarm-urgent' : 'alarm');
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
      renderSystemEvent(`${getPartnerDisplayName()} jest offline – wiadomość została zapisana.`);
    } else if (payload.event === 'queue_flushed') {
      clearQueueState(payload.delivered);
    } else if (payload.event === 'heartbeat') {
      lastHeartbeatAck = Date.now();
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
      speak(`Alarm od ${getPartnerDisplayName()}: ${payload.note ?? 'sprawdź co się dzieje!'}`);
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

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectDelayMs = MIN_RECONNECT_DELAY_MS;
  reconnectNoticeShown = false;
}

function scheduleReconnect() {
  if (manualDisconnect) {
    return;
  }
  if (!(stayOnline || autoConnectToggle.checked)) {
    return;
  }
  if (reconnectTimer) {
    return;
  }
  const delay = reconnectDelayMs;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect(true);
  }, delay);
  reconnectDelayMs = Math.min(Math.floor(reconnectDelayMs * 1.8), MAX_RECONNECT_DELAY_MS);
  if (!reconnectNoticeShown) {
    renderSystemEvent(`Połączenie przerwane – kolejna próba za ${Math.round(delay / 1000)} s.`);
    reconnectNoticeShown = true;
  }
}

function startHeartbeat() {
  stopHeartbeat();
  lastHeartbeatAck = Date.now();
  heartbeatIntervalId = setInterval(() => {
    if (!ensureSocketReady()) {
      return;
    }
    const now = Date.now();
    if (now - lastHeartbeatAck > HEARTBEAT_TIMEOUT_MS) {
      renderSystemEvent('Brak odpowiedzi serwera – ponawiam połączenie.');
      socket?.close();
      return;
    }
    try {
      socket.send(JSON.stringify({ type: 'heartbeat', timestamp: now }));
    } catch (error) {
      console.warn('Nie udało się wysłać sygnału podtrzymania połączenia', error);
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
}

function connect(isReconnect = false) {
  const serverUrl = serverUrlInput.value.trim();
  const userId = sanitizeUserId(userIdInput.value.trim());
  if (userId) {
    applyUserRole(userId);
  }

  if (!serverUrl || !userId) {
    if (!isReconnect) {
      renderSystemEvent('Uzupełnij adres serwera i wybierz swoją rolę z listy.');
    }
    return;
  }

  stayOnline = true;
  manualDisconnect = false;
  persistSettings();
  clearReconnectTimer();

  if (socket) {
    try {
      socket.close();
    } catch (error) {
      console.warn('Nie udało się zamknąć poprzedniego połączenia', error);
    }
  }

  const url = buildConnectionUrl(serverUrl, FIXED_PAIR_ID, userId);
  currentUserId = userId;
  connectionState = 'connecting';
  updateConnectionUi();
  renderSystemEvent(isReconnect ? 'Przywracam połączenie z mostem komunikacyjnym…' : 'Łączenie z mostem komunikacyjnym…');

  socket = new WebSocket(url);

  socket.addEventListener('open', () => {
    connectionState = 'connected';
    stayOnline = true;
    manualDisconnect = false;
    reconnectDelayMs = MIN_RECONNECT_DELAY_MS;
    clearReconnectTimer();
    updateConnectionUi();
    lastHeartbeatAck = Date.now();
    startHeartbeat();
    renderSystemEvent('Kanał Miku jest aktywny 24/7.');
  });

  socket.addEventListener('message', (event) => {
    handleIncoming(event.data);
  });

  socket.addEventListener('close', (event) => {
    stopHeartbeat();
    socket = null;
    connectionState = 'disconnected';
    partnerOnline = false;
    partnerPresence = { presence: 'offline', note: '' };
    queuedMessages.clear();
    queueIndicator.hidden = true;
    setLastPartnerMessage(null);
    updateConnectionUi();
    updatePartnerUi();
    if (manualDisconnect) {
      renderSystemEvent('Połączenie zostało rozłączone.');
      clearReconnectTimer();
    } else {
      const reason = event.wasClean ? 'zakończone przez serwer' : 'przerwane';
      renderSystemEvent(`Połączenie ${reason}.`);
      scheduleReconnect();
    }
  });

  socket.addEventListener('error', (error) => {
    console.warn('Błąd połączenia WebSocket', error);
    renderSystemEvent('⚠️ Błąd połączenia WebSocket.');
  });
}

[serverUrlInput, userIdInput].forEach((input) => {
  input.addEventListener('change', () => {
    persistSettings();
  });
  input.addEventListener('blur', () => {
    persistSettings();
  });
});

userIdInput.addEventListener('change', () => {
  const sanitized = applyUserRole(userIdInput.value.trim());
  persistSettings({ userId: sanitized, partnerName: computePartnerName(sanitized) });
});

autoConnectToggle.addEventListener('change', () => {
  const next = persistSettings({ autoConnect: autoConnectToggle.checked });
  const ready = Boolean(next.serverUrl && next.userId);
  stayOnline = autoConnectToggle.checked || isNativeApp;
  if (autoConnectToggle.checked) {
    manualDisconnect = false;
    if (ready) {
      renderSystemEvent('Automatyczne łączenie włączone – Miku będzie czuwać w tle.');
      if (connectionState !== 'connected') {
        connect(true);
      }
    } else {
      renderSystemEvent('Włączono automatyczne łączenie, uzupełnij jednak adres serwera i wybierz swoją rolę.');
    }
  } else if (!isNativeApp) {
    renderSystemEvent('Automatyczne łączenie wyłączone.');
  }
});

connectionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (connectionState === 'connected') {
    manualDisconnect = true;
    clearReconnectTimer();
    stopHeartbeat();
    renderSystemEvent('Rozłączam most komunikacyjny…');
    socket?.close();
  } else {
    connect();
  }
});

if (shouldAutoConnect) {
  setTimeout(() => {
    renderSystemEvent('Przywracam ostatnie połączenie z Miku…');
    connect(true);
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

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && lastPartnerMessageId) {
    sendReceipt(lastPartnerMessageId, 'read');
  }
});

window.addEventListener('online', () => {
  if (!manualDisconnect && (stayOnline || autoConnectToggle.checked) && connectionState !== 'connected') {
    connect(true);
  }
});

document.addEventListener('visibilitychange', () => {
  if (
    document.visibilityState === 'visible'
    && !manualDisconnect
    && (stayOnline || autoConnectToggle.checked)
    && connectionState === 'disconnected'
  ) {
    connect(true);
  }
});

initAvatarEyes();

updateConnectionUi();
updatePartnerUi();

renderSystemEvent('Witaj! Ustaw dane połączenia i kliknij „Połącz”, aby Miku czuwała 24/7.');
