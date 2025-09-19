# Wymagania produktu

## Cel
Stworzenie dwukierunkowego komunikatora działającego w tle, w którym każda osoba widzi i słyszy spersonalizowanego awatara (np. małą Miku) reagującego na wiadomości oraz akcje. Narzędzie ma umożliwić szybkie zwrócenie uwagi drugiej osoby poprzez alarm dźwiękowy i wizualny, nawet gdy telefon jest wyciszony.

## Persony

1. **Ja** – inicjuję kontakt, chcę szybko upewnić się, że partnerka zobaczy i usłyszy wiadomość.
2. **Partnerka** – otrzymuje wiadomości, często ma wyciszony telefon, potrzebuje wyraźnego sygnału kiedy muszę się z nią pilnie skontaktować.

## Historie użytkownika

- Jako użytkownik chcę wysłać krótką wiadomość tekstową, która natychmiast wyświetli się w widżecie partnerki.
- Jako użytkownik chcę wymusić alarm dźwiękowy i wibrację, by partnerka zauważyła, że pilnie potrzebuję kontaktu.
- Jako użytkownik chcę sprawdzić status (online, zajęta, offline), żeby wiedzieć czy partnerka jest dostępna.
- Jako użytkownik chcę wysłać krótkie nagranie głosowe, które awatar odtworzy głosem partnerki.
- Jako użytkownik chcę otrzymać potwierdzenie, że moja wiadomość została przeczytana.

## Funkcje MVP

1. **Widżet/overlay**
   - Mały awatar (SVG/Lottie) widoczny na telefonie i komputerze.
   - Możliwość przeciągnięcia po ekranie oraz przypięcia do rogu.
   - Tapnięcie/kliknięcie otwiera okno rozmowy.

2. **Wiadomości tekstowe**
   - Wysyłanie i odbieranie w czasie rzeczywistym (WebSockety).
   - Historia przechowywana lokalnie oraz opcjonalnie w chmurze.
   - Powiadomienia push z treścią.

3. **Alarm**
   - Przycisk "Włącz alarm" uruchamia pełnoekranowe powiadomienie u partnerki z głośnym dźwiękiem i animacją.
   - Alarm działa także przy wyciszonym telefonie (wykorzystanie kanału powiadomień o najwyższym priorytecie).
   - Możliwość zatrzymania alarmu po potwierdzeniu.

4. **Synteza głosu**
   - Silnik TTS (np. ElevenLabs, Azure TTS, lokalny Coqui) odtwarza wiadomości głosem partnerki.
   - Możliwość nagrania oryginalnych próbek i trenowania modelu głosu.

5. **Bezpieczeństwo**
   - Logowanie pary użytkowników poprzez zaproszenie i kod jednorazowy.
   - Szyfrowanie end-to-end (np. protokół Double Ratchet / libsignal).
   - Możliwość zablokowania nieautoryzowanych urządzeń.

## Wymagania niefunkcjonalne

- Działanie w tle z ograniczonym zużyciem baterii (<3% dziennie).
- Czas dostarczenia wiadomości <1 s przy stabilnym połączeniu.
- Dostępność aplikacji backendowej 99,5% miesięcznie.
- Zgodność z Androidem (11+) i Windows/macOS (aplikacja desktopowa).
- Skalowalność do obsługi wielu par użytkowników (docelowo SaaS).

## Przyszłe rozszerzenia

- Tryb transmisji wideo z awatarem 3D.
- Integracja z zegarkiem (wearables) dla dodatkowych powiadomień.
- Automatyczne odtwarzanie uspokajających komunikatów/playlist.
- Harmonogram przypomnień oraz dziennik nastroju.
