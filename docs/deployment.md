# Wdrożenie serwera online

Poniższe instrukcje pozwalają utrzymać most WebSocket online 24/7. Każda platforma korzysta z tego samego kodu (`server/`) i wymaga jedynie zainstalowania zależności oraz uruchomienia kompilacji TypeScript.

## Netlify (Edge Functions)

1. Zaloguj się do [Netlify](https://app.netlify.com/) i utwórz nową stronę na podstawie tego repozytorium.
2. W kreatorze pozostaw build command `npm run setup:client && npm run build:client` oraz katalog publikacji `client/dist` – konfiguracja z `netlify.toml` zrobi resztę.
3. Po pierwszym buildzie Netlify wyświetli w zakładce **Edge Functions** funkcję `bridge`, która obsługuje WebSocket (`/bridge`), endpoint `POST/DELETE /register-device` oraz `GET /healthz`.
4. W sekcji **Site configuration → Environment variables** dodaj `FCM_SERVER_KEY`, aby backend mógł wysyłać powiadomienia Firebase.
5. Włącz plan (np. Netlify Pro), który gwarantuje brak usypiania instancji Edge – to zapewnia stałe działanie mostu 24/7.
6. Po wdrożeniu sprawdź `https://twoja-nazwa.netlify.app/healthz`. Odpowiedź `{"status":"ok"}` potwierdza, że funkcja działa.
7. Klienci łączą się poprzez `wss://twoja-nazwa.netlify.app/bridge?pairId=<PAIR>&userId=<USER>`. W wersji demo `pairId` to `oliwier-amelka`, a `userId` ma wartość `oliwier` lub `amelka`.

> Netlify Edge Functions startują natychmiast, ale aby uniknąć limitów darmowego planu, warto włączyć płatny plan umożliwiający stałe działanie i większy limit połączeń WebSocket.

## Railway

1. Utwórz projekt na [Railway](https://railway.app/), wybierz **Provision from Template > Empty Project**.
2. Dodaj repozytorium jako **GitHub Repo**.
3. W zakładce **Variables** dodaj `NPM_CONFIG_PRODUCTION=false` (aby `npm install` pobrał devDependencies potrzebne do kompilacji).
4. W zakładce **Deployments** ustaw:
   - **Build Command**: `cd server && npm install && npm run build`
   - **Start Command**: `cd server && npm run start`
5. Railway przypisze port do zmiennej `PORT` – nie trzeba jej konfigurować ręcznie.
6. Po wdrożeniu sprawdź `https://<slug>.up.railway.app/healthz` i używaj adresu `wss://<slug>.up.railway.app` w aplikacji.

## Fly.io

1. Zainstaluj [CLI Fly.io](https://fly.io/docs/hands-on/install-flyctl/) i zaloguj się `flyctl auth login`.
2. W katalogu repozytorium uruchom `flyctl launch` i wybierz opcję "Existing project".
3. Gdy kreator zapyta o Dockerfile, wskaż plik `server/Dockerfile` (jeśli nie istnieje, uruchom `npm run build --prefix server`, a następnie skorzystaj z poniższej sekcji, aby go stworzyć).
4. Jeśli nie posiadasz Dockerfile, możesz wygenerować prosty obraz Node:
   ```Dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY server/package*.json ./
   RUN npm install
   COPY server ./server
   RUN npm run build --prefix server
   CMD ["npm", "run", "start", "--prefix", "server"]
   ```
5. W pliku `fly.toml` upewnij się, że port 8080 jest wystawiony jako `internal_port = 8080`.
6. Wdróż aplikację poleceniem `flyctl deploy` i testuj `https://<app>.fly.dev/healthz`.

## Aktualizacja wdrożeń

- Po zmianach w kodzie Netlify zbuduje projekt ponownie automatycznie; w pozostałych platformach możesz wywołać redeploy ręcznie.
- Przed publikacją warto lokalnie wykonać `npm run build --prefix server` oraz `npm run lint --prefix server`.
- Monitoruj logi (`netlify logs`, `railway logs`, `flyctl logs`), aby szybko wychwycić błędy połączeń.

## Rejestrowanie urządzeń mobilnych (push)

- `POST /register-device` – rejestruje token powiadomień:
  ```bash
  curl -X POST "https://twoja-nazwa.netlify.app/register-device" \
    -H "Content-Type: application/json" \
    -d '{
      "pairId": "my-pair",
      "userId": "amelia",
      "token": "FCM_TOKEN",
      "platform": "android"
    }'
  ```
- `DELETE /register-device` – usuwa token (ten sam JSON co powyżej).
- Tokeny trzymane są w pamięci – w produkcji warto zapisać je np. w Redisie lub bazie SQL i synchronizować z kontem użytkownika.
- Klucz `FCM_SERVER_KEY` jest obowiązkowy – bez niego push nie zostanie wysłany.

## Konfiguracja klienta

W aplikacji desktopowej i widżecie webowym możesz zmienić adres serwera na ten z chmury. Najwygodniej ustawić zmienne środowiskowe przed uruchomieniem Electron:

```bash
MIKU_SERVER_URL=wss://twoja-nazwa.netlify.app/bridge npm run dev
```

Analogiczne zmienne (`MIKU_PAIR_ID`, `MIKU_USER_ID`, `MIKU_PARTNER_NAME`) ustawiają domyślne wartości formularza po stronie klienta.
