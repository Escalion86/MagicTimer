import type { SequenceItem } from './timer-core';

export type CustomPreset = {
  id: string;
  name: string;
  values: SequenceItem[];
};

export function sanitizeSequence(value: unknown): SequenceItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SequenceItem =>
    item === 'real' || (typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 99));
}

export function sanitizePresets(value: unknown): CustomPreset[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<CustomPreset>;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const name = typeof candidate.name === 'string' ? candidate.name.trim().slice(0, 40) : '';
    const values = sanitizeSequence(candidate.values);
    if (!id || ids.has(id) || !name || values.length === 0) return [];
    ids.add(id);
    return [{ id, name, values }];
  });
}

export function saveCustomPreset(
  presets: CustomPreset[],
  name: string,
  values: SequenceItem[],
  createId: () => string,
) {
  const normalizedName = name.trim().slice(0, 40);
  const savedValues = sanitizeSequence(values);
  if (!normalizedName || savedValues.length === 0) return presets;
  const existingIndex = presets.findIndex(
    (preset) => preset.name.localeCompare(normalizedName, 'ru', { sensitivity: 'base' }) === 0,
  );
  if (existingIndex < 0) return [...presets, { id: createId(), name: normalizedName, values: savedValues }];
  return presets.map((preset, index) => index === existingIndex
    ? { ...preset, name: normalizedName, values: savedValues }
    : preset);
}

export function deleteCustomPreset(presets: CustomPreset[], id: string) {
  return presets.filter((preset) => preset.id !== id);
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (!Number.isInteger(from) || !Number.isInteger(to)
    || from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const reordered = [...items];
  const [item] = reordered.splice(from, 1);
  reordered.splice(to, 0, item);
  return reordered;
}

export function reorderSelectedValues(
  values: SequenceItem[],
  presets: CustomPreset[],
  selectedPresetId: string | null,
  from: number,
  to: number,
) {
  const fakeMs = moveItem(values, from, to);
  const selected = presets.find((preset) => preset.id === selectedPresetId);
  // Правки в черновике не должны перезаписывать выбранный пресет.
  if (fakeMs === values || !selected || selected.values.length !== values.length
    || !selected.values.every((value, index) => value === values[index])) {
    return { fakeMs, customPresets: presets };
  }
  return {
    fakeMs,
    customPresets: presets.map((preset) => preset === selected ? { ...preset, values: fakeMs } : preset),
  };
}
