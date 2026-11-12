# Magic Timer — ROADMAP для Codex CLI

## Цель

Сделать приложение-таймер для фокусников, визуально идентичное встроенному секундомеру в приложении «Часы» на Samsung Galaxy (One UI). Ключевая фича — **подмена миллисекунд** при каждом нажатии «Круг» и на «Стоп».

**Платформа:** React Native (Expo) → Android + iOS  
**Инструмент:** Codex CLI  
**Референс:** скриншот таймера Samsung One UI (есть в архиве)

---

## Фаза 0: Подготовка

### 0.1 Инициализация Expo проекта
```bash
npx create-expo-app@latest magic-timer --template blank-typescript
cd magic-timer
npx expo install expo-router expo-status-bar expo-font expo-haptics expo-keep-awake expo-av
npx expo install @react-navigation/native react-native-safe-area-context
```

### 0.2 Настройка expo-router
Переписать структуру под expo-router:
```
magic-timer/
├── app/
│   ├── _layout.tsx     # Root: тёмная тема, шрифты, SafeAreaProvider
│   └── index.tsx       # Главный экран — секундомер
├── components/
│   ├── TimerDisplay.tsx
│   ├── TimerControls.tsx
│   ├── LapList.tsx
│   └── SettingsModal.tsx
├── hooks/
│   ├── useTimer.ts
│   ├── useFakeMs.ts
│   └── useSettings.ts
├── utils/
│   ├── formatTime.ts
│   └── theme.ts
└── assets/
    └── fonts/
```

### 0.3 Шрифт SamsungOne
Скачать SamsungOne UI TTF (искать в APK Samsung Clock или на GitHub по `SamsungOneUI-400.ttf`). Положить в `assets/fonts/`.  
**Fallback:** Inter ExtraLight 200 (Google Fonts) — визуально ближе всего.

---

## Фаза 1: Экран секундомера — layout

### 1.1 Тёмная тема (theme.ts)
```ts
export const colors = {
  bg: '#000000',
  surface: '#1c1c1e',
  surface2: '#2c2c2e',
  text: '#ffffff',
  textDim: '#8e8e93',
  textDisabled: '#48484a',
  green: '#30d158',
  red: '#ff453a',
  orange: '#ff9f0a',
  blue: '#007aff',
};
```

### 1.2 TimerDisplay — крупные цифры по центру
- Шрифт: SamsungOne UI / Inter, weight 200 (Thin/ExtraLight)
- Формат: `MM : SS , CC` (с пробелами вокруг двоеточия)
- Двоеточие — полный размер, как цифры
- Запятая перед CC — 0.6em от основного размера
- Сотые (CC) — 0.6em, выровнены по baseline
- `font-size: clamp(60px, 18vw, 112px)` → в RN использовать `Dimensions` или `react-native-responsive-fontsize`
- `font-variant-numeric: tabular-nums` (фикс. ширина цифр)
- Занять ~40-50% высоты экрана, отцентрировать по вертикали

### 1.3 Кнопки — Samsung dual button layout
**Логика состояний (state machine):**

| Состояние | Левая кнопка | Правая кнопка |
|-----------|-------------|---------------|
| idle      | «Круг» (disabled, серый) | «Старт» (зелёный круг) |
| running   | «Круг» (активен, белый) | «Стоп» (красный круг) |
| paused    | «Сброс» (красный контур) | «Продолжить» (зелёный круг) |

**Размеры:**
- Правая (primary): `width: 80, height: 80, borderRadius: 40` (круг)
- Левая (secondary): `width: 72, height: 72, borderRadius: 36` (круг)
- Расстояние между кнопками: `gap: 28`
- При нажатии: `scale(0.92)`

**Цвета кнопок:**
- Start: `bg: #30d158`, тень: `rgba(48, 209, 88, 0.15)` radius 8px
- Stop: `bg: #ff453a`, тень: `rgba(255, 69, 58, 0.15)` radius 8px
- Lap active: `bg: transparent, border: 2px solid #2c2c2e`
- Reset: `bg: transparent, border: 2px solid #2c2c2e, text: #ff453a`
- Lap disabled: `bg: transparent, color: #48484a`

### 1.4 Список кругов (LapList)
- Всегда виден (когда пуст — надпись «Круги»)
- Новые замеры сверху (как в Samsung)
- Строка: `Круг N` слева, `MM:SS,CC` справа
- Разделитель: `border-bottom: 1px solid rgba(255,255,255,0.04)`
- `padding: 12px 16px`
- Анимация появления: `slideIn` (translateY -8 + scale 0.97 → 1, 0.25s, ease-out)
- ScrollView с тонким скроллбаром

---

## Фаза 2: Логика таймера

### 2.1 useTimer hook
```ts
interface TimerState {
  running: boolean;
  paused: boolean;
  elapsed: number;      // ms накоплено
  startTime: number;    // performance.now() при старте
}

// Методы
start()     → running=true, startTime=performance.now()
stop()      → running=false, paused=true, elapsed+=delta, подмена мс
continue()  → running=true, paused=false, startTime=performance.now()
reset()     → всё сброс, elapsed=0, lapIndex=0, laps=[]
```

**Обновление дисплея:** setInterval(10ms) → `useEffect` с interval, который тикает пока running.  
**Точность:** `performance.now()` на нативном — не так точна. Лучше `Date.now()` с вычитанием. Или использовать `react-native-reanimated` с worklet.

**Фон:** подписаться на `AppState` — при уходе в фон запомнить `Date.now()`, при возврате скорректировать `startTime`.

### 2.2 useFakeMs hook
```ts
// Циклический массив
fakeMs: number[] = [40, 3, 21, 77, 15, 88, 50];
lapIndex: number = 0;

getNextFakeMs(): number {
  const val = fakeMs[lapIndex % fakeMs.length];
  lapIndex++;
  return val;
}
```
Вызывается при каждом нажатии «Круг» и при «Стоп».

### 2.3 useSettings hook
```ts
interface Settings {
  fakeMs: number[];            // список чисел 0-99
  displayMode: 'faked' | 'real' | 'both';
}

// AsyncStorage ключ: @magic_timer_settings
```

---

## Фаза 3: Настройки (SettingsModal)

### 3.1 Модалка
- Открывается по кнопке `⋮` в правом верхнем углу
- Bottom sheet (slide from bottom) с blur-бэкдропом
- Samsung-стиль: `borderRadius: 20, скругление только сверху`

### 3.2 Поля настроек
1. **Список fakeMs** — чипсы (синие цифры на сером фоне, `borderRadius: 20`)
2. **Кнопка «+ Добавить»** — поле ввода числа 0-99
3. **Пресеты**: «Классика (40,3,21,…)», «Ровные (0)», «Макс (99)»
4. **Режим отображения** — select: «Подменённые» / «Реальные» / «Оба значения»
5. **Сбросить всё** — красная кнопка

---

## Фаза 4: Нативные фичи (после основы)

- [ ] **Haptics** — `expo-haptics` при старте/стопе/круге (лёгкий impact)
- [ ] **Keep awake** — `expo-keep-awake` блокирует автоблокировку экрана
- [ ] **Звук фиксации** — короткий клик `expo-av` при нажатии «Круг» (как в Samsung)
- [ ] **Edge-to-edge** — `expo-status-bar` translucent, safe areas
- [ ] **Orientation lock** — только портрет

---

## Фаза 5: Pixel-perfect доводка

- [ ] Проверить на реальном Samsung Galaxy — открыть рядом с родным таймером
- [ ] Свернуть отступы: paddings, gaps между всеми элементами
- [ ] Шрифт: добиться идеального начертания цифр (Thin 200)
- [ ] Статус-бар: полностью чёрный или скрыт (как в Samsung)
- [ ] Анимация перехода настроек: slide from bottom с blur
- [ ] Splash screen: чёрный, без логотипа
- [ ] Иконка: минималистичная, на чёрном фоне

---

## Фаза 6: Публикация

1. **Google Play:** аккаунт $25, AAB через `eas build --platform android`, скриншоты
2. **App Store:** $99/год, IPA через `eas build --platform ios`
3. **Альтернатива:** GitHub Actions → APK для ручной установки (бесплатно)

---

## Быстрый старт (Copy-paste for Codex CLI)

```bash
# 1. Создать проект
npx create-expo-app@latest magic-timer --template blank-typescript
cd magic-timer

# 2. Установить зависимости
npx expo install expo-router expo-status-bar expo-font expo-haptics expo-keep-awake expo-av
npx expo install @react-navigation/native react-native-safe-area-context
npx expo install react-native-reanimated

# 3. Настроть expo-router в app.json:
#   "scheme": "magic-timer",
#   "plugins": ["expo-router"]

# 4. Запустить
npx expo start

# 5. Сборка
eas build --platform android --profile preview
```

---

## Структура для Codex

Каждый шаг — отдельный запрос к Codex CLI. Рекомендуемый порядок:

1. **Init** — создать проект + структуру папок
2. **Theme** — theme.ts, formatTime.ts, константы
3. **TimerDisplay** — крупные цифры, шрифт, формат
4. **useTimer** — хук с таймером
5. **TimerControls** — две круглые кнопки, state machine
6. **LapList** — список кругов с анимацией
7. **useFakeMs + useSettings** — подмена мс и настройки
8. **SettingsModal** — модалка bottom sheet
9. **Index screen** — собрать всё вместе
10. **Haptics + KeepAwake** — нативные фичи
11. **Pixel-perfect** — доводка под скриншот
12. **Build & Publish** — сборка и публикация
