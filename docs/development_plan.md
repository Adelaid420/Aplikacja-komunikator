# Plan rozwoju i roadmapa

## Etap 0 – Przygotowanie
- Analiza wymagań (ten dokument + warsztaty z użytkownikami).
- Wybór stosu technologicznego (Flutter + NestJS) i usług w chmurze (AWS/GCP).
- Przygotowanie repozytoriów, CI/CD, środowisk (dev/stage/prod).

## Etap 1 – Podstawowy komunikator (Sprinty 1-3)
1. **Sprint 1**
   - Projekt UI widżetu i ekranów czatu (Figma).
   - Referencyjny prototyp webowy (`client/`) – weryfikacja przepływów i interakcji.
   - Skeleton aplikacji Flutter (Android) z modułem logowania.
   - Backend: endpointy rejestracji/logowania, parowanie użytkowników.
2. **Sprint 2**
   - Implementacja WebSocketów (Socket.IO lub raw WS) w aplikacji.
   - Lokalna baza danych (Hive/Drift) na historię wiadomości.
   - Backend: kolejka Redis, dostarczanie wiadomości, potwierdzenia. (Prototypowy most WS dostępny w katalogu `server/` umożliwia rozpoczęcie testów klienta.)
3. **Sprint 3**
   - Widżet floating (Android `OverlayPermissions`, Windows always-on-top).
   - Push notyfikacje i podstawowe animacje awatara.
   - Testy E2E (wysyłanie wiadomości, potwierdzenia).

## Etap 2 – Alarm i tryby specjalne (Sprinty 4-5)
- Implementacja przycisku alarmu z przytrzymaniem.
- Android/iOS: kanały powiadomień o najwyższym priorytecie, obsługa `Do Not Disturb`.
- Desktop: okno pełnoekranowe i dźwięk alarmowy.
- Synchronizacja statusów i przycisk `Jestem już`.
- Testy UX z realnymi urządzeniami (wyłączone dźwięki, tryb nocny).

## Etap 3 – Synteza głosu i personalizacja (Sprinty 6-7)
- Integracja z usługą TTS (np. ElevenLabs API) + cache lokalny.
- Panel ustawień awatara (skórki, animacje, szybkość mowy).
- Nagrywanie próbek głosu i trenowanie modelu (pipelines offline).
- Obsługa komend głosowych.

## Etap 4 – Stabilizacja i wydanie (Sprinty 8-9)
- Hardenowanie bezpieczeństwa (audyt szyfrowania, uwierzytelnianie 2FA).
- Monitoring, alerting, autoskalowanie backendu.
- Publikacja wersji beta (TestFlight, Google Play Internal Testing, wydanie instalatora desktopowego).
- Zbieranie feedbacku i poprawki.

## Lista zadań technicznych (wycinek)

| Obszar | Zadanie | Priorytet |
|-------|---------|-----------|
| Mobile | Implementacja `ForegroundService` podtrzymującego WebSocket | Wysoki |
| Mobile | Widżet overlay z animacją Lottie i reakcją na dotyk | Wysoki |
| Desktop | Obsługa autostartu i okna zawsze na wierzchu | Średni |
| Backend | Protokół szyfrowania end-to-end i rotacja kluczy | Wysoki |
| Backend | Kolejka alarmów i gwarantowana dostawa (retry + TTL) | Wysoki |
| DevOps | Pipeline CI/CD generujący APK, IPA (po TestFlight) i paczkę desktopową | Średni |
| QA | Scenariusze testów alarmu, w tym tryb DND, tryb nocny, offline | Wysoki |

## Metryki sukcesu
- Czas od wysłania wiadomości do wyświetlenia: < 1 s (P95).
- Czas reakcji alarmu: < 500 ms.
- Wskaźnik dostarczonych alarmów: 100% (z powtórnym wywołaniem).
- Satysfakcja użytkowników w badaniach: NPS > 50.
- Średnie dzienne użycie: min. 5 interakcji na osobę.
