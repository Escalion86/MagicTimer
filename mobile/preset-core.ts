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
