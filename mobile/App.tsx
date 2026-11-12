import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureTime } from './timer-core';
import {
  deleteCustomPreset,
  sanitizePresets,
  sanitizeSequence,
  saveCustomPreset,
} from './preset-core';
import type { CustomPreset } from './preset-core';
import { createLaunchTime, cycleSelectedPreset, getSelectedPresetIndex } from './preset-control';

type TimerPhase = 'idle' | 'running' | 'paused';
type FakeSequenceItem = number | 'real';
type Settings = {
  fakeMs: FakeSequenceItem[];
  customPresets: CustomPreset[];
  selectedPresetId: string | null;
  presetEnabled: boolean;
  launchRandomTime: boolean;
};
type Lap = {
  index: number;
  elapsedMs: number;
  lapMs: number;
  total: string;
  split: string;
};

const COLORS = {
  background: '#000000',
  surface: '#1c1c1e',
  surfaceRaised: '#2d2d30',
  text: '#f5f3f7',
  textDim: '#8c898f',
  textDisabled: '#5b595d',
  divider: '#343237',
  purple: '#6862ed',
  red: '#ed322c',
  lapRed: '#ff6663',
};

const DEFAULT_SETTINGS: Settings = {
  fakeMs: [40, 3, 21],
  customPresets: [],
  selectedPresetId: null,
  presetEnabled: false,
  launchRandomTime: false,
};
const SETTINGS_KEY = 'magicTimer_settings';
const BOTTOM_TABS = [
  { label: 'Будильник', icon: 'alarm' as const, action: 'announce' as const },
  { label: 'Мир. время', icon: 'web-clock' as const, action: 'previous' as const },
  { label: 'Секундомер', icon: 'timer' as const, action: 'toggle' as const, active: true },
  { label: 'Таймер', icon: 'timer-sand' as const, action: 'next' as const },
];
type HiddenTabAction = typeof BOTTOM_TABS[number]['action'];

function formatTime(milliseconds: number) {
  const totalCentiseconds = Math.floor(Math.max(0, milliseconds) / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return {
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
    centiseconds: String(centiseconds).padStart(2, '0'),
    display: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(centiseconds).padStart(2, '0')}`,
  };
}

function sanitizeSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS;
  const candidate = value as Partial<Settings>;
  const fakeMs = sanitizeSequence(candidate.fakeMs);
  const customPresets = sanitizePresets(candidate.customPresets);
  const selectedPresetId = customPresets.some((preset) => preset.id === candidate.selectedPresetId)
    ? candidate.selectedPresetId ?? null
    : customPresets[0]?.id ?? null;
  return {
    fakeMs: Array.isArray(candidate.fakeMs) ? fakeMs : DEFAULT_SETTINGS.fakeMs,
    customPresets,
    selectedPresetId,
    presetEnabled: customPresets.length > 0 && candidate.presetEnabled === true,
    launchRandomTime: candidate.launchRandomTime === true,
  };
}

const TimerDisplay = memo(function TimerDisplay({
  elapsedMs,
  compact,
}: {
  elapsedMs: number;
  compact: boolean;
}) {
  const { width } = useWindowDimensions();
  const time = formatTime(elapsedMs);
  const fontSize = Math.min(62, Math.max(47, width * 0.14));
  const centiseconds = time.centiseconds;

  return (
    <View style={[styles.timerBlock, styles.nonInteractive, compact ? styles.timerBlockCompact : styles.timerBlockIdle]}>
      <Text
        style={[styles.timerText, { fontSize }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        accessible
        accessibilityLabel={`${time.minutes} минут ${time.seconds} секунд ${centiseconds} сотых`}
      >
        {time.minutes} : {time.seconds} , {centiseconds}
      </Text>
    </View>
  );
});

const LapTable = memo(function LapTable({ laps }: {
  laps: Lap[];
}) {
  const fastest = useMemo(() => {
    if (laps.length < 2) return null;
    return laps.reduce((best, lap) => lap.lapMs < best.lapMs ? lap : best).index;
  }, [laps]);
  const slowest = useMemo(() => {
    if (laps.length < 2) return null;
    return laps.reduce((worst, lap) => lap.lapMs > worst.lapMs ? lap : worst).index;
  }, [laps]);
  const reversed = useMemo(() => [...laps].reverse(), [laps]);

  const renderItem = useCallback(({ item }: { item: Lap }) => {
    const highlight = item.index === fastest
      ? styles.fastestLap
      : item.index === slowest
        ? styles.slowestLap
        : null;
    return (
      <View style={styles.lapRow}>
        <Text style={[styles.lapCell, styles.lapNumber, highlight]}>{String(item.index).padStart(2, '0')}</Text>
        <Text style={[styles.lapCell, styles.lapSplit, highlight]} numberOfLines={1} adjustsFontSizeToFit>
          {item.split}
        </Text>
        <Text style={[styles.lapCell, styles.lapTotal, highlight]} numberOfLines={1} adjustsFontSizeToFit>
          {item.total}
        </Text>
      </View>
    );
  }, [fastest, slowest]);

  if (laps.length === 0) return null;
  return (
    <View style={styles.lapTable}>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, styles.lapNumber]}>Круг</Text>
        <Text style={[styles.headerCell, styles.lapSplit]}>Время круга</Text>
        <Text style={[styles.headerCell, styles.lapTotal]}>Общее время</Text>
      </View>
      <FlatList
        data={reversed}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.index)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.lapsContent}
      />
    </View>
  );
});

const BottomNavigation = memo(function BottomNavigation({ onLongPress }: {
  onLongPress: (action: HiddenTabAction) => void;
}) {
  return (
    <View style={styles.bottomNavigation} accessibilityRole="tablist">
      {BOTTOM_TABS.map((tab) => (
        <Pressable
          key={tab.label}
          style={styles.bottomTab}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: Boolean(tab.active) }}
          delayLongPress={2000}
          onLongPress={() => onLongPress(tab.action)}
        >
          <MaterialCommunityIcons
            name={tab.icon}
            size={29}
            color={tab.active ? COLORS.text : COLORS.textDim}
          />
          <Text style={[styles.bottomTabLabel, tab.active && styles.bottomTabLabelActive]} numberOfLines={1}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
});

function TopIconButton({ label, icon, onPress }: {
  label: string;
  icon: 'content-copy' | 'dots-vertical';
  onPress: () => void;
}) {
  if (Platform.OS === 'web') {
    return (
      <button
        aria-label={label}
        onClick={onPress}
        style={{
          width: 40, height: 40, padding: 0, border: 0, borderRadius: 20,
          background: 'transparent', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer',
        }}
      >
        <MaterialCommunityIcons name={icon} size={icon === 'dots-vertical' ? 28 : 25} color={COLORS.text} />
      </button>
    );
  }
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      activeOpacity={0.55}
      onPress={onPress}
      style={styles.iconButton}
    >
      <MaterialCommunityIcons name={icon} size={icon === 'dots-vertical' ? 28 : 25} color={COLORS.text} />
    </TouchableOpacity>
  );
}

function SettingsSheet({ visible, settings, onClose, onChange, onReset }: {
  visible: boolean;
  settings: Settings;
  onClose: () => void;
  onChange: (settings: Settings) => void;
  onReset: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [newValue, setNewValue] = useState('0');
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  const addValue = () => {
    const parsed = Number.parseInt(newValue, 10);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 99) {
      Alert.alert('Некорректное значение', 'Введите целое число от 0 до 99.');
      return;
    }
    onChange({ ...settings, fakeMs: [...settings.fakeMs, parsed] });
    setNewValue('0');
    void Haptics.selectionAsync();
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) {
      Alert.alert('Введите название', 'Укажите название своего пресета.');
      return;
    }
    if (settings.fakeMs.length === 0) {
      Alert.alert('Пустая последовательность', 'Добавьте хотя бы одно значение перед сохранением.');
      return;
    }
    const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const customPresets = saveCustomPreset(
      settings.customPresets,
      name,
      settings.fakeMs,
      createId,
    );
    const savedPreset = customPresets.find(
      (preset) => preset.name.localeCompare(name, 'ru', { sensitivity: 'base' }) === 0,
    );
    onChange({
      ...settings,
      customPresets,
      selectedPresetId: savedPreset?.id ?? settings.selectedPresetId,
    });
    setPresetName('');
    if (Platform.OS === 'android') ToastAndroid.show('Пресет сохранён', ToastAndroid.SHORT);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const confirmReset = () => Alert.alert(
    'Сбросить настройки?',
    'Будут восстановлены значения по умолчанию, а список кругов очистится.',
    [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Сбросить', style: 'destructive', onPress: onReset },
    ],
  );

  if (!visible) return null;

  return (
    <View style={styles.settingsOverlay}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoider}
        >
          <Pressable
            style={[styles.settingsSheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]}
            onPress={(event) => event.stopPropagation()}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Настройки</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Закрыть настройки"
                  hitSlop={12} onPress={onClose} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                  <MaterialCommunityIcons name="close" size={23} color={COLORS.textDim} />
                </Pressable>
              </View>

              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>Подмена миллисекунд</Text>
                <Text style={styles.hint}>Числа 0–99 подменяют сотые, а «Реальное» оставляет фактическое значение. Последовательность повторяется по кругу.</Text>
                <View style={styles.addRow}>
                  <TextInput
                    value={newValue}
                    onChangeText={(text) => setNewValue(text.replace(/[^0-9]/g, '').slice(0, 2))}
                    onSubmitEditing={addValue}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                    style={styles.numberInput}
                    placeholder="0–99"
                    placeholderTextColor={COLORS.textDim}
                    accessibilityLabel="Новое значение сотых"
                  />
                  <Pressable onPress={addValue} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
                    <MaterialCommunityIcons name="plus" size={19} color={COLORS.text} />
                    <Text style={styles.addButtonText}>Добавить</Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => {
                    onChange({ ...settings, fakeMs: [...settings.fakeMs, 'real'] });
                    void Haptics.selectionAsync();
                  }}
                  style={({ pressed }) => [styles.addRealButton, pressed && styles.pressed]}
                >
                  <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.purple} />
                  <Text style={styles.addRealButtonText}>Добавить «Реальное»</Text>
                </Pressable>

                <View style={styles.chips}>
                  {settings.fakeMs.map((value, index) => (
                    <View style={styles.chip} key={`${index}-${value}`}>
                      <Text style={styles.chipIndex}>#{index + 1}</Text>
                      <Text style={[styles.chipValue, value === 'real' && styles.chipRealValue]}>
                        {value === 'real' ? 'Реальное' : String(value).padStart(2, '0')}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Удалить значение ${value === 'real' ? 'Реальное' : value}`}
                        hitSlop={6}
                        onPress={() => onChange({
                          ...settings,
                          fakeMs: settings.fakeMs.filter((_, itemIndex) => itemIndex !== index),
                        })}
                      >
                        <MaterialCommunityIcons name="close" size={15} color={COLORS.textDim} />
                      </Pressable>
                    </View>
                  ))}
                </View>

                <View style={styles.presetSection}>
                  <Text style={styles.settingLabel}>Мои пресеты</Text>
                  <Text style={styles.hint}>Сохраните текущую последовательность или выберите ранее сохранённую.</Text>
                  <View style={styles.presetSaveRow}>
                    <TextInput
                      value={presetName}
                      onChangeText={(text) => setPresetName(text.slice(0, 40))}
                      onSubmitEditing={savePreset}
                      maxLength={40}
                      style={styles.presetNameInput}
                      placeholder="Название пресета"
                      placeholderTextColor={COLORS.textDim}
                      accessibilityLabel="Название нового пресета"
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Сохранить текущую последовательность как пресет"
                      onPress={savePreset}
                      style={({ pressed }) => [styles.savePresetButton, pressed && styles.pressed]}
                    >
                      <MaterialCommunityIcons name="content-save-outline" size={19} color={COLORS.text} />
                      <Text style={styles.addButtonText}>Сохранить</Text>
                    </Pressable>
                  </View>

                  {settings.customPresets.length === 0 ? (
                    <Text style={styles.emptyPresets}>Сохранённых пресетов пока нет</Text>
                  ) : settings.customPresets.map((preset) => (
                    <View
                      key={preset.id}
                      style={[
                        styles.presetCard,
                        settings.selectedPresetId === preset.id && styles.presetCardSelected,
                      ]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Выбрать пресет ${preset.name}`}
                        onPress={() => {
                          onChange({
                            ...settings,
                            fakeMs: [...preset.values],
                            selectedPresetId: preset.id,
                          });
                          void Haptics.selectionAsync();
                        }}
                        style={({ pressed }) => [styles.presetContent, pressed && styles.pressed]}
                      >
                        <View style={styles.presetTitleRow}>
                          <Text style={styles.presetName} numberOfLines={1}>{preset.name}</Text>
                          {settings.selectedPresetId === preset.id ? (
                            <Text style={styles.selectedPresetLabel}>Выбран</Text>
                          ) : null}
                        </View>
                        <Text style={styles.presetValues} numberOfLines={2}>
                          {preset.values.map((value) => value === 'real' ? 'Реальное' : String(value).padStart(2, '0')).join(' · ')}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Удалить пресет ${preset.name}`}
                        hitSlop={8}
                        onPress={() => {
                          const customPresets = deleteCustomPreset(settings.customPresets, preset.id);
                          const deletingSelected = settings.selectedPresetId === preset.id;
                          onChange({
                            ...settings,
                            customPresets,
                            selectedPresetId: deletingSelected
                              ? customPresets[0]?.id ?? null
                              : settings.selectedPresetId,
                            presetEnabled: deletingSelected ? false : settings.presetEnabled,
                          });
                        }}
                        style={({ pressed }) => [styles.deletePresetButton, pressed && styles.pressed]}
                      >
                        <MaterialCommunityIcons name="delete-outline" size={21} color={COLORS.lapRed} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.settingGroup}>
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.settingLabel}>Случайное время при запуске</Text>
                    <Text style={styles.hint}>
                      При открытии приложения минуты соответствуют номеру выбранного пресета, а секунды и миллисекунды выбираются случайно.
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel="Случайное время при запуске"
                    value={settings.launchRandomTime}
                    onValueChange={(launchRandomTime) => onChange({ ...settings, launchRandomTime })}
                    trackColor={{ false: COLORS.divider, true: COLORS.purple }}
                    thumbColor={COLORS.text}
                  />
                </View>
              </View>

              <Pressable onPress={confirmReset}
                style={({ pressed }) => [styles.resetSettingsButton, pressed && styles.pressed]}>
                <Text style={styles.resetSettingsText}>Сбросить все настройки</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </View>
  );
}

function MagicTimerScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [phase, setPhase] = useState<TimerPhase>('idle');
  const [displayMs, setDisplayMs] = useState(0);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const startTimeRef = useRef(0);
  const accumulatedMsRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const fakeIndexRef = useRef(0);
  const lastLapMsRef = useRef(0);
  const settingsRef = useRef(settings);
  const settingsLoadedRef = useRef(false);
  const launchInitializedRef = useRef(false);
  const vibrationRunRef = useRef(0);

  const applySettings = useCallback((nextSettings: Settings) => {
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
  }, []);

  const vibrateCount = useCallback(async (count: number) => {
    const run = vibrationRunRef.current + 1;
    vibrationRunRef.current = run;
    for (let index = 0; index < count; index += 1) {
      if (vibrationRunRef.current !== run) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (index < count - 1) await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }, []);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(SETTINGS_KEY).then((stored) => {
      if (!active) return;
      const loadedSettings = stored ? sanitizeSettings(JSON.parse(stored)) : DEFAULT_SETTINGS;
      applySettings(loadedSettings);
      if (loadedSettings.launchRandomTime && !launchInitializedRef.current) {
        const presetIndex = getSelectedPresetIndex(
          loadedSettings.customPresets,
          loadedSettings.selectedPresetId,
        );
        if (presetIndex >= 0) {
          const launchTime = createLaunchTime(presetIndex);
          accumulatedMsRef.current = launchTime;
          setDisplayMs(launchTime);
          setPhase('paused');
        }
      }
      launchInitializedRef.current = true;
    }).catch(() => undefined).finally(() => { settingsLoadedRef.current = true; });
    return () => { active = false; };
  }, [applySettings]);
  useEffect(() => {
    if (settingsLoadedRef.current) {
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => undefined);
    }
  }, [settings]);
  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const tick = useCallback((now: number) => {
    setDisplayMs(accumulatedMsRef.current + now - startTimeRef.current);
    animationFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const getNextFakeMs = useCallback(() => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.presetEnabled) return 'real';
    const selectedPreset = currentSettings.customPresets.find(
      (preset) => preset.id === currentSettings.selectedPresetId,
    );
    const values = selectedPreset?.values ?? [];
    if (values.length === 0) return 'real';
    const value = values[fakeIndexRef.current % values.length];
    fakeIndexRef.current += 1;
    return value;
  }, []);

  const startOrContinue = useCallback(() => {
    startTimeRef.current = performance.now();
    setPhase('running');
    animationFrameRef.current = requestAnimationFrame(tick);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [tick]);

  const stop = useCallback(() => {
    const elapsed = accumulatedMsRef.current + performance.now() - startTimeRef.current;
    const { totalMs } = captureTime(elapsed, lastLapMsRef.current, getNextFakeMs(), accumulatedMsRef.current);
    accumulatedMsRef.current = totalMs;
    setDisplayMs(totalMs);
    setPhase('paused');
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [getNextFakeMs]);

  const handlePrimary = useCallback(() => {
    if (phase === 'running') stop();
    else startOrContinue();
  }, [phase, startOrContinue, stop]);

  const resetTimer = useCallback(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    startTimeRef.current = 0;
    accumulatedMsRef.current = 0;
    fakeIndexRef.current = 0;
    lastLapMsRef.current = 0;
    setDisplayMs(0);
    setPhase('idle');
    setLaps([]);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const recordLap = useCallback(() => {
    const now = performance.now();
    const elapsed = accumulatedMsRef.current + now - startTimeRef.current;
    const { totalMs, lapMs } = captureTime(elapsed, lastLapMsRef.current, getNextFakeMs(), accumulatedMsRef.current);
    accumulatedMsRef.current = totalMs;
    startTimeRef.current = now;
    lastLapMsRef.current = totalMs;
    setDisplayMs(totalMs);
    setLaps((current) => [...current, {
      index: current.length + 1,
      elapsedMs: totalMs,
      lapMs,
      total: formatTime(totalMs).display,
      split: formatTime(lapMs).display,
    }]);
    void Haptics.selectionAsync();
  }, [getNextFakeMs]);

  const handleSecondary = useCallback(() => {
    if (phase === 'running') recordLap();
    else if (phase === 'paused') resetTimer();
  }, [phase, recordLap, resetTimer]);

  const copyLaps = useCallback(async () => {
    if (laps.length === 0) return;
    const lines = [...laps].reverse().map((lap) => {
      return `${String(lap.index).padStart(2, '0')}  ${lap.split}  ${lap.total}`;
    });
    await Clipboard.setStringAsync(['Круг  Время круга  Общее время', ...lines].join('\n'));
    if (Platform.OS === 'android') ToastAndroid.show('Результаты скопированы', ToastAndroid.SHORT);
    void Haptics.selectionAsync();
  }, [laps]);

  const resetAll = useCallback(() => {
    applySettings(DEFAULT_SETTINGS);
    resetTimer();
    setSettingsVisible(false);
  }, [applySettings, resetTimer]);
  const openSettings = useCallback(() => setSettingsVisible(true), []);
  const closeSettings = useCallback(() => setSettingsVisible(false), []);

  const handleHiddenTabLongPress = useCallback((action: HiddenTabAction) => {
    const currentSettings = settingsRef.current;
    const presetIndex = getSelectedPresetIndex(
      currentSettings.customPresets,
      currentSettings.selectedPresetId,
    );

    if (action === 'announce') {
      if (presetIndex >= 0) void vibrateCount(presetIndex + 1);
      return;
    }

    if (action === 'toggle') {
      const presetEnabled = presetIndex >= 0 ? !currentSettings.presetEnabled : false;
      fakeIndexRef.current = 0;
      applySettings({ ...currentSettings, presetEnabled });
      void vibrateCount(presetEnabled ? 1 : 2);
      return;
    }

    const direction = action === 'previous' ? -1 : 1;
    const nextPreset = cycleSelectedPreset(
      currentSettings.customPresets,
      currentSettings.selectedPresetId,
      direction,
    );
    if (!nextPreset) return;
    const selectedPreset = currentSettings.customPresets[nextPreset.index];
    fakeIndexRef.current = 0;
    applySettings({
      ...currentSettings,
      selectedPresetId: nextPreset.id,
      fakeMs: [...selectedPreset.values],
    });
    void vibrateCount(nextPreset.index + 1);
  }, [applySettings, vibrateCount]);

  const compact = laps.length > 0;
  const primaryLabel = phase === 'running' ? 'Стоп' : phase === 'paused' ? 'Продолжить' : 'Начать';
  const secondaryLabel = phase === 'paused' ? 'Сброс' : 'Интервал';
  const secondaryDisabled = phase === 'idle';
  const smallScreen = height < 720;

  return (
    <View style={[styles.screen, {
      paddingTop: Math.max(insets.top, 4),
      // Keep the app tabs above Android's gesture area or three-button navigation.
      paddingBottom: insets.bottom,
    }]}>
      <StatusBar style="light" />

      <View style={styles.topBar}>
        <View style={styles.topActions}>
          {laps.length === 0 ? null : (
            <TopIconButton label="Скопировать результаты" icon="content-copy" onPress={copyLaps} />
          )}
          <TopIconButton label="Настройки" icon="dots-vertical" onPress={openSettings} />
        </View>
      </View>

      <View style={styles.content}>
        <TimerDisplay elapsedMs={displayMs} compact={compact} />
        <LapTable laps={laps} />
      </View>

      <View style={[styles.controls, smallScreen && styles.controlsSmall]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: secondaryDisabled }}
          disabled={secondaryDisabled}
          onPress={handleSecondary}
          style={({ pressed }) => [
            styles.controlButton,
            styles.secondaryButton,
            secondaryDisabled && styles.secondaryDisabled,
            pressed && styles.controlPressed,
          ]}
        >
          <Text style={[styles.controlText, secondaryDisabled && styles.secondaryDisabledText]}>{secondaryLabel}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={handlePrimary}
          style={({ pressed }) => [
            styles.controlButton,
            phase === 'running' ? styles.stopButton : styles.startButton,
            pressed && styles.controlPressed,
          ]}
        >
          <Text style={styles.controlText} numberOfLines={1} adjustsFontSizeToFit>{primaryLabel}</Text>
        </Pressable>
      </View>

      <BottomNavigation onLongPress={handleHiddenTabLongPress} />

      <SettingsSheet
        visible={settingsVisible}
        settings={settings}
        onClose={closeSettings}
        onChange={applySettings}
        onReset={resetAll}
      />
    </View>
  );
}

export default function App() {
  return <SafeAreaProvider><MagicTimerScreen /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  topBar: { height: 54, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, paddingHorizontal: 24 },
  timerBlock: { alignItems: 'center', justifyContent: 'center' },
  timerBlockIdle: { flex: 1, transform: [{ translateY: -104 }] },
  timerBlockCompact: { height: 178, paddingTop: 12 },
  timerText: {
    width: '100%', color: COLORS.text, textAlign: 'center',
    fontFamily: Platform.select({ android: 'sans-serif-light', default: 'System' }),
    fontWeight: '300', fontVariant: ['tabular-nums'], letterSpacing: -1.5,
  },
  lapTable: { flex: 1, minHeight: 150 },
  tableHeader: {
    height: 53, flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  headerCell: { color: COLORS.textDim, fontSize: 14, fontWeight: '400' },
  lapsContent: { paddingTop: 10, paddingBottom: 8 },
  lapRow: { height: 50, flexDirection: 'row', alignItems: 'center' },
  lapCell: {
    color: COLORS.text, fontSize: 17,
    fontFamily: Platform.select({ android: 'sans-serif-light', default: 'System' }),
    fontWeight: '300', fontVariant: ['tabular-nums'],
  },
  lapNumber: { width: '23%', textAlign: 'center' },
  lapSplit: { width: '38.5%', textAlign: 'center' },
  lapTotal: { width: '38.5%', textAlign: 'center' },
  fastestLap: { color: COLORS.purple },
  slowestLap: { color: COLORS.lapRed },
  controls: {
    height: 86, paddingHorizontal: 42, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 42, marginBottom: 22,
  },
  controlsSmall: { marginBottom: 8 },
  controlButton: ({
    flex: 1, height: 62, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 10,
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  } as any),
  nonInteractive: { pointerEvents: 'none' },
  secondaryButton: { backgroundColor: COLORS.surfaceRaised },
  secondaryDisabled: { backgroundColor: '#141414' },
  secondaryDisabledText: { color: COLORS.textDisabled },
  startButton: { backgroundColor: COLORS.purple },
  stopButton: { backgroundColor: COLORS.red },
  controlText: { color: COLORS.text, fontSize: 17, fontWeight: '600' },
  controlPressed: { transform: [{ scale: 0.96 }], opacity: 0.88 },
  pressed: { opacity: 0.55 },
  bottomNavigation: { height: 91, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'flex-start', paddingTop: 10 },
  bottomTab: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 7 },
  bottomTabLabel: { color: COLORS.textDim, fontSize: 12.5, fontWeight: '400' },
  bottomTabLabelActive: { color: COLORS.text, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' },
  settingsOverlay: { position: 'absolute', inset: 0, zIndex: 100 },
  keyboardAvoider: { justifyContent: 'flex-end', pointerEvents: 'box-none' },
  settingsSheet: {
    maxHeight: '88%', backgroundColor: COLORS.surface,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingTop: 22, paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider,
  },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: '500' },
  settingGroup: { paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider },
  settingLabel: { color: COLORS.text, fontSize: 15, fontWeight: '500' },
  hint: { color: COLORS.textDim, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 11 },
  numberInput: {
    flex: 1, minHeight: 46, backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.divider, borderRadius: 14,
    paddingHorizontal: 14, color: COLORS.text, fontSize: 16,
  },
  addButton: {
    minHeight: 46, backgroundColor: COLORS.purple, borderRadius: 23,
    paddingHorizontal: 15, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center',
  },
  addButtonText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  addRealButton: {
    minHeight: 42, borderWidth: 1, borderColor: COLORS.purple, borderRadius: 21,
    marginBottom: 12, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center',
  },
  addRealButtonText: { color: COLORS.purple, fontSize: 14, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.surfaceRaised, borderRadius: 18,
    paddingVertical: 7, paddingHorizontal: 10,
  },
  chipIndex: { color: COLORS.textDim, fontSize: 10 },
  chipValue: { color: COLORS.text, fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  chipRealValue: { color: COLORS.purple, fontSize: 13 },
  presetSection: { marginTop: 8, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.divider },
  presetSaveRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 10 },
  presetNameInput: {
    flex: 1, minHeight: 46, backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.divider, borderRadius: 14,
    paddingHorizontal: 14, color: COLORS.text, fontSize: 14,
  },
  savePresetButton: {
    minHeight: 46, backgroundColor: COLORS.purple, borderRadius: 23,
    paddingHorizontal: 13, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center',
  },
  emptyPresets: { color: COLORS.textDim, fontSize: 12.5, textAlign: 'center', paddingVertical: 14 },
  presetCard: {
    minHeight: 58, flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceRaised, borderRadius: 16, marginTop: 8,
    borderWidth: 1, borderColor: 'transparent',
  },
  presetCardSelected: { borderColor: COLORS.purple },
  presetContent: { flex: 1, paddingVertical: 10, paddingLeft: 14, paddingRight: 8 },
  presetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  presetName: { flexShrink: 1, color: COLORS.text, fontSize: 14.5, fontWeight: '500' },
  selectedPresetLabel: { color: COLORS.purple, fontSize: 10.5, fontWeight: '600' },
  presetValues: { color: COLORS.textDim, fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  deletePresetButton: { width: 46, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  switchCopy: { flex: 1 },
  resetSettingsButton: {
    minHeight: 48, borderWidth: 1, borderColor: COLORS.red, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginTop: 18,
  },
  resetSettingsText: { color: COLORS.lapRed, fontSize: 14, fontWeight: '500' },
});
