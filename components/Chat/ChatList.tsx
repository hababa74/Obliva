import React, { useEffect, useRef } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@/lib/theme';
import type { ChatMessage } from '@/types';
import ChatMessageBubble from './ChatMessage';

interface ChatListProps {
  messages: ChatMessage[];
  sending: boolean;
}

export default function ChatList({ messages, sending }: ChatListProps) {
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, sending]);

  return (
    <FlatList
      ref={listRef}
      style={styles.list}
      contentContainerStyle={styles.content}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ChatMessageBubble message={item} />}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🧠</Text>
          <Text style={styles.emptyTitle}>Willkommen bei Obliva</Text>
          <Text style={styles.emptyText}>
            Schreib Informationen über deine Familie oder lade ein Dokument hoch —
            Obliva merkt sich alles und verknüpft es.
          </Text>
        </View>
      }
      ListFooterComponent={
        sending ? (
          <Text style={styles.thinking}>Obliva denkt nach…</Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingVertical: spacing.md, flexGrow: 1, maxWidth: 800, width: '100%', alignSelf: 'center' },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptyText: { color: colors.textMuted, textAlign: 'center', fontSize: 14, maxWidth: 420 },
  thinking: {
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
