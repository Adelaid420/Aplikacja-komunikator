# Aplikacja komunikator "Miku"

Repozytorium zawiera dokumentację wstępną komunikatora, który pozwala na natychmiastowe porozumiewanie się z drugą osobą przy pomocy stałego, animowanego awatara widocznego na ekranie telefonu i komputera. System ma wspierać błyskawiczne przesyłanie wiadomości, uruchamianie alarmów dźwiękowych oraz komunikację głosową przy wykorzystaniu spersonalizowanego głosu (np. głosu partnera/partnerki).

## Główne założenia produktu

- Stała obecność małego widżetu z awatarem "Miku" na pulpicie telefonu oraz komputera.
- Dwukierunkowe przesyłanie krótkich wiadomości tekstowych, które natychmiast pojawiają się w widżecie drugiej osoby.
- Przyciski akcji (np. "Włącz alarm", "Zadzwoń") wymuszające zwrócenie uwagi odbiorcy poprzez głośny sygnał, wibracje i powiadomienie na całym ekranie.
- Tryb komunikacji głosowej wykorzystujący syntezę głosu partnera/partnerki do odczytywania wiadomości.
- Działanie w tle z minimalnym zużyciem baterii oraz możliwość automatycznego uruchamiania po starcie systemu.
- Bezpieczna synchronizacja poprzez szyfrowanie end-to-end i uwierzytelnianie dwuskładnikowe.

## Struktura repozytorium

- `docs/product_requirements.md` – szczegółowe wymagania funkcjonalne i niefunkcjonalne oraz historie użytkownika.
- `docs/system_architecture.md` – proponowana architektura rozwiązania (frontend, backend, usługi w tle, przetwarzanie głosu).
- `docs/experience_design.md` – opis zachowania widżetu, scenariuszy interakcji i przepływów alarmów.
- `docs/development_plan.md` – plan wdrożenia, etapy projektowe oraz lista zadań na pierwsze sprinty.
- `server/` – implementacja mostu czasu rzeczywistego opartego o WebSockety (TypeScript + `ws`).
- `client/` – interaktywny widżet z awatarem „Miku” (Vite + czysty JavaScript) prezentujący wiadomości, alarmy i statusy.
- `desktop/` – aplikacja Electron, która pakuje widżet w samodzielne okno (Windows/macOS/Linux) i pozwala zbudować instalator `.exe`.
- `start-app.sh`, `start-app.command`, `start-app.bat` – pliki typu „kliknij i uruchom”, które startują jednocześnie serwer i widżet.

## Szybki start – jeden plik do uruchomienia

1. **Mac / Linux** – kliknij `start-app.command` (lub w terminalu uruchom `./start-app.sh`).
2. **Windows** – kliknij `start-app.bat`.

Skrypt samodzielnie zainstaluje zależności (`server/`, `client/`, `desktop/`), uruchomi Vite'a dla widżetu, otworzy okno Electron i ustawi domyślny adres mostu WebSocket na `wss://aplikacja-komunikator.onrender.com`. Dzięki temu po wpisaniu pary i swojego ID oraz zaznaczeniu opcji **„Łącz automatycznie”** komunikator po kolejnych uruchomieniach sam przywróci połączenie z backendem na Renderze.

> Jeśli chcesz wrócić do w pełni lokalnego trybu (z prototypowym serwerem WebSocket na `localhost:8080`), użyj `npm run start` lub `npm run dev` z terminala.

> Nadal możesz korzystać z wersji przeglądarkowej – uruchom `npm run dev:web`, aby otworzyć widżet w przeglądarce tak jak dotychczas.

## Aplikacja desktopowa (Komunikator.exe)

Folder `desktop/` zawiera konfigurację Electron + electron-builder. Dzięki temu możesz uruchamiać widżet w osobnym oknie oraz budować instalatory dla Windows, macOS i Linuxa.

### Tryb deweloperski okna

```bash
npm run setup     # jednorazowo, instaluje zależności wszystkich modułów
npm run dev       # startuje server + client + electron w trybie watch

# wariant z gotowym backendem na Renderze (bez lokalnego serwera)
npm run start:render
```

### Budowanie instalatora `.exe`

```bash
# 1. Zbuduj frontend widżetu i przenieś go do katalogu desktop/renderer
npm run build:client

# 2. Zbuduj instalator
npm run build:desktop
```

Po zakończeniu procesu instalator znajdziesz w `desktop/release/Komunikator-<wersja>-Setup.exe`. Analogiczne artefakty powstaną dla macOS (`.dmg`) oraz Linuxa (`.AppImage`, `.deb`).

> Domyślny adres serwera (`wss://aplikacja-komunikator.onrender.com`) możesz nadpisać zmiennymi środowiskowymi przed uruchomieniem Electron, np. `MIKU_SERVER_URL=wss://twoj-serwer.example npm run start:render`.

> W oknie Miku znajdziesz przełącznik **„Łącz automatycznie przy uruchomieniu”**. Zapamiętuję wybrany adres serwera oraz rolę (Oliwier lub Amelka), więc przy następnym kliknięciu `Komunikator.exe` aplikacja połączy się sama do pokoju `oliwier-amelka`.

> Zatrzymanie aplikacji następuje po zamknięciu terminala lub wciśnięciu `Ctrl + C` w oknie z uruchomionymi procesami.

## Aplikacja mobilna (Android – Capacitor)

Eksperymentalna wersja mobilna bazuje na [Capacitorze](https://capacitorjs.com/) – dzięki temu bieżący widżet Vite zostaje spakowany jako natywna aplikacja na Androida z obsługą wibracji i uruchamiania w osobnym oknie.

### Przygotowanie projektu Android

```bash
npm run setup         # instaluje zależności wszystkich modułów (w tym mobile/)
npm run build:client  # buduje widżet i tworzy katalog client/dist
npm run build:mobile  # kopiuje build do aplikacji natywnej i aktualizuje zasoby
```

Po wykonaniu powyższych kroków strukturę projektu Android znajdziesz w `mobile/android/`.
Repozytorium pozostaje w 100% tekstowe – brakujący plik `gradle-wrapper.jar` nie jest wersjonowany i przy pierwszej instalacji
zostanie pobrany automatycznie przez skrypt `npm run fetch:gradle-wrapper` uruchamiany w trakcie `npm run setup`.

### Uruchomienie w Android Studio lub z linii komend

```bash
# otwarcie w Android Studio
npm run mobile:android

# budowa pliku APK (tryb debug) bez Android Studio
cd mobile/android
./gradlew assembleDebug

# instalacja na podłączonym urządzeniu
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Pierwsze uruchomienie na telefonie pokazuje formularz z adresem serwera oraz listą wyboru roli (Oliwier lub Amelka). Pokój `oliwier-amelka` jest ustawiony na stałe, a imię partnera/partnerki uzupełnia się automatycznie. Domyślnie aplikacja wskazuje backend Render (`wss://aplikacja-komunikator.onrender.com`) i zaznacza **„Łącz automatycznie przy uruchomieniu”**, żeby po każdym starcie telefonu most WebSocket od razu wznawiał połączenie. Wybrane dane zapisują się lokalnie w pamięci aplikacji.

Wersja natywna utrzymuje łączność 24/7 dzięki dedykowanej usłudze pierwszoplanowej („Miku czuwa w tle”). Niezależnie od trybu „cichy” telefon otrzymuje głośne alerty z kanału alarmowego oraz zwykłe powiadomienia o wiadomościach – oba kanały korzystają z dźwięków o priorytecie „alarm”, aby przebić się nawet przez wyciszony dzwonek.

Wersja natywna korzysta z wibracji urządzenia, aby przyciągnąć uwagę przy nowych wiadomościach i alarmach. Warstwa WebView korzysta z tego samego kodu, co desktop i web, więc funkcje alarmu, statusów, kolejkowania oraz syntezy głosu działają identycznie.

### Przygotowanie pakietu produkcyjnego

1. Wygeneruj plik `android.keystore` i uzupełnij podpisywanie w `android/app/build.gradle` (sekcja `signingConfigs`).
2. Ustaw zmienne środowiskowe `CAPACITOR_ANDROID_STUDIO_PATH` / `ANDROID_SDK_ROOT`, aby `gradlew` korzystał z właściwego SDK.
3. Uruchom `./gradlew bundleRelease`, aby otrzymać pakiet `.aab` (Google Play) lub `./gradlew assembleRelease`, aby otrzymać podpisany `.apk` w `mobile/android/app/build/outputs/apk/release/`.
4. W razie potrzeby zmień domyślne wartości (np. adres serwera) w `client/index.html` albo dopisz mechanizm pobierania ustawień z API.

> Aby zresetować cache widżetu w aplikacji mobilnej, przytrzymaj ikonę aplikacji, wybierz *Informacje* i skorzystaj z przycisku „Wyczyść pamięć” – po ponownym uruchomieniu konieczne będzie podanie danych połączenia.

## Prototyp widżetu z awatarem

Folder `client/` zawiera graficzny panel rozmowy inspirowany dokumentacją UX:

- podświetlany awatar „Miku” reagujący na połączenie oraz status partnera/partnerki,
- historia czatu z bańkami wiadomości, potwierdzeniami odczytu i oznaczeniem kolejkowanych komunikatów,
- przyciski wysłania wiadomości tekstowej, uruchomienia alarmu (delikatny lub pilny) i aktualizacji statusu,
- wsparcie dla syntezy mowy – przychodzące wiadomości partnera/partnerki są odczytywane na głos wybranym głosem systemowym,
- wizualne oraz dźwiękowe powiadomienie o alarmie (sygnał audio + wibracje na telefonach i tabletach),
- responsywny układ i manifest PWA pozwalające zainstalować widżet jako aplikację webową na telefonie.

Widżet łączy się z serwerem, korzystając ze stałego pokoju `oliwier-amelka`; w formularzu wybierasz jedynie swoją rolę (`oliwier` lub `amelka`) oraz adres backendu. W trybie offline własne wiadomości otrzymują plakietkę „czeka na dostarczenie”, a po powrocie partnera/partnerki online pojawia się komunikat o dostarczeniu zaległych pozycji.

## Prototyp backendu

W katalogu `server/` znajduje się działający most komunikacyjny zgodny z opisem w dokumentacji. Obsługuje on:

- utrzymanie połączeń WebSocket dla dwójki użytkowników powiązanych tym samym `pairId`,
- natychmiastowe przekazywanie wiadomości tekstowych,
- uruchamianie zdarzeń alarmowych (np. do późniejszego wyzwolenia głośnego sygnału po stronie klienta),
- synchronizację statusu obecności,
- buforowanie wiadomości tekstowych i alarmów, gdy druga osoba jest offline,
- potwierdzenia odczytu (read receipts) przesyłane do nadawcy.

### Jak uruchomić

```bash
cd server
npm install
npm run dev
```

Serwer wystawia websocket pod adresem `ws://localhost:8080?pairId=<PAIR>&userId=<USER>` oraz prosty endpoint kontrolny `GET /healthz`.

### Szybki test lokalny

W dwóch terminalach uruchom skrypt kliencki, podszywając się pod obie strony rozmowy:

```bash
# terminal 1
npm run demo:client -- --user ja --pair my-pair

# terminal 2
npm run demo:client -- --user ona --pair my-pair
```

Polecenia `/alarm urgent budzik!` lub `/status busy na spotkaniu` pozwalają zasymulować przyciski akcji i synchronizację statusów. Gdy otrzymasz wiadomość z identyfikatorem, możesz potwierdzić jej odczyt komendą `/read <messageId>` (lub po prostu `/read`, żeby użyć ostatniej wiadomości). Skrypt można też użyć jednorazowo, np. `npm run demo:client -- --user ja --pair my-pair --text "Hej, słyszysz mnie?"`.

## Stały serwer online

Aby komunikator działał 24/7, wdroż prototypowy serwer WebSocket na platformie typu PaaS (np. Render, Railway, Fly.io). Najprościej zrobić to na Renderze:

1. Zrób forka repozytorium lub wskaż je bezpośrednio w kreatorze [Render Web Service](https://dashboard.render.com/).
2. Jako „Build Command” ustaw `cd server && npm install && npm run build`.
3. Jako „Start Command” ustaw `cd server && npm run start`.
4. Wybierz plan co najmniej **Starter**, aby instancja nie usypiała się po kilku minutach braku ruchu (plan Free służy jedynie do testów).
5. W zakładce **Environment** dodaj zmienną `FCM_SERVER_KEY` z kluczem serwerowym Firebase Cloud Messaging – backend wykorzysta ją do wysyłania powiadomień push.
6. Po wdrożeniu sprawdź `https://twoja-nazwa.onrender.com/healthz`. Jeśli widzisz `{"status":"ok"}`, usługa działa.

> Render w darmowym planie usypia aplikację po kilku minutach bez ruchu. Jeśli potrzebujesz działania 24/7, przełącz się na płatny plan albo skorzystaj z platformy oferującej tryb "Always On" (np. Fly.io z maszynami `shared-cpu-1x`).

Analogiczne kroki znajdziesz dla Railway i Fly.io w `docs/deployment.md` wraz z instrukcjami aktualizacji oraz monitoringu.

### Powiadomienia push i praca w tle

Serwer udostępnia endpoint `POST /register-device`, dzięki któremu aplikacje mobilne i desktopowe mogą zgłaszać swoje tokeny powiadomień (FCM). Przykład:

```bash
curl -X POST "https://twoja-nazwa.onrender.com/register-device" \
  -H "Content-Type: application/json" \
  -d '{
    "pairId": "my-pair",
    "userId": "amelia",
    "token": "FCM_TOKEN_Z_URZĄDZENIA",
    "platform": "android"
  }'
```

- przy każdym nowym alarmie lub wiadomości serwer wyśle powiadomienie do zarejestrowanych urządzeń partnera/partnerki,
- aby wyrejestrować urządzenie, wyślij `DELETE /register-device` z identycznym JSON-em,
- tokeny przechowywane są w pamięci – do środowiska produkcyjnego podłącz bazę (np. Redis) i zapisz tokeny razem z kontem użytkownika.

Na telefonie (np. Flutter + `firebase_messaging`) uruchom usługę w tle, która po odebraniu powiadomienia z pola `data` rozbudzi widżet i odtworzy alarm. Dzięki temu awatar może reagować 24/7, nawet gdy aplikacja jest zminimalizowana.

## Kolejne kroki

1. Zatwierdzenie wizji produktu i wymagań opisanych w dokumentacji.
2. Wybór stosu technologicznego (np. Flutter dla aplikacji mobilnej/desktopowej oraz backend w NestJS z WebSocketami).
3. Przygotowanie makiet UI widżetu oraz prototypu alarmu dźwiękowego.
4. Implementacja podstawowego kanału komunikacyjnego (wysyłanie/odbiór wiadomości, potwierdzenia odbioru).
5. Dodanie funkcji alarmu, statusów aktywności oraz modułu syntezy głosu.
6. Testy bezpieczeństwa oraz optymalizacja działania w tle.

Szczegółowe informacje znajdują się w plikach dokumentacji w katalogu `docs/`.
