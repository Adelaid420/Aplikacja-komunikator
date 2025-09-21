# Wdrożenie serwera online

Poniższe instrukcje pozwalają utrzymać most WebSocket online 24/7. Każda platforma korzysta z tego samego kodu (`server/`) i wymaga jedynie zainstalowania zależności oraz uruchomienia kompilacji TypeScript.

## Render (najprostsza opcja)

1. Utwórz konto na [Render](https://render.com/) i wybierz **New + > Web Service**.
2. Podaj adres repozytorium (lub wybierz wcześniej przygotowanego forka).
3. W polu **Build Command** wpisz `cd server && npm install && npm run build`.
4. W polu **Start Command** wpisz `cd server && npm run start`.
5. Wybierz plan co najmniej **Starter** (plan Free usypia usługę po kilku minutach braku ruchu, więc nie zapewni pracy 24/7).
6. W zakładce **Environment** dodaj `FCM_SERVER_KEY` z kluczem serwerowym Firebase Cloud Messaging.
7. Po pierwszym wdrożeniu przetestuj `https://twoja-nazwa.onrender.com/healthz`. Odpowiedź `{"status":"ok"}` oznacza, że serwer działa.
8. Adres WebSocket dla klienta to `wss://twoja-nazwa.onrender.com?pairId=<PAIR>&userId=<USER>`. W udostępnionej aplikacji `pairId` jest już na stałe ustawione na `oliwier-amelka`, a `userId` przyjmuje wartość `oliwier` lub `amelka`.

> Jeśli mimo wszystko korzystasz z planu Free, licz się z opóźnieniem przy pierwszym połączeniu po przerwie (instancja wybudza się 10–30 sekund). Do stałej pracy lepiej użyć płatnego planu lub platformy z opcją Always On (Railway, Fly.io, VPS).

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

- Po zmianach w kodzie uruchom ponownie wdrożenie (Render i Railway robią to automatycznie przy każdym pushu).
- Przed publikacją warto lokalnie wykonać `npm run build --prefix server` oraz `npm run lint --prefix server`.
- Monitoruj logi (`render logs`, `railway logs`, `flyctl logs`), aby szybko wychwycić błędy połączeń.

## Rejestrowanie urządzeń mobilnych (push)

- `POST /register-device` – rejestruje token powiadomień:
  ```bash
  curl -X POST "https://twoja-nazwa.onrender.com/register-device" \
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
MIKU_SERVER_URL=wss://twoja-nazwa.onrender.com npm run dev
```

Analogiczne zmienne (`MIKU_PAIR_ID`, `MIKU_USER_ID`, `MIKU_PARTNER_NAME`) ustawiają domyślne wartości formularza po stronie klienta.
