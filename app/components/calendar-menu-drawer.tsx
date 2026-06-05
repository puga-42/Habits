import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette } from '@/constants/colors';

export type ViewMode = 'day' | '3day' | 'week' | 'month' | 'schedule';

type Props = {
  visible: boolean;
  view: ViewMode;
  available: ViewMode[];
  onPickView: (v: ViewMode) => void;
  onOpenSettings: () => void;
  onClose: () => void;
};

const DRAWER_WIDTH = 280;
const ACTIVE_TINT = Palette.primary;

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
  onOpenSettings,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, translateX]);

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
            <View style={[styles.safe, { paddingTop: insets.top }]}>
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
            </View>
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
});
