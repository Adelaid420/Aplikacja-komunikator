# Aplikacja komunikator "Miku"

Repozytorium zawiera dokumentację wstępną komunikatora, który pozwala na natychmiastowe porozumiewanie się z drugą osobą przy pomocy stałego, animowanego awatara widocznego na ekranie telefonu i komputera. System ma wspierać błyskawiczne przesyłanie wiadomości, uruchamianie alarmów dźwiękowych oraz komunikację głosową przy wykorzystaniu spersonalizowanego głosu (np. głosu partnerki).

## Główne założenia produktu

- Stała obecność małego widżetu z awatarem "Miku" na pulpicie telefonu oraz komputera.
- Dwukierunkowe przesyłanie krótkich wiadomości tekstowych, które natychmiast pojawiają się w widżecie drugiej osoby.
- Przyciski akcji (np. "Włącz alarm", "Zadzwoń") wymuszające zwrócenie uwagi odbiorcy poprzez głośny sygnał, wibracje i powiadomienie na całym ekranie.
- Tryb komunikacji głosowej wykorzystujący syntezę głosu partnerki do odczytywania wiadomości.
- Działanie w tle z minimalnym zużyciem baterii oraz możliwość automatycznego uruchamiania po starcie systemu.
- Bezpieczna synchronizacja poprzez szyfrowanie end-to-end i uwierzytelnianie dwuskładnikowe.

## Struktura repozytorium

- `docs/product_requirements.md` – szczegółowe wymagania funkcjonalne i niefunkcjonalne oraz historie użytkownika.
- `docs/system_architecture.md` – proponowana architektura rozwiązania (frontend, backend, usługi w tle, przetwarzanie głosu).
- `docs/experience_design.md` – opis zachowania widżetu, scenariuszy interakcji i przepływów alarmów.
- `docs/development_plan.md` – plan wdrożenia, etapy projektowe oraz lista zadań na pierwsze sprinty.

## Kolejne kroki

1. Zatwierdzenie wizji produktu i wymagań opisanych w dokumentacji.
2. Wybór stosu technologicznego (np. Flutter dla aplikacji mobilnej/desktopowej oraz backend w NestJS z WebSocketami).
3. Przygotowanie makiet UI widżetu oraz prototypu alarmu dźwiękowego.
4. Implementacja podstawowego kanału komunikacyjnego (wysyłanie/odbiór wiadomości, potwierdzenia odbioru).
5. Dodanie funkcji alarmu, statusów aktywności oraz modułu syntezy głosu.
6. Testy bezpieczeństwa oraz optymalizacja działania w tle.

Szczegółowe informacje znajdują się w plikach dokumentacji w katalogu `docs/`.
