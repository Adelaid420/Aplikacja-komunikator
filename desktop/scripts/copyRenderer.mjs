import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../../');
const clientDist = resolve(projectRoot, 'client/dist');
const rendererDir = resolve(projectRoot, 'desktop/renderer');

if (!existsSync(clientDist)) {
  console.error('❌ Nie znaleziono builda klienta. Uruchom najpierw "npm run build --prefix client".');
  process.exit(1);
}

rmSync(rendererDir, { recursive: true, force: true });
mkdirSync(rendererDir, { recursive: true });
cpSync(clientDist, rendererDir, { recursive: true });

console.log(`✅ Skopiowano zasoby widżetu do ${rendererDir}`);
