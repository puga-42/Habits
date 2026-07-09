// Shared form body for the identity create (/group/new) and edit
// (/group/edit) pages: name + description fields and the habit checklist.
// Presentational — the screens own state, save/create/delete mutations, and
// pass extras (e.g. the edit page's Delete button) as children below.

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { GroupEditDetails } from '@/components/group-edit-details';
import { GroupEditHabitRow } from '@/components/group-edit-habit-row';
import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';
import type { GroupHabitChoice } from '@/lib/group-edit';

type Props = {
  name: string;
  description: string;
  choices: GroupHabitChoice[];
  selected: Set<string>;
  emptyCopy: string;
  onChangeName: (s: string) => void;
  onChangeDescription: (s: string) => void;
  onToggle: (lineageId: string) => void;
  children?: ReactNode;
};

export function IdentityForm({
  name,
  description,
  choices,
  selected,
  emptyCopy,
  onChangeName,
  onChangeDescription,
  onToggle,
  children,
}: Props) {
  const t = useTokens();
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets>
      <GroupEditDetails
        name={name}
        description={description}
        textColor={t.ink}
        onChangeName={onChangeName}
        onChangeDescription={onChangeDescription}
      />

      <ThemedText style={styles.label}>Habits</ThemedText>
      {choices.length === 0 ? (
        <ThemedText style={styles.empty}>{emptyCopy}</ThemedText>
      ) : (
        choices.map((choice) => (
          <GroupEditHabitRow
            key={choice.lineageId}
            choice={choice}
            selected={selected.has(choice.lineageId)}
            onToggle={() => onToggle(choice.lineageId)}
          />
        ))
      )}

      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },
  label: {
    fontSize: 12,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 6,
  },
  empty: { opacity: 0.6, fontSize: 15, lineHeight: 21, paddingVertical: 8 },
});
