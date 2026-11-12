# Magic Timer — ROADMAP

## Цель

Перенести текущее PWA (vanilla JS) в нативное приложение на **Expo (React Native)**, максимально точно воспроизведя визуальный стиль встроенного таймера Samsung Galaxy (One UI).

---

## Фаза 0: Референсы и дизайн-система

**Задача:** Собрать эталон, к которому стремимся визуально.

- [ ] Скриншоты таймера Samsung Galaxy (One UI 5+ / 6):
  - Экран секундомера (запущен, остановлен, с замерами)
  - Экран таймера обратного отсчёта (если есть)
  - Экран чекпоинтов/кругов (lap times)
  - Шрифт: **SamsungOne** или **Samsung Sharp Sans** — найти или подобрать аналог
- [ ] Анимации Samsung таймера:
  - Пульсация миллисекунд/цифр при остановке?
  - Как появляются/исчезают кнопки (Start → Stop)
  - Как анимируется список замеров (slideIn)
- [ ] Цветовая палитра One UI Dark:
  - Фон: `#000000`
  - Surface: `#1c1c1e` / `#2c2c2e`
  - Зелёный: `#30d158` (Start)
  - Красный: `#ff453a` (Stop)
  - Серый: `#636366` / `#8e8e93`
  - Синий акцент: `#007aff`
- [ ] Определить target:
  - iOS + Android через Expo
  - Priority: Android (Samsung Galaxy) → iOS (iPhone)

---

## Фаза 1: Инициализация Expo-проекта

**Задача:** Развернуть Expo проект с нуля, настроить окружение.

- [ ] `npx create-expo-app@latest magic-timer-native --template blank`
- [ ] Установить базовые зависимости:
  - `expo-router` (навигация)
  - `expo-status-bar`
  - `@react-navigation/native` (если expo-router не покрывает)
  - `react-native-safe-area-context`
  - `expo-font` (для кастомного шрифта SamsungOne)
- [ ] Настроить TypeScript
- [ ] Настроить lint (eslint + prettier)
- [ ] Проверить сборку на Android (эмулятор или устройство)
- [ ] Проверить сборку на iOS (симулятор)

**Архитектура:**

```
magic-timer-native/
├── app/                    # expo-router pages
│   ├── _layout.tsx         # Root layout (темная тема, шрифты)
│   ├── index.tsx           # Главный экран (таймер)
│   └── settings.tsx        # Экран настроек
├── components/
│   ├── TimerDisplay.tsx    # Цифры MM : SS , CC
│   ├── TimerControls.tsx   # Кнопки Старт/Стоп/Сброс/Фиксация
│   ├── ModeTabs.tsx        # Переключатель режимов
│   ├── CheckpointList.tsx  # Список чекпоинтов/замеров
│   └── SettingsModal.tsx   # Модалка настроек
├── hooks/
│   ├── useTimer.ts         # Логика таймера (start/stop/reset/record)
│   ├── useFakeMs.ts        # Подмена миллисекунд
│   └── useSettings.ts      # Чтение/запись настроек (AsyncStorage)
├── utils/
│   ├── formatTime.ts       # Форматирование MM : SS , CC
│   └── constants.ts        # Цвета, размеры, шрифты
└── assets/
    └── fonts/              # SamsungOne шрифт
```

---

## Фаза 2: Визуальный движок — Samsung Clock

**Задача:** Полный pixel-perfect визуал Samsung-таймера.

### 2.1 Цвета и тема
- [ ] Определить `theme.ts` с точной цветовой палитрой One UI Dark
- [ ] Глобальный `ThemeProvider` (React Context или через `tamagui`/`restyle`)
- [ ] `StatusBar` → `hidden` или `translucent` (как в Samsung таймере)

### 2.2 Шрифты
- [ ] Раздобыть SamsungOne (или Samsung Sharp Sans) — проверить лицензию
- [ ] Fallback: `system font` (Roboto на Android, SF Pro на iOS)
- [ ] Моноширинный вариант для цифр таймера — `SamsungOne Mono` или `SF Mono`
- [ ] `font-weight: 200` (Thin/ExtraLight) для цифр — Samsung именно так
- [ ] `font-variant-numeric: tabular-nums` (фиксированная ширина цифр)

### 2.3 TimerDisplay
- [ ] Точное позиционирование: крупные цифры по центру, вертикально отцентрированы
- [ ] Формат: `MM<пробел>:<пробел>SS<пробельчик>,<пробельчик>CC`
- [ ] Двоеточие — такой же вес, как цифры
- [ ] Запятая перед CC — **меньше** (0.6–0.65em), вертикально по середине
- [ ] Сотые (CC) — **меньше** (0.6–0.65em), вертикально по середине
- [ ] `clamp(48px, 15vw, 96px)` → перевести в React Native ResponsiveFontSize
- [ ] Анимация: цифры статичны (не бегут) — обновляются по `requestAnimationFrame`

### 2.4 Кнопки управления
- [ ] Зелёная пилюля «Старт»:
  - `width: 140, height: 64, borderRadius: 32`
  - background: `#30d158`, свечение: `rgba(48, 209, 88, 0.2)`
  - Текст: «Старт» (белый, medium weight)
  - При тапе: scale(0.94)
- [ ] Красная пилюля «Стоп»:
  - те же размеры, цвет `#ff453a`, свечение `rgba(255, 69, 58, 0.2)`
  - Текст: «Стоп»
- [ ] Серый круг «Сброс»:
  - `width: 60, height: 60, borderRadius: 30`
  - background: `#1c1c1e`, border: `#2c2c2e`
  - Иконка: ↺ (стрелка сброса)
- [ ] Серый круг «Зафиксировать» (📌):
  - те же размеры, иконка оранжевая `#ff9f0a`
  - При тапе: flash (оранжевая заливка на 200ms)
- [ ] Анимации появления/исчезания кнопок (как в Samsung)
  - При старте: Start → скрыть, показать Stop + Record
  - При стопе: показать Start («Продолжить») + Reset, скрыть Stop + Record

### 2.5 Табы режимов
- [ ] Два таба: «Секундомер» / «Чекпоинты»
- [ ] Стиль: текст серый (`#8e8e93`), при выборе — белый
- [ ] Индикатор активного таба: синяя полоска снизу, анимированная ширина

### 2.6 Список замеров / чекпоинтов
- [ ] Samsung-style карточки: `surface #1c1c1e`, `borderRadius: 10`
- [ ] Номер (#1, #2, #3…) — серый мелкий слева
- [ ] Время — моноширинный белый
- [ ] В чекпоинт-режиме: подменённое время оранжевым (`#ff9f0a`) или реальное серым
- [ ] Анимация появления: slideIn снизу
- [ ] Кнопка «✕» в заголовке секции для очистки

### 2.7 Навигация (Settings)
- [ ] Шестерёнка/⋮ в правом верхнем углу
- [ ] Открывается модалка (blur-бэкдроп как в Samsung)
- [ ] Поля: список fakeMs (чипсы), режим отображения, пресеты, сброс
- [ ] Всё в той же тёмной теме

---

## Фаза 3: Ядро таймера

**Задача:** Перенести логику с PWA на React Native.

### 3.1 `useTimer` hook
- [ ] `start()`, `stop()`, `reset()`, `recordTime()`
- [ ] `performance.now()` в RN → использовать `Animated` API или `useRef` с таймером
- [ ] В RN нет `requestAnimationFrame` в фоне → использовать `setInterval(16ms)` с паузой при фоне
- [ ] Точность: нативный `NativeModules` или `react-native-reanimated` для плавности
- [ ] Состояние таймера не должно уходить вперёд при свёрнутом приложении → фиксировать `Date.now()` в `AppState` listener

### 3.2 `useFakeMs` hook
- [ ] Циклический перебор по индексу
- [ ] Индекс растёт на каждый stop + каждый record
- [ ] Сброс индекса при `reset()`

### 3.3 `useSettings` hook
- [ ] `AsyncStorage` вместо `localStorage`
- [ ] Ключ: `@magic_timer_settings`
- [ ] Структура: `{ fakeMs: number[], displayMode: 'faked' | 'real' | 'both' }`

### 3.4 Нативные фичи (новые, не было в PWA)
- [ ] **Вибрация** при старте/стопе/фиксации — `expo-haptics`
- [ ] **Блокировка автоблокировки экрана** во время работы таймера — `expo-keep-awake`
- [ ] **Звук** при фиксации чекпоинта (короткий клик, как в Samsung) — `expo-av`
- [ ] **Always-On Display** подсказка (Android) — через `react-native-aod` или кастомный NativeModule
- [ ] **Edge-to-edge** дисплей, safe areas

---

## Фаза 4: Детали Samsung-стиля (pixel perfect)

**Задача:** Добиться визуального сходства с реальным таймером Samsung.

- [ ] Протестировать на реальном Samsung Galaxy (S22/S23/S24)
- [ ] Проверить отступы: padding в `#app` — `16px 24px`
- [ ] Поведение статус-бара: в Samsung таймере статус-бар скрыт или полностью чёрный
- [ ] Landscape-режим: заблокировать портрет (как в Samsung)
- [ ] Иконка приложения: простая, без бренда, на чёрном фоне (как иконка часов Samsung)
- [ ] Splash screen: чёрный, без логотипа
- [ ] Анимация перехода между экранами (таймер ↔ настройки): modal slide from bottom (как Samsung)
- [ ] Haptic feedback на кнопки (лёгкий)

---

## Фаза 5: Публикация

**Задача:** Выкатить приложение.

- [ ] Google Play Console:
  - Подготовить аккаунт ($25)
  - Собрать AAB через EAS Build
  - Скриншоты, описание, иконка
  - Policy check (таймер — не нарушает)
- [ ] App Store Connect:
  - $99/год
  - Собрать IPA через EAS Build
  - Скриншоты (в т.ч. для iPad — если поддерживаем)
- [ ] EAS Build + EAS Submit:
  - `eas build --platform android`
  - `eas build --platform ios`
  - `eas submit`
- [ ] Альтернатива (пока не готовы платить):
  - GitHub Actions → релизные APK для ручной установки
  - TestFlight для iOS (бесплатно)

---

## Фаза 6: CI/CD и тестирование

**Дополнительно, после публикации.**

- [ ] EAS Update (OTA-обновления)
- [ ] Detox / Maestro для E2E-тестов
- [ ] GitHub Actions: линтер + TypeScript check на каждый PR
- [ ] Sentry/Crashlytics для мониторинга ошибок

---

## PWA → Expo: миграция фич

| Фича PWA | Статус | В Expo |
|----------|--------|--------|
| Формат MM : SS , CC | ✅ перенесено | `formatTime.ts` |
| Подмена миллисекунд | ✅ перенесено | `useFakeMs.ts` |
| Два режима (сек/чек) | ✅ | `useTimer.ts` |
| Список замеров | ✅ | `CheckpointList.tsx` |
| Настройки (fakeMs) | ✅ | `SettingsModal.tsx`, `useSettings.ts` |
| localStorage | ➡️ | `AsyncStorage` |
| Service Worker | ➡️ | Не нужен в нативном |
| Keyboard shortcuts | ➡️ | Нативные кнопки + Bluetooth клавиатура (опционально) |
| Samsung-стиль | ➡️ | Полный редизайн (Фаза 2) |
| Вибрация | ❌ новая | `expo-haptics` |
| Keep awake | ❌ новая | `expo-keep-awake` |
| Звук фиксации | ❌ новая | `expo-av` |
| AOD | ❌ новая | Native module |

---

## Критерии готовности

- [ ] Внешний вид неотличим от Samsung таймера на Galaxy S23/S24 (слепой тест)
- [ ] Все функции PWA работают в нативном приложении
- [ ] Таймер не сбивается при свёртывании/развёртывании
- [ ] Сборка проходит для Android (APK/AAB) и iOS (IPA)
- [ ] Приложение опубликовано в Google Play (хотя бы в закрытом тесте)
