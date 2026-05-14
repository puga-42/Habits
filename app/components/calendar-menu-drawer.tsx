// Slide-from-left drawer (Google Calendar style). Hosts view-mode picks, the
// habit filter (collapsible dropdown), and future settings/links.

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Habit } from '@/lib/habits';

export type ViewMode = 'day' | '3day' | 'week' | 'month' | 'schedule';

type Props = {
  visible: boolean;
  view: ViewMode;
  available: ViewMode[];
  onPickView: (v: ViewMode) => void;
  habits: Habit[];
  filterHabitId: string | null;
  onPickFilter: (id: string | null) => void;
  onOpenSettings: () => void;
  onClose: () => void;
};

const DRAWER_WIDTH = 280;
const ACTIVE_TINT = '#7c3aed';

const VIEW_OPTIONS: Array<{ key: ViewMode; label: string }> = [
  { key: 'day', label: 'Day' },
  { key: '3day', label: '3 days' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'schedule', label: 'Schedule' },
];

export function CalendarMenuDrawer({
  visible,
  view,
  available,
  onPickView,
  habits,
  filterHabitId,
  onPickFilter,
  onOpenSettings,
  onClose,
}: Props) {
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [filterExpanded, setFilterExpanded] = useState(false);

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (!visible) setFilterExpanded(false);
  }, [visible, translateX]);

  const currentFilterLabel = filterLabelFor(habits, filterHabitId);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[styles.drawer, { transform: [{ translateX }] }]}
          onStartShouldSetResponder={() => true}>
          <ThemedView style={styles.drawerContent}>
            <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
              <View style={styles.titleRow}>
                <ThemedText type="title" style={styles.titleText}>
                  Habits
                </ThemedText>
              </View>

              <ScrollView contentContainerStyle={styles.scroll}>
                <Section title="View">
                  {VIEW_OPTIONS.map((opt) => {
                    const enabled = available.includes(opt.key);
                    const active = view === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        disabled={!enabled}
                        onPress={() => {
                          onPickView(opt.key);
                          onClose();
                        }}
                        style={({ pressed }) => [
                          styles.row,
                          !enabled && styles.rowDisabled,
                          pressed && enabled && styles.rowPressed,
                        ]}>
                        <View style={[styles.bullet, active && styles.bulletActive]} />
                        <ThemedText
                          style={[styles.rowText, active && styles.rowTextActive]}>
                          {opt.label}
                          {!enabled && (
                            <ThemedText style={styles.soon}>  (coming soon)</ThemedText>
                          )}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </Section>

                <Section title="Filter">
                  <Pressable
                    onPress={() => setFilterExpanded((v) => !v)}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                    <View
                      style={[
                        styles.bullet,
                        filterHabitId !== null && styles.bulletActive,
                      ]}
                    />
                    <ThemedText style={styles.rowText} numberOfLines={1}>
                      {currentFilterLabel}
                    </ThemedText>
                    <ThemedText style={styles.chevron}>
                      {filterExpanded ? '▾' : '▸'}
                    </ThemedText>
                  </Pressable>
                  {filterExpanded && (
                    <View style={styles.subList}>
                      <FilterOption
                        label="All habits"
                        active={filterHabitId === null}
                        onPress={() => {
                          onPickFilter(null);
                          onClose();
                        }}
                      />
                      {habits.map((h) => (
                        <FilterOption
                          key={h.id}
                          label={`${h.icon ? h.icon + '  ' : ''}${h.title}`}
                          color={h.color}
                          active={filterHabitId === h.id}
                          onPress={() => {
                            onPickFilter(h.id);
                            onClose();
                          }}
                        />
                      ))}
                    </View>
                  )}
                </Section>

                <Section title="More">
                  <Pressable
                    onPress={() => {
                      onOpenSettings();
                      onClose();
                    }}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                    <View style={styles.bullet} />
                    <ThemedText style={styles.rowText}>Settings</ThemedText>
                  </Pressable>
                </Section>
              </ScrollView>
            </SafeAreaView>
          </ThemedView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );
}

function FilterOption({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color?: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.subRow, pressed && styles.rowPressed]}>
      <View
        style={[
          styles.subBullet,
          color ? { backgroundColor: color } : null,
          !color && active && styles.bulletActive,
          !color && !active && styles.subBulletFallback,
        ]}
      />
      <ThemedText
        style={[styles.subRowText, active && styles.rowTextActive]}
        numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function filterLabelFor(habits: Habit[], id: string | null): string {
  if (!id) return 'All habits';
  const h = habits.find((x) => x.id === id);
  if (!h) return 'All habits';
  return `${h.icon ? h.icon + ' ' : ''}${h.title}`;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
  },
  drawerContent: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingBottom: 24 },
  titleRow: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  titleText: { fontSize: 24 },
  section: { paddingHorizontal: 10, paddingVertical: 6 },
  sectionTitle: {
    fontSize: 11,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  rowDisabled: { opacity: 0.45 },
  rowPressed: { opacity: 0.55, backgroundColor: 'rgba(127,127,127,0.08)' },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(127,127,127,0.4)',
  },
  bulletActive: { backgroundColor: ACTIVE_TINT },
  rowText: { fontSize: 16, flex: 1 },
  rowTextActive: { fontWeight: '600' },
  soon: { fontSize: 13, opacity: 0.55, fontStyle: 'italic' },
  chevron: { fontSize: 12, opacity: 0.55, width: 14, textAlign: 'right' },
  subList: { paddingLeft: 22, marginTop: 2 },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  subBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subBulletFallback: { backgroundColor: 'rgba(127,127,127,0.4)' },
  subRowText: { fontSize: 14, flex: 1, opacity: 0.85 },
});
