import { contextBridge } from 'electron';

const defaults = {
  serverUrl: process.env.MIKU_SERVER_URL ?? 'ws://localhost:8080',
  pairId: process.env.MIKU_PAIR_ID ?? '',
  userId: process.env.MIKU_USER_ID ?? '',
  partnerName: process.env.MIKU_PARTNER_NAME ?? ''
};

contextBridge.exposeInMainWorld('komunikator', {
  defaults,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }
});
