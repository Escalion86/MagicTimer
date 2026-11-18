import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent, LayoutRectangle, StyleProp, ViewStyle } from 'react-native';

type SortableListProps<T> = {
  items: T[];
  itemKey: (item: T, index: number) => string;
  itemLabel: (item: T) => string;
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
  onMove: (from: number, to: number) => void;
  onDragChange: (dragging: boolean) => void;
  handleIcon: ReactNode;
  handleStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  vertical?: boolean;
  highlightColor: string;
};

type Drag = { from: number; x: number; y: number; item: LayoutRectangle };

export default function SortableList<T>({
  items, itemKey, itemLabel, renderItem, onMove, onDragChange, handleIcon, handleStyle,
  style, vertical = false, highlightColor,
}: SortableListProps<T>) {
  const layouts = useRef(new Map<string, LayoutRectangle>());
  const listWidth = useRef(0);
  const drag = useRef<Drag | null>(null);
  const [offset] = useState(() => new Animated.ValueXY());
  const [active, setActive] = useState<{ from: number; to: number } | null>(null);

  useEffect(() => () => {
    if (drag.current) onDragChange(false);
  }, [onDragChange]);

  function start(event: GestureResponderEvent, index: number, key: string) {
    const item = layouts.current.get(key);
    if (!item) return;
    const { pageX, pageY } = event.nativeEvent;
    drag.current = { from: index, x: pageX, y: pageY, item };
    offset.setValue({ x: 0, y: 0 });
    setActive({ from: index, to: index });
    onDragChange(true);
  }

  function targetAt(event: GestureResponderEvent, current: Drag, follow: boolean) {
    const { pageX, pageY } = event.nativeEvent;
    const dx = pageX - current.x;
    const dy = pageY - current.y;
    if (follow) offset.setValue({ x: vertical ? 0 : dx, y: dy });
    if (Math.hypot(dx, dy) < 6 || (vertical && Math.abs(dx) > listWidth.current / 2)) {
      return current.from;
    }

    // Track the centre of the moving item against the original (untransformed) layout.
    const x = current.item.x + current.item.width / 2 + (vertical ? 0 : dx);
    const y = current.item.y + current.item.height / 2 + dy;
    const to = items.findIndex((item, index) => {
      const box = layouts.current.get(itemKey(item, index));
      return box && (vertical || (x >= box.x - 3 && x <= box.x + box.width + 3))
        && y >= box.y - 3 && y <= box.y + box.height + 3;
    });
    return to < 0 ? current.from : to;
  }

  function update(event: GestureResponderEvent) {
    const current = drag.current;
    if (!current) return;
    const to = targetAt(event, current, true);
    setActive((previous) => previous?.to === to ? previous : { from: current.from, to });
  }

  function finish(event?: GestureResponderEvent) {
    const current = drag.current;
    if (!current) return;
    const to = event ? targetAt(event, current, false) : current.from;
    drag.current = null;
    setActive(null);
    offset.setValue({ x: 0, y: 0 });
    onDragChange(false);
    if (to !== current.from) onMove(current.from, to);
  }

  return (
    <View style={style} onLayout={(event) => { listWidth.current = event.nativeEvent.layout.width; }}>
      {items.map((item, index) => {
        const key = itemKey(item, index);
        const moving = active?.from === index;
        const receiving = active?.to === index && !moving;
        const label = itemLabel(item);
        const handle = items.length > 1 ? (
          <View
            accessible
            accessibilityLabel={`Переместить ${label}, позиция ${index + 1} из ${items.length}`}
            accessibilityRole="adjustable"
            accessibilityActions={[
              ...(index > 0 ? [{ name: 'decrement', label: 'Переместить раньше' }] : []),
              ...(index < items.length - 1 ? [{ name: 'increment', label: 'Переместить позже' }] : []),
            ]}
            onAccessibilityAction={(event) => {
              const { actionName } = event.nativeEvent;
              if (actionName === 'decrement' && index > 0) onMove(index, index - 1);
              if (actionName === 'increment' && index < items.length - 1) onMove(index, index + 1);
            }}
            onStartShouldSetResponder={() => true}
            onResponderGrant={(event) => start(event, index, key)}
            onResponderMove={update}
            onResponderRelease={finish}
            onResponderTerminate={() => finish()}
            onResponderTerminationRequest={() => false}
            style={[styles.handle, handleStyle]}
          >
            <View pointerEvents="none">{handleIcon}</View>
          </View>
        ) : null;
        return (
          <View
            key={key}
            onLayout={(event) => { layouts.current.set(key, event.nativeEvent.layout); }}
            style={moving && styles.raised}
          >
            <Animated.View style={moving && { transform: offset.getTranslateTransform(), opacity: 0.88 }}>
              {renderItem(item, index, handle)}
              {receiving ? (
                <View pointerEvents="none" style={[styles.target, { borderColor: highlightColor }]} />
              ) : null}
            </Animated.View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  handle: { width: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  raised: { zIndex: 1 },
  target: { ...StyleSheet.absoluteFill, borderWidth: 2, borderRadius: 16 },
});
