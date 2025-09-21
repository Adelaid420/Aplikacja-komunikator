# Budowanie aplikacji mobilnej Komunikator Miku

Ten dokument opisuje proces spakowania istniejącego widżetu Vite do aplikacji mobilnej na Androida z wykorzystaniem Capacitor 6. Dzięki temu możesz zainstalować komunikator na telefonie, ustawić własne identyfikatory i utrzymywać połączenie z backendem działającym w chmurze.

## Wymagania wstępne

- Node.js 18+ (repozytorium korzysta z wersji 22.x na Renderze, lokalnie wystarczy 18 lub nowsza),
- Java 17 (JDK) oraz Android SDK/Android Studio do zbudowania natywnego projektu,
- `adb` (Android Platform Tools) jeżeli chcesz instalować APK z terminala,
- skonfigurowany backend WebSocket – np. nasz prototyp na Renderze (`wss://aplikacja-komunikator.onrender.com`).

## Instalacja zależności

```bash
npm run setup         # instaluje moduły server/, client/, desktop/ oraz mobile/
```

Po zakończeniu instalacji w katalogu `mobile/` pojawią się zależności Capacitor (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`).
Skrypt postinstall automatycznie pobiera brakujący plik `gradle-wrapper.jar` bezpośrednio z repozytorium Gradle, więc w repozytorium
pozostają wyłącznie pliki tekstowe. W razie potrzeby możesz ręcznie wywołać `npm run fetch:gradle-wrapper` w katalogu `mobile/`.

## Synchronizacja kodu widżetu z aplikacją mobilną

1. Zbuduj frontend widżetu:
   ```bash
   npm run build:client
   ```
2. Zaktualizuj natywne zasoby:
   ```bash
   npm run build:mobile
   ```

Polecenie `build:mobile` uruchamia `npx cap sync android`, co kopiuje zawartość `client/dist` do `mobile/android/app/src/main/assets/public` oraz aktualizuje plik `capacitor.config.ts`.

## Uruchomienie w Android Studio

```bash
npm run mobile:android
```

Skrypt otworzy projekt znajdujący się w `mobile/android/`. Dalej możesz:

- uruchomić emulator lub fizyczne urządzenie,
- zbudować i zainstalować aplikację prosto z Android Studio,
- podglądać logcat i korzystać z debuggera Chrome DevTools (`chrome://inspect`).

## Budowa APK z wiersza poleceń

```bash
cd mobile/android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

APK w trybie debug umożliwia szybkie ręczne testy. Do publikacji w sklepie Google Play wykorzystaj `./gradlew bundleRelease` (pakiet `.aab`) lub `./gradlew assembleRelease` (podpisany `.apk`).

## Konfiguracja aplikacji w telefonie

Po instalacji i pierwszym uruchomieniu zobaczysz formularz identyczny jak w wersji webowej – adres serwera oraz rozwijaną listę z rolami Oliwier/Amelka. Pokój `oliwier-amelka` pozostaje stały, a imię partnera/partnerki dobiera się automatycznie. Dla wygody mobilnej ustawiliśmy:

- domyślny adres serwera na `wss://aplikacja-komunikator.onrender.com`,
- automatyczne łączenie po starcie aplikacji,
- wibracje przy nowych wiadomościach i alarmach,
- usługa w tle utrzymująca połączenie 24/7 z powiadomieniem systemowym „Miku czuwa w tle”,
- kanały powiadomień o wysokim priorytecie (wiadomości + alarmy grają jak budzik nawet przy wyciszonym telefonie),
- responsywny layout obejmujący cały ekran (bez ramek, dopasowany do notcha i pasków systemowych).

Dane połączenia (adres serwera oraz wybrana rola) zapisują się lokalnie. Aby je wyczyścić, skorzystaj z ustawień aplikacji w systemie Android (`Informacje o aplikacji` → `Pamięć` → `Wyczyść pamięć`).

## Dalsze kroki rozwojowe

- Dodanie natywnej obsługi powiadomień push (FCM) oraz usług w tle – backend udostępnia już endpoint `POST /register-device`.
- Integracja z API telefonu (kontakty, wybieranie numeru) za pomocą pluginów Capacitor.
- Wsparcie dla iOS poprzez `npx cap add ios` i konfigurację Xcode.
- Automatyczne podpisywanie aplikacji i CI/CD (np. GitHub Actions + Fastlane).

> Projekt `mobile/` jest generowany automatycznie. Jeżeli zaktualizujesz layout widżetu w katalogu `client/`, wystarczy ponownie wykonać `npm run build:client && npm run build:mobile`, aby aplikacja mobilna otrzymała najnowsze zmiany.
