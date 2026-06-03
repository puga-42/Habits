// Bottom sheet showing flat-list comments for a single completion + a
// composer at the bottom. Slide-from-bottom Modal mirroring the pattern in
// calendar-menu-drawer.tsx.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedCommentRow } from '@/components/feed-comment-row';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  applyCommentLikeToggle,
  deleteActivityComment,
  deleteComment,
  fetchActivityComments,
  fetchComments,
  likeActivityComment,
  likeComment,
  postActivityComment,
  postComment,
  subscribeToFeed,
  unlikeActivityComment,
  unlikeComment,
  type Comment,
  type FeedKind,
} from '@/lib/feed';

type Props = {
  visible: boolean;
  targetId: string | null;
  targetKind: FeedKind;
  targetOwnerId: string | null;
  onClose: () => void;
  onCountChange?: (delta: number) => void;
};

const SHEET_HEIGHT_FRACTION = 0.75;

export function FeedCommentsSheet({
  visible,
  targetId,
  targetKind,
  targetOwnerId,
  onClose,
  onCountChange,
}: Props) {
  const { session } = useAuth();
  const textColor = useThemeColor({}, 'text');
  const viewerId = session?.user.id ?? null;
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const translateY = useRef(new Animated.Value(800)).current;
  const now = useRef(new Date()).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : 800,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  const fetchFn = targetKind === 'completion' ? fetchComments : fetchActivityComments;
  const postFn = targetKind === 'completion' ? postComment : postActivityComment;
  const deleteFn = targetKind === 'completion' ? deleteComment : deleteActivityComment;
  const likeFn = targetKind === 'completion' ? likeComment : likeActivityComment;
  const unlikeFn = targetKind === 'completion' ? unlikeComment : unlikeActivityComment;

  useEffect(() => {
    if (!visible || !targetId) return;
    let cancelled = false;
    setLoading(true);
    fetchFn(targetId)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, targetId, fetchFn]);

  useEffect(() => {
    if (!visible || !targetId || !viewerId || targetKind !== 'completion') return;
    const unsub = subscribeToFeed(
      {
        onCompletion: () => {},
        onActivity: () => {},
        onLike: () => {},
        onComment: (event, eventCompletionId, commentId) => {
          if (eventCompletionId !== targetId) return;
          if (event === 'DELETE') {
            setComments((prev) => prev.filter((c) => c.id !== commentId));
          } else {
            fetchFn(targetId).then(setComments);
          }
        },
        onCommentLike: () => {
          fetchFn(targetId).then(setComments);
        },
      },
      `comments-${targetId}`,
    );
    return unsub;
  }, [visible, targetId, targetKind, viewerId, fetchFn]);

  const send = useCallback(async () => {
    if (!targetId || !viewerId) return;
    const body = input.trim();
    if (body.length === 0) return;
    setSending(true);
    try {
      const c = await postFn(targetId, viewerId, body);
      setComments((prev) => [...prev, c]);
      setInput('');
      onCountChange?.(1);
    } finally {
      setSending(false);
    }
  }, [targetId, viewerId, input, onCountChange, postFn]);

  const handleToggleLike = useCallback(
    async (comment: Comment) => {
      if (!viewerId) return;
      const next = !comment.viewer_liked;
      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id ? applyCommentLikeToggle(c, next) : c,
        ),
      );
      try {
        if (next) await likeFn(comment.id, viewerId);
        else await unlikeFn(comment.id, viewerId);
      } catch {
        setComments((prev) =>
          prev.map((c) =>
            c.id === comment.id ? applyCommentLikeToggle(c, !next) : c,
          ),
        );
      }
    },
    [viewerId, likeFn, unlikeFn],
  );

  const handleDelete = useCallback(
    async (comment: Comment) => {
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      onCountChange?.(-1);
      try {
        await deleteFn(comment.id);
      } catch {
        if (targetId) fetchFn(targetId).then(setComments);
      }
    },
    [targetId, onCountChange, deleteFn, fetchFn],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}
          onStartShouldSetResponder={() => true}>
          <ThemedView style={styles.sheetContent}>
            <SafeAreaView edges={['bottom']} style={styles.safe}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.flex}>
                <View style={styles.handle} />
                <View style={styles.headerRow}>
                  <ThemedText style={styles.headerTitle}>Comments</ThemedText>
                </View>

                {loading ? (
                  <View style={styles.center}>
                    <ActivityIndicator />
                  </View>
                ) : comments.length === 0 ? (
                  <View style={styles.center}>
                    <ThemedText style={styles.empty}>
                      Be the first to comment.
                    </ThemedText>
                  </View>
                ) : (
                  <FlatList
                    data={comments}
                    keyExtractor={(c) => c.id}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                      <FeedCommentRow
                        comment={item}
                        viewerId={viewerId ?? ''}
                        completionOwnerId={targetOwnerId ?? ''}
                        now={now}
                        onToggleLike={() => handleToggleLike(item)}
                        onDelete={() => handleDelete(item)}
                      />
                    )}
                  />
                )}

                <View style={styles.composer}>
                  <TextInput
                    value={input}
                    onChangeText={setInput}
                    placeholder="Add a comment…"
                    placeholderTextColor="rgba(127,127,127,0.6)"
                    style={[styles.input, { color: textColor }]}
                    multiline
                    maxLength={500}
                  />
                  <Pressable
                    onPress={send}
                    disabled={sending || input.trim().length === 0}
                    style={({ pressed }) => [
                      styles.sendButton,
                      (sending || input.trim().length === 0) && styles.sendDisabled,
                      pressed && styles.sendPressed,
                    ]}>
                    <IconSymbol name="paperplane.fill" color={Palette.charcoal} size={18} />
                  </Pressable>
                </View>
              </KeyboardAvoidingView>
            </SafeAreaView>
          </ThemedView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: `${SHEET_HEIGHT_FRACTION * 100}%`,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  sheetContent: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(127,127,127,0.3)',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  headerRow: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.25)',
  },
  headerTitle: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  list: { paddingVertical: 4, paddingBottom: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { opacity: 0.55 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,127,0.25)',
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(127,127,127,0.12)',
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  sendPressed: { opacity: 0.7 },
});
