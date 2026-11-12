# Magic Timer

Таймер для фокусников с подменой сотых долей секунды: вместо реальных миллисекунд
табло показывает заранее заданные «магические» значения, поэтому момент остановки
выглядит предсказуемым. Интерфейс — в стиле штатного таймера Samsung (One UI), тёмная
тема, русские подписи.

В репозитории две независимые реализации одного и того же:

| Часть | Каталог | Что это |
|-------|---------|---------|
| PWA | корень (`index.html`, `css/`, `js/`, `sw.js`) | vanilla JS без сборщиков, открывается прямо в браузере, ставится как PWA |
| Android | `mobile/` | React Native + Expo SDK 57, нативная сборка, APK |

## PWA (корень)

Никаких зависимостей и сборки — достаточно открыть `index.html`.
Для установки как PWA нужен любой статический хостинг по HTTPS.

## Android (`mobile/`)

Текущая версия — **1.0.5** (`versionCode 6`, пакет `com.magicapps.magictimer`).

```bash
cd mobile
npm install
npm run android      # запуск на устройстве/эмуляторе
npm test             # проверка расчётов подмены (timer-core)
npm run typecheck    # проверка типов
```

Сборка APK локально (Windows):

```bash
cd mobile
npx expo prebuild --platform android
cd android
gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

Готовый файл — `mobile/android/app/build/outputs/apk/release/app-release.apk`.
Каталог `mobile/android/` в репозиторий не попадает: он генерируется `expo prebuild`.

Через EAS: `npx eas-cli build --platform android --profile preview` (APK) или
`--profile production` (AAB для Google Play).

## Документация

- `AGENTS.md` — архитектура PWA, правила правок (не менять формат времени, не добавлять фреймворки и брендинг)
- `ROADMAP.md` — план миграции PWA на React Native
- `mobile/design-qa.md` — сверка нативной версии с эталоном «Часы» Samsung
