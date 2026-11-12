# Android-версия Magic Timer

Нативное приложение на React Native и Expo SDK 57. Веб-версия в корне проекта остаётся независимой.

## Публичное отображение (1.0.1)

На табло и в скопированных результатах есть только одна временная шкала: реальные значения в скобках и второй счётчик удалены. Старое поле настроек `displayMode` игнорируется при загрузке.

Заданные сотые применяются к общему времени. Время круга — разность соседних показанных итогов. После интервала и после остановки отсчёт продолжается от показанного значения. «Реальное» означает обычное течение этой же шкалы без новой подмены. При очень быстрых нажатиях переход через секунду не допускает отрицательного круга.

Проверка расчётов: `npm test`. Проверка типов: `npm run typecheck`.

## Запуск для разработки

```bash
npm install
npm run android
```

## APK через EAS Build

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Профиль `preview` создаёт устанавливаемый APK. Профиль `production` создаёт AAB для Google Play.

## Локальная сборка APK

```bash
npx expo prebuild --platform android
cd android
gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

Готовый файл: `android/app/build/outputs/apk/release/app-release.apk`.

Локальная release-сборка рассчитана на ARM-телефоны, подписана тестовым Android-ключом и подходит для ручной установки. Для публикации используйте EAS-профиль `production` и отдельный производственный ключ.
