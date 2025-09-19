# Architektura systemu

## Przegląd
System składa się z aplikacji klienckich (mobilnej i desktopowej), usług towarzyszących w tle oraz backendu w chmurze odpowiedzialnego za synchronizację, powiadomienia i bezpieczeństwo. Główna komunikacja pomiędzy klientami odbywa się w czasie rzeczywistym z użyciem WebSocketów z pełnym szyfrowaniem end-to-end.

```
+--------------------+      +-------------------+      +--------------------+
|  Aplikacja mobilna |<---->|  Serwer sygnałowy |<---->|  Aplikacja mobilna |
|   (Flutter, Android)|     |  (NestJS + Redis) |     |   partnerki        |
+--------------------+      +-------------------+      +--------------------+
        ^   |                         ^   |                        ^   |
        |   v                         |   v                        |   v
+--------------------+      +-------------------+      +--------------------+
| Widżet/overlay     |      |  Serwer API REST  |      |  Aplikacja desktop |
| (Android Service)  |      |  (NestJS + DB)    |      | (Flutter/Electron) |
+--------------------+      +-------------------+      +--------------------+
```

## Warstwy

1. **Frontend mobilny (Flutter)**
   - Komponent widżetu/overlay (Android: `System Alert Window`, iOS: `WidgetKit`).
   - Główny ekran rozmowy, historia czatu, przyciski alarmu.
   - Background service odpowiedzialny za utrzymanie połączenia WebSocket i reagowanie na alarmy.

2. **Frontend desktopowy**
   - Wersja Flutter Desktop lub Electron z modułem natywnym (Windows/macOS).
   - Utrzymuje widżet przypięty do pulpitu, obsługuje powiadomienia systemowe i alarm pełnoekranowy.

3. **Backend**
   - **API REST** (NestJS/Express) – rejestracja użytkowników, zarządzanie parami, tokeny, przechowywanie ustawień.
   - **Serwer sygnałowy/WebSocket** – połączenia w czasie rzeczywistym, kolejka Redis dla skalowania horyzontalnego. W repozytorium znajduje się prototypowa implementacja tego modułu (`server/`), która umożliwia lokalne testy komunikacji pary użytkowników.
   - **Baza danych** – PostgreSQL (relacyjna) + Redis (sesje, kolejki). Historia wiadomości może być przechowywana w szyfrowanej formie (np. w S3 lub w bazie dokumentowej).
   - **Serwis powiadomień push** – Firebase Cloud Messaging (Android), Apple Push Notification Service (iOS), Windows Notification Service.
   - **Serwis TTS** – integracja z zewnętrznym API lub kontener z modelem TTS; komunikacja przez kolejkę (np. RabbitMQ) w celu przygotowania próbek.

4. **Bezpieczeństwo**
   - Biblioteka libsignal dla Fluttera (np. `libsignal_protocol_dart`).
   - Backend przechowuje tylko klucze publiczne; wiadomości są szyfrowane po stronie klienta.
   - Uwierzytelnianie: Firebase Auth / Cognito lub własna implementacja z JWT + 2FA.

## Przepływy komunikacji

1. **Parowanie użytkowników**
   - Użytkownik A tworzy zaproszenie i generuje QR kod / kod alfanumeryczny.
   - Użytkownik B skanuje kod, backend tworzy parę i przekazuje klucze publiczne.

2. **Wiadomość tekstowa**
   - Klient A szyfruje wiadomość kluczem sesji i wysyła przez WebSocket.
   - Serwer sygnałowy buforuje wiadomość (Redis) i dostarcza do klienta B.
   - Klient B odszyfrowuje, aktualizuje UI widżetu i wysyła potwierdzenie.

3. **Alarm**
   - Klient A wysyła wiadomość typu `ALARM_TRIGGER`.
   - Serwer natychmiast emituje zdarzenie do klienta B.
   - Usługa w tle klienta B uruchamia powiadomienie o najwyższym priorytecie + animację widżetu.
   - Po potwierdzeniu klient B wysyła `ALARM_ACK`, które zatrzymuje animację u klienta A.

4. **Synteza głosu**
   - Wiadomość oznaczona do odczytu głosem trafia do kolejki.
   - Serwis TTS generuje plik audio i zapisuje w magazynie (np. S3) z krótkim okresem ważności.
   - Klient pobiera plik, cache'uje lokalnie i odtwarza w awatarze.

## Monitoring i DevOps

- Konteneryzacja usług backendowych (Docker + Kubernetes / ECS).
- Obserwowalność: Prometheus + Grafana, logowanie w ELK/CloudWatch.
- CI/CD: GitHub Actions (lint, testy, budowanie paczek APK/desktop).
- Testy automatyczne: unit, integracyjne, testy UI (Flutter Driver), testy obciążeniowe WebSocketów (k6).

## Wymagania sprzętowe i systemowe

- Android Service korzystający z `Foreground Service` + powiadomienie ciągłe, aby system go nie ubił.
- Na desktopie – aplikacja startuje wraz z systemem (rejestracja w autostarcie) i minimalizuje się do zasobnika.
- Obsługa trybu offline: kolejka wiadomości lokalna oraz synchronizacja po odzyskaniu połączenia.
