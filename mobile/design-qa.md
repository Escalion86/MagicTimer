# Design QA — Samsung Stopwatch reference

## Evidence

- Reference idle: `C:\Users\Escal\AppData\Local\Temp\codex-clipboard-db8232da-df66-46dd-8c31-955970630932.png`
- Reference running: `C:\Users\Escal\AppData\Local\Temp\codex-clipboard-759f8d9a-5d10-49eb-a8ee-abc6b034a9e2.png`
- Implementation idle: `D:\Programming\Projects\magic-timer\mobile\qa-empty-final.png`
- Implementation running: `D:\Programming\Projects\magic-timer\mobile\qa-running-final.png`
- Settings with mixed values: `D:\Programming\Projects\magic-timer\mobile\qa-settings-real-final.png`
- Side-by-side idle: `D:\Programming\Projects\magic-timer\mobile\qa-comparison-empty.png`
- Side-by-side running: `D:\Programming\Projects\magic-timer\mobile\qa-comparison-running.png`

The implementation was captured at 393 × 852 CSS pixels. Each Samsung reference was normalized to the same 393 × 852 comparison frame. The comparison pairs place the reference on the left and the implementation on the right.

## States and interactions checked

- Idle stopwatch with disabled interval button and purple start button.
- Running stopwatch with five intervals, current interval, lap table, fastest and slowest highlighting, copy and settings actions.
- Stop, continue and reset states.
- Settings open/close, numeric value entry, `Реальное` token, removal chips and preset `2 реальных + классика`.
- Mixed sequence behavior: the first two intervals retained their real hundredths; the following three used `40`, `03`, and `21` in order.
- Bottom navigation and top actions remained readable and tappable.

## Visual findings

- Typography: tabular timer digits, hierarchy and subdued secondary values match the reference. The native build uses Android's light system sans rather than redistributing Samsung's proprietary font.
- Spacing: timer, lap headers, rows, controls and bottom navigation align closely in the normalized comparisons.
- Color: black canvas, gray surfaces, Samsung-like purple start/highlight, red stop/slowest, and white/gray text match the reference palette.
- Icons/assets: all visible controls use Material Community Icons; no emoji, text glyph substitutes or handcrafted SVG icons are used.
- Copy: Russian labels and `MM : SS , CC` / `MM:SS,CC` formatting match the reference conventions.

## Fixes made during QA

- Raised the idle timer to match the reference vertical position.
- Removed the web focus outline from pill controls.
- Prevented the transformed timer block from intercepting the settings action.
- Clarified settings copy so `Реальное` is explicitly described as retaining actual hundredths.

## Remaining low-priority difference

- P3: browser captures omit Samsung's native status/navigation bars. Android owns those system surfaces in the APK; the app does not imitate them with fake UI.

final result: passed
