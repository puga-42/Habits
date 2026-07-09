// Cancel / title / action header shared by the identity create and edit
// pages (hairline-capped, action in the accent). The action label swaps to
// `busyLabel` while the screen is working; `disabled` also fades it.

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';

type Props = {
  title: string;
  actionLabel: string;
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  onCancel: () => void;
  onAction: () => void;
};

export function FormPageHeader({
  title,
  actionLabel,
  busy,
  busyLabel,
  disabled,
  onCancel,
  onAction,
}: Props) {
  const t = useTokens();
  return (
    <View style={[styles.header, { borderBottomColor: t.hairlineStrong }]}>
      <Pressable onPress={onCancel} hitSlop={12}>
        <ThemedText style={styles.button}>Cancel</ThemedText>
      </Pressable>
      <ThemedText type="defaultSemiBold">{title}</ThemedText>
      <Pressable onPress={onAction} disabled={disabled} hitSlop={12}>
        <ThemedText
          style={[styles.button, styles.action, { color: t.accent }, disabled && styles.disabled]}>
          {busy ? (busyLabel ?? actionLabel) : actionLabel}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  button: { fontSize: 16 },
  action: { fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
