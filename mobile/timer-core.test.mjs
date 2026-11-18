import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { captureTime } from './timer-core.ts';
import { deleteCustomPreset, moveItem, reorderSelectedValues, sanitizePresets, saveCustomPreset } from './preset-core.ts';
import {
  PRESET_GAP_MS,
  PRESET_OFF_PULSE_MS,
  PRESET_PULSE_MS,
  buildPresetVibrationPattern,
  createLaunchTime,
  cycleSelectedPreset,
  getPresetVibrationPattern,
  getSelectedPresetIndex,
} from './preset-control.ts';

test('real entries preserve hundredths before any substitution', () => {
  assert.deepEqual(captureTime(1567, 0, 'real'), { totalMs: 1560, lapMs: 1560 });
  assert.deepEqual(captureTime(90469, 1560, 'real'), { totalMs: 90460, lapMs: 88900 });
});

test('substitution preserves minutes and seconds, lap equals difference of totals', () => {
  assert.deepEqual(captureTime(91229, 90460, 24), { totalMs: 91240, lapMs: 780 });
});

test('future real entries continue from the shown time', () => {
  const captured = captureTime(91229, 90460, 24);
  assert.deepEqual(captureTime(captured.totalMs + 1567, captured.totalMs, 'real'),
    { totalMs: 92800, lapMs: 1560 });
});

test('stop and resume use the same adjusted base', () => {
  const stopped = captureTime(1567, 0, 40);
  assert.equal(stopped.totalMs, 1400);
  assert.equal(captureTime(stopped.totalMs + 2000, 0, 'real').totalMs, 3400);
});

test('rapid taps and hundredths wrap never create negative laps', () => {
  assert.deepEqual(captureTime(1995, 1990, 3), { totalMs: 2030, lapMs: 40 });
  assert.deepEqual(captureTime(59999, 59990, 0), { totalMs: 60000, lapMs: 10 });
});

test('quick resume/stop or resume/lap cannot go below the previous stopped display', () => {
  assert.deepEqual(captureTime(1500, 0, 3, 1400), { totalMs: 2030, lapMs: 2030 });
  assert.deepEqual(captureTime(1500, 400, 3, 1400), { totalMs: 2030, lapMs: 1630 });
});

test('mixed sequence stays consistent over many cycles', () => {
  const sequence = ['real', 'real', 40, 3, 21, 'real', 'real'];
  let total = 0;
  let sum = 0;
  for (let i = 0; i < 1000; i += 1) {
    const value = sequence[i % sequence.length];
    const next = captureTime(total + ((i * 7919) % 100000), total, value);
    assert.ok(next.totalMs >= total);
    assert.ok(next.lapMs >= 0);
    if (value !== 'real') assert.equal((next.totalMs / 10) % 100, value);
    sum += next.lapMs;
    assert.equal(next.totalMs, sum);
    total = next.totalMs;
  }
});

test('public UI and clipboard have no alternate real-time rendering path', () => {
  const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /displayMode|realTotal|realLap|forcedCentiseconds|intervalMs=/);
  assert.match(source, /\{item\.split\}/);
  assert.match(source, /\{item\.total\}/);
});

test('screen reserves the native bottom safe area above system navigation', () => {
  const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
  assert.match(source, /<View style=\{\[styles\.screen,\s*\{[^}]*paddingBottom:\s*insets\.bottom,/);
});

test('Android launcher uses the expected public application name', () => {
  const appConfig = JSON.parse(readFileSync(new URL('./app.json', import.meta.url), 'utf8'));
  const androidStrings = readFileSync(new URL('./android/app/src/main/res/values/strings.xml', import.meta.url), 'utf8');
  assert.equal(appConfig.expo.name, 'Секундомер');
  assert.match(androidStrings, /<string name="app_name">Секундомер<\/string>/);
});

test('custom presets are sanitized before restoring from storage', () => {
  assert.deepEqual(sanitizePresets([
    { id: 'one', name: '  Сцена  ', values: ['real', 40, -1, 100, 3.5, 'bad'] },
    { id: 'one', name: 'Дубликат', values: [21] },
    { id: 'empty', name: '', values: [21] },
  ]), [
    { id: 'one', name: 'Сцена', values: ['real', 40] },
  ]);
});

test('custom presets can be saved, updated by name, restored and deleted', () => {
  const created = saveCustomPreset([], ' Мой фокус ', ['real', 'real', 40, 3, 21], () => 'preset-1');
  assert.deepEqual(created, [{
    id: 'preset-1',
    name: 'Мой фокус',
    values: ['real', 'real', 40, 3, 21],
  }]);

  const updated = saveCustomPreset(created, 'МОЙ ФОКУС', [99], () => 'unused');
  assert.equal(updated.length, 1);
  assert.deepEqual(updated[0], { id: 'preset-1', name: 'МОЙ ФОКУС', values: [99] });
  assert.deepEqual(sanitizePresets(JSON.parse(JSON.stringify(updated))), updated);
  assert.deepEqual(deleteCustomPreset(updated, 'preset-1'), []);
});

test('settings UI contains only user-created presets', () => {
  const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /2 реальных \+ классика|Классика|Ровные|Максимум|const PRESETS/);
  assert.match(source, /Мои пресеты/);
  assert.match(source, /Выбрать пресет/);
  assert.match(source, /Удалить пресет/);
});

test('hidden preset navigation cycles in both directions', () => {
  const presets = [
    { id: 'one', name: 'Первый', values: [1] },
    { id: 'two', name: 'Второй', values: [2] },
    { id: 'three', name: 'Третий', values: [3] },
  ];
  assert.deepEqual(cycleSelectedPreset(presets, 'one', 1), { id: 'two', index: 1 });
  assert.deepEqual(cycleSelectedPreset(presets, 'three', 1), { id: 'one', index: 0 });
  assert.deepEqual(cycleSelectedPreset(presets, 'one', -1), { id: 'three', index: 2 });
  for (const direction of [-1, 1]) {
    const onlyPreset = cycleSelectedPreset(presets.slice(0, 1), 'one', direction);
    assert.deepEqual(onlyPreset, { id: 'one', index: 0 });
    assert.deepEqual(buildPresetVibrationPattern(onlyPreset.index + 1), [0, PRESET_PULSE_MS]);
    assert.equal(cycleSelectedPreset([], null, direction), null);
  }
  assert.equal(getSelectedPresetIndex(presets, 'missing'), 0);
});

test('restored preset order drives both directions without changing which preset is selected', () => {
  const presets = [
    { id: 'one', name: 'Первый', values: [1] },
    { id: 'two', name: 'Второй', values: [2] },
    { id: 'three', name: 'Третий', values: [3] },
  ];
  const selected = presets[0];
  const reordered = moveItem(presets, 0, 2);
  assert.equal(reordered[2], selected);
  assert.equal(presets[0], selected);
  const restored = sanitizePresets(JSON.parse(JSON.stringify(reordered)));
  assert.equal(getSelectedPresetIndex(restored, selected.id), 2);
  assert.deepEqual(cycleSelectedPreset(restored, selected.id, 1), { id: 'two', index: 0 });
  assert.deepEqual(cycleSelectedPreset(restored, selected.id, -1), { id: 'three', index: 1 });
});

test('moving a repeated value by position persists the exact order in the selected preset', () => {
  const values = [11, 'real', 11, 55];
  const presets = [
    { id: 'first', name: 'Первый', values: [77] },
    { id: 'selected', name: 'Второй', values: [...values] },
  ];
  const result = reorderSelectedValues(values, presets, 'selected', 2, 0);
  const restored = sanitizePresets(JSON.parse(JSON.stringify(result.customPresets)));
  assert.deepEqual(result.fakeMs, [11, 11, 'real', 55]);
  assert.equal(result.customPresets[0], presets[0]);
  assert.deepEqual(restored[1], { ...presets[1], values: result.fakeMs });
  assert.deepEqual(presets[1].values, [11, 'real', 11, 55]);
  assert.strictEqual(moveItem(values, 1, 1), values);
  assert.strictEqual(moveItem(values, -1, 0), values);
  assert.strictEqual(moveItem(values, 0, values.length), values);
});

test('moving a value in a draft leaves saved presets untouched', () => {
  const presets = [{ id: 'one', name: 'Первый', values: [11, 55] }];
  const draft = [11, 55, 'real'];
  const result = reorderSelectedValues(draft, presets, 'one', 2, 0);
  assert.deepEqual(result.fakeMs, ['real', 11, 55]);
  assert.strictEqual(result.customPresets, presets);
});

test('real, real, 11, 11, 55 preserves both repeated forced values', () => {
  const sequence = ['real', 'real', 11, 11, 55];
  let total = 0;
  const hundredths = sequence.map((value) => {
    const result = captureTime(total + 1570, total, value);
    total = result.totalMs;
    return (total / 10) % 100;
  });
  assert.deepEqual(hundredths, [57, 14, 11, 11, 55]);
});

test('launch time encodes the one-based preset number only in minutes', () => {
  const values = [0.5, 0.987];
  const launchTime = createLaunchTime(2, () => values.shift());
  assert.equal(launchTime, 3 * 60_000 + 30_000 + 987);
  assert.equal(Math.floor(launchTime / 60_000), 3);
  assert.equal(createLaunchTime(-1, () => 0.5), 0);
});

test('bottom navigation exposes only two-second hidden long presses', () => {
  const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
  assert.match(source, /delayLongPress=\{2000\}/);
  assert.match(source, /action: 'announce'/);
  assert.match(source, /action: 'previous'/);
  assert.match(source, /action: 'toggle'/);
  assert.match(source, /action: 'next'/);
  assert.doesNotMatch(source, /phase[^\n]+handleHiddenTabLongPress|handleHiddenTabLongPress[^\n]+phase/);
});

test('preset switch vibration has one clearly separate pulse per preset', () => {
  assert.deepEqual(buildPresetVibrationPattern(0), []);
  assert.deepEqual(buildPresetVibrationPattern(1), [0, PRESET_PULSE_MS]);
  assert.deepEqual(buildPresetVibrationPattern(3), [
    0, PRESET_PULSE_MS, PRESET_GAP_MS, PRESET_PULSE_MS, PRESET_GAP_MS, PRESET_PULSE_MS,
  ]);
  assert.equal(buildPresetVibrationPattern(4).filter((ms) => ms === PRESET_PULSE_MS).length, 4);
  // Паттерн начинается с нулевой задержки и не висит паузой в конце.
  assert.equal(buildPresetVibrationPattern(4).at(-1), PRESET_PULSE_MS);
  // Импульс длиннее системного «тика», пауза длиннее импульса — иначе серия сливается в один buzz.
  assert.ok(PRESET_PULSE_MS >= 150);
  assert.ok(PRESET_GAP_MS > PRESET_PULSE_MS);
});

test('preset vibration pattern clamps junk input instead of vibrating forever', () => {
  assert.deepEqual(buildPresetVibrationPattern(-1), []);
  assert.deepEqual(buildPresetVibrationPattern(Number.NaN), []);
  assert.deepEqual(buildPresetVibrationPattern(2.9), [0, PRESET_PULSE_MS, PRESET_GAP_MS, PRESET_PULSE_MS]);
});

test('preset feedback distinguishes its number from disabled substitution', () => {
  assert.deepEqual(getPresetVibrationPattern(1, true), [0, PRESET_PULSE_MS, PRESET_GAP_MS, PRESET_PULSE_MS]);
  assert.deepEqual(getPresetVibrationPattern(1, false), [0, PRESET_OFF_PULSE_MS]);
  assert.deepEqual(getPresetVibrationPattern(0, false), [0, PRESET_OFF_PULSE_MS]);
  assert.deepEqual(getPresetVibrationPattern(-1, false), []);
  assert.ok(PRESET_OFF_PULSE_MS > PRESET_PULSE_MS);
});
