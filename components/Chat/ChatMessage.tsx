import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { colors, spacing } from '@/lib/theme';
import type { ChatMessage } from '@/types';

export default function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {isUser ? (
          <Text style={styles.userText}>{message.content}</Text>
        ) : (
          <Markdown style={markdownStyles}>{message.content}</Markdown>
        )}
        {!isUser && message.sources.length > 0 ? (
          <View style={styles.sourcesRow}>
            {message.sources.map((s) => (
              <View key={s.doc_index_id + s.title} style={styles.sourceChip}>
                <Text style={styles.sourceText}>📎 {s.title}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 4, paddingHorizontal: spacing.md },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    padding: spacing.md,
  },
  bubbleUser: { backgroundColor: colors.userBubble, borderBottomRightRadius: 4 },
  bubbleAssistant: {
    backgroundColor: colors.assistantBubble,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  sourcesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  sourceChip: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  sourceText: { color: colors.accent, fontSize: 11 },
});

// react-native-markdown-display nutzt eigene Style-Syntax
const markdownStyles = {
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  heading1: { color: colors.text, fontSize: 20, fontWeight: '700' as const },
  heading2: { color: colors.text, fontSize: 17, fontWeight: '700' as const },
  strong: { fontWeight: '700' as const },
  code_inline: {
    backgroundColor: colors.surfaceLight,
    color: colors.accent,
    borderRadius: 4,
  },
  link: { color: colors.accent },
};
