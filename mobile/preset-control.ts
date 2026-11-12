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
  if (presets.length < 2) return null;
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
