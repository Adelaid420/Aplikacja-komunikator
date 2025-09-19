# Doświadczenie użytkownika i projekt interakcji

## Widżet z awatarem

- **Wygląd**: okrągłe okno 120x120 px z animowaną postacią (Miku). Reaguje na zdarzenia (mruga, macha, zmienia mimikę).
- **Pozycjonowanie**: użytkownik przeciąga po ekranie, widżet przykleja się do krawędzi. Na desktopie można go przypiąć nad wszystkimi oknami.
- **Tryb czuwania**: przez większość czasu półprzezroczysty (40% opacity). Po otrzymaniu wiadomości lub alarmu rozświetla się i powiększa.

## Okno rozmowy

- Minimalistyczny chat bubble, tło gradientowe inspirowane tematem Miku.
- Pasek z przyciskami: `Napisz`, `Nagraj`, `Alarm`, `Szybkie akcje` (np. "Jestem u lekarza").
- Na górze status partnerki (`online`, `zajęta`, `offline`, `alarm w toku`).

## Przepływ wiadomości

1. Kliknięcie widżetu -> otwarcie okna rozmowy.
2. Wpisanie tekstu -> przycisk "Wyślij" -> animacja wysyłania + natychmiastowa odpowiedź awatara (np. "Już leci!" głosem partnerki).
3. Po stronie partnerki: widżet powiększa się, odtwarza krótkie "ding", pojawia się dymek z treścią.
4. Po przeczytaniu partnerka dotyka widżetu -> status "przeczytane" wysyłany nadawcy.

## Przepływ alarmu

1. Użytkownik trzyma przycisk `Alarm` przez 2 s (zabezpieczenie przed przypadkowym kliknięciem).
2. Aplikacja wysyła zdarzenie `ALARM_TRIGGER` + opcjonalną wiadomość "Oddzwoń proszę".
3. U partnerki:
   - Widżet natychmiast przechodzi w tryb alarmu (pulsująca czerwona poświata).
   - Uruchamia się głośny dźwięk + wibracje + pełnoekranowe powiadomienie z przyciskiem `Jestem już`. Powiadomienie wykorzystuje kanał "Alarm" z najwyższym priorytetem (Android) lub `Critical Alert` (iOS).
   - W tle uruchamia się połączenie VoIP (opcjonalnie) – partnerka słyszy nagrane zdanie.
4. Po dotknięciu `Jestem już` alarm gaśnie po obu stronach, a nadawca otrzymuje potwierdzenie.

## Mikrointerakcje

- Awatar reaguje na dotyk (machanie), wysyła krótkie animacje w stylu "emoji".
- Feedback dźwiękowy dopasowany do emocji: delikatny dzwonek dla zwykłej wiadomości, dynamiczny dla alarmu.
- Tryb nocny: przytłumione kolory, brak intensywnego światła, dźwięk alarmu zastępuje sekwencja wibracji + powtarzany komunikat głosowy.

## Dostępność

- Kontrast i możliwość powiększenia tekstu.
- Możliwość wyłączenia animacji i samego głosu (tekst-to-speech -> odczyt + napisy).
- Obsługa bez użycia rąk: komendy głosowe ("Miku, wyślij wiadomość do Ani").

## Szybkie akcje

- Konfigurowalne przyciski (np. "Wyszedłem", "Wracam za 10 min", "Oddzwoń proszę").
- Skróty klawiszowe na desktopie (Ctrl+Shift+A – alarm, Ctrl+Enter – wyślij).
- Automatyczne odpowiedzi "Jestem w trakcie spotkania" ustawiane z harmonogramu.

## Personalizacja

- Różne skórki awatara i tła czatu.
- Możliwość nagrania własnych animacji/gestów (Lottie JSON).
- Zmiana poziomu "żywiołowości" (częstotliwość animacji, intensywność reakcji).
