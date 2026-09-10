import React, { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@/lib/theme';

interface ChatInputProps {
  onSend: (text: string) => void;
  onUpload: () => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, onUpload, disabled }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onUpload} disabled={disabled} style={styles.iconButton}>
        <Text style={styles.icon}>📎</Text>
      </Pressable>
      <TextInput
        style={styles.input}
        placeholder="Schreib etwas oder lade ein Dokument hoch…"
        placeholderTextColor={colors.textMuted}
        value={text}
        onChangeText={setText}
        multiline
        onSubmitEditing={handleSend}
        blurOnSubmit
      />
      <Pressable
        onPress={handleSend}
        disabled={disabled || !text.trim()}
        style={[styles.sendButton, (disabled || !text.trim()) && styles.dimmed]}
      >
        <Text style={styles.sendText}>➤</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  iconButton: { padding: spacing.sm },
  icon: { fontSize: 22 },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 15,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: colors.text, fontSize: 16 },
  dimmed: { opacity: 0.5 },
});
