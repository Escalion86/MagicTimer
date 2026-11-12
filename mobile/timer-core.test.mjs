import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { captureTime } from './timer-core.ts';
import { deleteCustomPreset, sanitizePresets, saveCustomPreset } from './preset-core.ts';
import { createLaunchTime, cycleSelectedPreset, getSelectedPresetIndex } from './preset-control.ts';

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
  assert.equal(cycleSelectedPreset(presets.slice(0, 1), 'one', 1), null);
  assert.equal(getSelectedPresetIndex(presets, 'missing'), 0);
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
