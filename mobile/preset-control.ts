import type { CustomPreset } from './preset-core';

export function getSelectedPresetIndex(presets: CustomPreset[], selectedPresetId: string | null) {
  if (presets.length === 0) return -1;
  const index = presets.findIndex((preset) => preset.id === selectedPresetId);
  return index >= 0 ? index : 0;
}

export function cycleSelectedPreset(
  presets: CustomPreset[],
  selectedPresetId: string | null,
  direction: -1 | 1,
) {
  if (presets.length === 0) return null;
  const currentIndex = getSelectedPresetIndex(presets, selectedPresetId);
  const nextIndex = (currentIndex + direction + presets.length) % presets.length;
  return { id: presets[nextIndex].id, index: nextIndex };
}

export function createLaunchTime(presetIndex: number, random: () => number = Math.random) {
  if (presetIndex < 0) return 0;
  const minutes = presetIndex + 1;
  const seconds = Math.floor(random() * 60);
  const milliseconds = Math.floor(random() * 1000);
  return minutes * 60_000 + seconds * 1000 + milliseconds;
}

// Длительность одного импульса и паузы между ними: импульсы должны быть достаточно
// длинными и сильными, чтобы их можно было пересчитать на ощупь (1 импульс = пресет 1).
export const PRESET_PULSE_MS = 180;
export const PRESET_GAP_MS = 220;
export const PRESET_OFF_PULSE_MS = 550;

export function getPresetVibrationPattern(index: number, enabled: boolean) {
  if (index < 0) return [];
  return enabled ? buildPresetVibrationPattern(index + 1) : [0, PRESET_OFF_PULSE_MS];
}

// Паттерн для Android: [ожидание, импульс, пауза, импульс, ...].
// Пауза после последнего импульса не нужна — иначе мотор «висит» лишние 220 мс.
export function buildPresetVibrationPattern(count: number) {
  if (!Number.isFinite(count)) return [];
  const pulses = Math.floor(count);
  if (pulses < 1) return [];
  const pattern: number[] = [0];
  for (let index = 0; index < pulses; index += 1) {
    pattern.push(PRESET_PULSE_MS);
    if (index < pulses - 1) pattern.push(PRESET_GAP_MS);
  }
  return pattern;
}
